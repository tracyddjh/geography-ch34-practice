/* Durable delivery queue. A no-cors POST is NOT an acknowledgement: verify the
   opaque receipt with GAS doGet before removing an event from local storage. */
(() => {
  'use strict';
  const STORAGE='geo-industry-delivery-v1';
  let queue=[],busy=false,lastError='',confirmed=0;
  try { queue=JSON.parse(localStorage.getItem(STORAGE)||'[]'); if(!Array.isArray(queue))queue=[]; } catch { lastError='無法讀取本機回傳佇列'; }
  function config(){return window.GEO_CONFIG||{};}
  function validUrl(value){try{const u=new URL(value);return u.origin==='https://script.google.com'&&/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(u.pathname)&&!u.search&&!u.hash;}catch{return false;}}
  function uuid(){return crypto.randomUUID();}
  function notify(){window.dispatchEvent(new CustomEvent('self-study-delivery-change'));}
  function save(){localStorage.setItem(STORAGE,JSON.stringify(queue));}
  function status(){return {configured:validUrl(config().gasUrl),pending:queue.length,busy,lastError,confirmed};}
  function enqueue(event){
    const item={...event,assignmentId:config().assignmentId||'geography-ch34-v2',eventId:uuid(),receiptToken:uuid(),createdAt:new Date().toISOString()};
    queue.push(item);
    try{save();}catch{lastError='瀏覽器無法儲存回傳佇列，請勿關閉網頁，請匯出紀錄';}
    notify();flush();return item.eventId;
  }
  async function receipt(url,item){
    const callback='geoReceipt_'+uuid().replace(/-/g,'');
    const u=new URL(url);u.searchParams.set('action','receipt');u.searchParams.set('eventId',item.eventId);u.searchParams.set('receiptToken',item.receiptToken);u.searchParams.set('callback',callback);
    const control=new AbortController(),timer=setTimeout(()=>control.abort(),20000);
    try{
      const response=await fetch(u.href,{credentials:'omit',mode:'cors',signal:control.signal});
      if(!response.ok)throw new Error('無法確認 GAS 回覆，請稍後重試');
      const text=await response.text(),prefix=callback+'(';
      if(!text.startsWith(prefix)||!text.endsWith(');'))throw new Error('收件回覆格式不符');
      return JSON.parse(text.slice(prefix.length,-2));
    }finally{clearTimeout(timer);}
  }
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
        window.dispatchEvent(new CustomEvent('self-study-rpc-result',{detail:{eventId:item.eventId,result:response.result}}));
      }
    }catch(error){lastError=error.message||'回傳失敗，紀錄保留等待重試';}
    finally{busy=false;notify();}
  }
  function exportPending(){return JSON.stringify({format:'geo34-pending-v2',events:queue},null,2);}
  function request(event){return new Promise((resolve,reject)=>{
    let id,timer;const listener=e=>{if(e.detail.eventId!==id)return;clearTimeout(timer);window.removeEventListener('self-study-rpc-result',listener);resolve(e.detail.result);};
    window.addEventListener('self-study-rpc-result',listener);id=enqueue(event);
    timer=setTimeout(()=>{window.removeEventListener('self-study-rpc-result',listener);reject(new Error('尚未收到確認；資料已保留，請回首頁重試回傳後再進入挑戰。'));},60000);
  });}
  window.SELF_STUDY_REPORTER={enqueue,flush,status,exportPending,validUrl,request};
  window.addEventListener('online',flush);
  setInterval(flush,30000);
  setTimeout(flush,1000);
})();
