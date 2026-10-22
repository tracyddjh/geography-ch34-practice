const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
function sheet(name){
 const rows=[];
 return {
  name,rows,getLastRow:()=>rows.length,appendRow:r=>rows.push(r.slice()),setFrozenRows(){},
  getDataRange(){return {getValues:()=>rows.map(r=>r.slice())}},
  getRange(row,col,height=1,width=1){return {
   getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j])),
   setValues:v=>v.forEach((r,i)=>r.forEach((c,j)=>{(rows[row-1+i]||=[])[col-1+j]=c})),
   createTextFinder(value){return {
    matchEntireCell(){return this},
    findNext(){const i=rows.findIndex((r,i)=>i>=row-1&&i<row-1+height&&String(r[col-1])===String(value));return i<0?null:{getRow:()=>i+1}}
   }}
  }}
 };
}
const sheets=new Map(),props=new Map(),cache=new Map();const ss={getId:()=> 'test-sheet',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet(n);sheets.set(n,s);return s;}};
const ctx={console:{error(){}},Date,Number,JSON,Object,String,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,flush(){}},PropertiesService:{getScriptProperties:()=>({setProperty:(k,v)=>props.set(k,v),getProperty:k=>props.get(k)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:text=>({text,setMimeType(){return this}})}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('gas/Code.gs','utf8'),ctx);ctx.setup();
const identity={className:'802',seat:'15',name:'測試學生'},trainingId=crypto.randomUUID();
const answers=vm.runInContext('ANSWERS',ctx);const events=[];
function event(q,a){return {assignmentId:'geography-ch34-v2',trainingId,student:identity,questionId:q,selected:a,eventId:crypto.randomUUID(),receiptToken:crypto.randomUUID(),createdAt:new Date().toISOString()};}
function send(d){return JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(d)}}).text);}
for(let round=0;round<2;round++)for(const [q,a] of Object.entries(answers)){const e=event(q,round===0&&q==='3-1'?(a+1)%4:a);events.push(e);assert(send(e).ok);assert(send(e).ok);}
assert.equal(sheets.get('答題紀錄').rows.length,41,'Retries deduplicated');
let row=sheets.get('成績總表').rows[1];assert.equal(row[5],95);assert.equal(row[6],20);assert.equal(row[13],19);
const last=event('3-1',answers['3-1']);assert(send(last).ok);row=sheets.get('成績總表').rows[1];assert.equal(row[5],95);assert.equal(row[13],20);assert.equal(row[10],41);assert.equal(row[11],40);
const ack=ctx.doGet({parameter:{action:'receipt',eventId:last.eventId,receiptToken:last.receiptToken,callback:'geoReceipt_'+crypto.randomUUID().replace(/-/g,'')}});assert(ack.text.includes('"ok":true'));assert(!ack.text.includes(identity.name));
assert(!send({...last,selected:1}).ok,'Changed duplicate rejected');
assert(!send({...last,eventId:crypto.randomUUID(),student:{...identity,name:''}}).ok);
console.log('PASS GAS: server answer keys, 95/100 first score, 20/20 mastery, 41 attempts, duplicate protection, identity validation, receipt excludes student data.');

(async()=>{
 const local=new Map();let receiver=false,posts=0;
 const win={GEO_CONFIG:{gasUrl:'https://script.google.com/macros/s/TEST/exec'},addEventListener(){},dispatchEvent(){}};
 const front={window:win,localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},navigator:{onLine:false},URL,JSON,Array,Promise,Error,crypto:crypto.webcrypto,CustomEvent:class{},setInterval(){},setTimeout(){return 1},clearTimeout(){},fetch:async()=>{posts++},document:{createElement:()=>({remove(){}}),head:{appendChild(script){const cb=new URL(script.src).searchParams.get('callback');win[cb]({ok:receiver});}}}};
 vm.createContext(front);vm.runInContext(fs.readFileSync('dist/reporting.js','utf8'),front);
 const reporter=win.GEO_REPORTER;reporter.enqueue({student:identity,trainingId,questionId:'3-1',selected:0});assert.equal(reporter.status().pending,1);
 front.navigator.onLine=true;await reporter.flush();assert.equal(posts,1);assert.equal(reporter.status().pending,1,'Opaque POST alone must not clear event');
 const id=JSON.parse(local.get('geo34-delivery-v2'))[0].eventId;
 receiver=true;await reporter.flush();assert.equal(reporter.status().pending,0);assert.equal(reporter.status().confirmed,1);assert.equal(JSON.parse(local.get('geo34-delivery-v2')).length,0);
 assert(id);console.log('PASS reporting: offline queue retained, unconfirmed POST retained, acknowledged retry cleared.');
})().catch(e=>{console.error(e);process.exitCode=1});

