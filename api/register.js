const { MongoClient } = require("mongodb");

let clientPromise;

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(process.env.MONGODB_URI);
    clientPromise = client.connect();
  }
  return clientPromise;
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      message: "استخدم POST فقط"
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const area = String(body.area || "").trim();
    const product = String(body.product || "").trim();
    const quantity = Number(body.quantity || 1);
    const price = Number(body.price || 0);
    const note = String(body.note || "").trim();

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "الاسم ورقم الجوال مطلوبين"
      });
    }

    const newOrder = {
      name,
      phone,
      area,
      product,
      quantity,
      price,
      note,
      status: "pending",
      orderNumber: "ORD-" + Date.now(),
      createdAt: new Date()
    };

    const client = await getClient();
    const db = client.db(process.env.DB_NAME || "cash");
    const collection = db.collection(process.env.COLLECTION_NAME || "yop");

    const result = await collection.insertOne(newOrder);

    return res.status(201).json({
      success: true,
      message: "تم تسجيل البيانات بنجاح",
      id: result.insertedId,
      orderNumber: newOrder.orderNumber
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "خطأ في السيرفر"
    });
  }
};
