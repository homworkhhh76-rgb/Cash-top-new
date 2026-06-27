(function(){
  const CHECK_KEY='cashtop_last_update_probe_v169';
  async function oscarCheckUpdate(force=false){
    try{
      const last=Number(localStorage.getItem(CHECK_KEY)||0);
      if(!force && Date.now()-last < 12*60*60*1000) return null;
      localStorage.setItem(CHECK_KEY,String(Date.now()));
      const res=await fetch('app-version.json?ts='+Date.now(),{cache:'no-store'});
      const info=await res.json();
      const old=localStorage.getItem('oscarAppVersion');
      localStorage.setItem('oscarAppVersion', info.version||'');
      return info;
    }catch(e){ return null; }
  }
  window.oscarCheckUpdate=oscarCheckUpdate;
  if('requestIdleCallback' in window) requestIdleCallback(()=>oscarCheckUpdate(false),{timeout:9000});
  else setTimeout(()=>oscarCheckUpdate(false),9000);
})();
