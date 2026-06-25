const { MongoClient } = require('mongodb');

let clientPromise;
let indexesReady = false;

function mongoClient() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is missing');
  }
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

async function getCollection() {
  const client = await mongoClient();
  const dbName = process.env.DB_NAME || 'cash';
  const collectionName = process.env.COLLECTION_NAME || 'yop';
  const collection = client.db(dbName).collection(collectionName);
  if (!indexesReady) {
    await collection.createIndex({ path: 1 }, { unique: true });
    await collection.createIndex({ updatedAt: -1 });
    indexesReady = true;
  }
  return collection;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizePath(input) {
  let path = Array.isArray(input) ? input[0] : input;
  path = String(path || '').trim();
  if (path.endsWith('.json')) path = path.slice(0, -5);
  path = path.replace(/^\/+|\/+$/g, '');
  return path.split('/').filter(Boolean).join('/');
}

function clone(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function getNested(value, parts) {
  let cur = value;
  for (const part of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

function setNested(target, parts, value) {
  if (!parts.length) return value;
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!isPlainObject(cur[part])) cur[part] = {};
    cur = cur[part];
  }
  cur[parts[parts.length - 1]] = value;
  return target;
}

function buildAncestorPaths(path) {
  const parts = path ? path.split('/') : [];
  const out = [];
  for (let i = 1; i <= parts.length; i++) out.push(parts.slice(0, i).join('/'));
  return out;
}

async function getNode(collection, path) {
  const ancestors = buildAncestorPaths(path);
  let baseValue;
  if (!path) {
    baseValue = undefined;
  } else if (ancestors.length) {
    const docs = await collection.find({ path: { $in: ancestors } }).toArray();
    docs.sort((a, b) => b.path.split('/').length - a.path.split('/').length);
    for (const doc of docs) {
      const rest = path === doc.path ? [] : path.slice(doc.path.length + 1).split('/').filter(Boolean);
      const extracted = rest.length ? getNested(doc.value, rest) : doc.value;
      if (extracted !== undefined) {
        baseValue = clone(extracted);
        break;
      }
    }
  }

  const prefix = path ? path + '/' : '';
  const regex = path ? new RegExp('^' + escapeRegex(prefix)) : /.*/;
  const descendants = await collection.find({ path: { $regex: regex } }).toArray();
  descendants.sort((a, b) => a.path.split('/').length - b.path.split('/').length);

  let result = clone(baseValue);
  for (const doc of descendants) {
    if (path && doc.path === path) continue;
    const rel = path ? doc.path.slice(prefix.length) : doc.path;
    const parts = rel.split('/').filter(Boolean);
    if (!parts.length) continue;
    if (!isPlainObject(result)) result = {};
    setNested(result, parts, clone(doc.value));
  }

  return result === undefined ? null : result;
}

function parseFirebaseValue(raw) {
  if (raw === undefined) return undefined;
  try { return JSON.parse(String(raw)); } catch (_) { return String(raw); }
}

function fieldValue(row, key, field) {
  if (field === '$key') return key;
  if (field === '$value') return row;
  return getNested(row, String(field || '').split('/').filter(Boolean));
}

function compareValues(a, b) {
  if (a === b) return 0;
  if (a === undefined || a === null) return -1;
  if (b === undefined || b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'en', { numeric: true });
}

function objectFromEntries(entries) {
  const out = {};
  for (const [key, value] of entries) out[key] = value;
  return out;
}

function applyQuery(value, query) {
  if (query.shallow === 'true' || query.shallow === true) {
    if (!value || typeof value !== 'object') return value === null ? null : true;
    const out = {};
    Object.keys(value).filter(k => !String(k).startsWith('__')).forEach(k => { out[k] = true; });
    return out;
  }

  const hasQuery = query.orderBy !== undefined || query.equalTo !== undefined || query.limitToLast !== undefined || query.limitToFirst !== undefined;
  if (!hasQuery || !value || typeof value !== 'object' || Array.isArray(value)) return value;

  let entries = Object.entries(value).filter(([key]) => !String(key).startsWith('__'));
  if (query.orderBy !== undefined) {
    const orderBy = parseFirebaseValue(query.orderBy);
    if (query.equalTo !== undefined) {
      const eq = parseFirebaseValue(query.equalTo);
      entries = entries.filter(([key, row]) => fieldValue(row, key, orderBy) == eq);
    }
    entries.sort((a, b) => compareValues(fieldValue(a[1], a[0], orderBy), fieldValue(b[1], b[0], orderBy)));
  }
  if (query.limitToFirst !== undefined) {
    const limit = Math.max(0, Number(query.limitToFirst) || 0);
    if (limit) entries = entries.slice(0, limit);
  }
  if (query.limitToLast !== undefined) {
    const limit = Math.max(0, Number(query.limitToLast) || 0);
    if (limit) entries = entries.slice(Math.max(0, entries.length - limit));
  }
  return objectFromEntries(entries);
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return JSON.parse(req.body.toString('utf8') || 'null');
    if (typeof req.body === 'string') return JSON.parse(req.body || 'null');
    return req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : null;
}

async function putNode(collection, path, value) {
  const prefix = path ? path + '/' : '';
  if (value === null) {
    if (!path) await collection.deleteMany({});
    else await collection.deleteMany({ $or: [{ path }, { path: { $regex: new RegExp('^' + escapeRegex(prefix)) } }] });
    return null;
  }
  if (path) await collection.deleteMany({ path: { $regex: new RegExp('^' + escapeRegex(prefix)) } });
  await collection.updateOne(
    { path },
    { $set: { path, value, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return value;
}

async function patchNode(collection, path, patch) {
  if (!isPlainObject(patch)) return putNode(collection, path, patch);
  const exact = await collection.findOne({ path });
  const current = isPlainObject(exact && exact.value) ? clone(exact.value) : {};
  for (const [key, value] of Object.entries(patch)) {
    const childPath = path ? path + '/' + key : key;
    if (value === null) {
      delete current[key];
      await collection.deleteMany({ $or: [{ path: childPath }, { path: { $regex: new RegExp('^' + escapeRegex(childPath + '/')) } }] });
    } else {
      current[key] = value;
    }
  }
  await collection.updateOne(
    { path },
    { $set: { path, value: current, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return current;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, PATCH, DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const path = normalizePath(req.query && req.query.path);
    const collection = await getCollection();

    if (req.method === 'GET') {
      const value = await getNode(collection, path);
      return res.status(200).json(applyQuery(value, req.query || {}));
    }

    if (req.method === 'PUT') {
      const body = await readJsonBody(req);
      const saved = await putNode(collection, path, body);
      return res.status(200).json(saved);
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const saved = await patchNode(collection, path, body);
      return res.status(200).json(saved);
    }

    if (req.method === 'DELETE') {
      await putNode(collection, path, null);
      return res.status(200).json(null);
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      const childPath = path ? path + '/' + id : id;
      await putNode(collection, childPath, body);
      return res.status(200).json({ name: id });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Mongo RTDB API error:', error);
    return res.status(500).json({ error: error.message || 'Database error' });
  }
};
