async function oscarCheckUpdate(){
  try{
    const res = await fetch('app-version.json?ts=' + Date.now(), {cache:'no-store'});
    const info = await res.json();
    const old = localStorage.getItem('oscarAppVersion');
    if(old && old !== info.version && navigator.serviceWorker?.controller){
      console.log('Oscar update available', old, info.version);
    }
    localStorage.setItem('oscarAppVersion', info.version);
    return info;
  }catch(e){return null;}
}
oscarCheckUpdate();
