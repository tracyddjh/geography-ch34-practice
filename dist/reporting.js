/* Durable delivery queue. A no-cors POST is NOT an acknowledgement: verify the
   opaque receipt with GAS doGet before removing an event from local storage. */
(() => {
  'use strict';
  const STORAGE='geo34-delivery-v2';
  let queue=[],busy=false,lastError='',confirmed=0;
  try { queue=JSON.parse(localStorage.getItem(STORAGE)||'[]'); if(!Array.isArray(queue))queue=[]; } catch { lastError='無法讀取本機回傳佇列'; }
  function config(){return window.GEO_CONFIG||{};}
  function validUrl(value){try{const u=new URL(value);return u.origin==='https://script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
  function uuid(){return crypto.randomUUID();}
  function notify(){window.dispatchEvent(new CustomEvent('geo-delivery-change'));}
  function save(){localStorage.setItem(STORAGE,JSON.stringify(queue));}
  function status(){return {configured:validUrl(config().gasUrl),pending:queue.length,busy,lastError,confirmed};}
  function enqueue(event){
    const item={...event,assignmentId:config().assignmentId||'geography-ch34-v2',eventId:uuid(),receiptToken:uuid(),createdAt:new Date().toISOString()};
    queue.push(item);
    try{save();}catch{lastError='瀏覽器無法儲存回傳佇列，請勿關閉網頁，請匯出紀錄';}
    notify();flush();return item.eventId;
  }
  function receipt(url,item){return new Promise((resolve,reject)=>{
    const callback='geoReceipt_'+uuid().replace(/-/g,'');
    const script=document.createElement('script');
    let timer;
    function cleanup(){clearTimeout(timer);script.remove();delete window[callback];}
    window[callback]=data=>{cleanup();resolve(data);};
    script.onerror=()=>{cleanup();reject(new Error('無法確認 GAS 回覆，請檢查部署權限與網路'));};
    const u=new URL(url);u.searchParams.set('action','receipt');u.searchParams.set('eventId',item.eventId);u.searchParams.set('receiptToken',item.receiptToken);u.searchParams.set('callback',callback);
    script.src=u.href;timer=setTimeout(()=>{cleanup();reject(new Error('GAS 回覆逾時，紀錄保留等待重試'));},15000);document.head.appendChild(script);
  });}
  async function flush(){
    if(busy||!queue.length||!validUrl(config().gasUrl)||!navigator.onLine)return;
    busy=true;lastError='';notify();
    try{
      while(queue.length){
        const item=queue[0];
        // Simple request avoids an unsupported Apps Script preflight.
        await fetch(config().gasUrl,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(item),redirect:'follow'});
        const response=await receipt(config().gasUrl,item);
        if(!response?.ok)throw new Error(response?.error||'GAS 尚未確認寫入，將保留紀錄再試');
        queue.shift();save();confirmed++;notify();
      }
    }catch(error){lastError=error.message||'回傳失敗，紀錄保留等待重試';}
    finally{busy=false;notify();}
  }
  function exportPending(){return JSON.stringify({format:'geo34-pending-v2',events:queue},null,2);}
  window.GEO_REPORTER={enqueue,flush,status,exportPending,validUrl};
  window.addEventListener('online',flush);
  setInterval(flush,30000);
  setTimeout(flush,1000);
})();
