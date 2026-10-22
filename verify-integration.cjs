const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
function sheet(name){
 const rows=[];
 return {
  name,rows,getLastRow:()=>rows.length,appendRow:r=>rows.push(r.slice()),setFrozenRows(){},
  getDataRange(){return {getValues:()=>rows.map(r=>r.slice())}},
  getRange(row,col,height=1,width=1){return {
   setNumberFormat(){},getValues:()=>Array.from({length:height},(_,i)=>Array.from({length:width},(_,j)=>rows[row-1+i]?.[col-1+j])),
   setValues:v=>v.forEach((r,i)=>r.forEach((c,j)=>{(rows[row-1+i]||=[])[col-1+j]=c})),
   createTextFinder(value){return {
    matchEntireCell(){return this},
    findNext(){const i=rows.findIndex((r,i)=>i>=row-1&&i<row-1+height&&String(r[col-1])===String(value));return i<0?null:{getRow:()=>i+1}}
   }}
  }}
 };
}
const sheets=new Map(),props=new Map(),cache=new Map();const ss={getId:()=> 'test-sheet',getSpreadsheetTimeZone:()=> 'Asia/Taipei',getSheetByName:n=>sheets.get(n),insertSheet:n=>{const s=sheet(n);sheets.set(n,s);return s;}};
const ctx={console:{error(){}},Date,Number,JSON,Object,String,SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,flush(){}},PropertiesService:{getScriptProperties:()=>({setProperty:(k,v)=>props.set(k,v),getProperty:k=>props.get(k)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v)})},LockService:{getScriptLock:()=>({waitLock(){},hasLock:()=>true,releaseLock(){}})},ContentService:{MimeType:{JSON:'json',JAVASCRIPT:'javascript'},createTextOutput:text=>({text,setMimeType(){return this}})}};
ctx.Utilities={formatDate:d=>(d.getUTCMonth()+1)+'-'+d.getUTCDate()};
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

const cupRounds=vm.runInContext('CHALLENGE_ROUNDS',ctx);
// Reproduce Sheets coercing IDs such as 3-1 into dates in historical records.
for(const r of sheets.get('答題紀錄').rows.slice(1)){const [m,d]=r[8].split('-').map(Number);r[8]=new Date(Date.UTC(2026,m-1,d));}
assert(send(last).ok,'Legacy date-typed question IDs remain retryable');
assert.equal(sheets.get('成績總表').rows[1][8],90,'Historical chapter grade repaired');assert.equal(sheets.get('成績總表').rows[1][9],100);
for(const ids of cupRounds){assert.equal(ids.length,10);assert.equal(new Set(ids).size,10);assert.equal(ids.filter(id=>id.startsWith('3-')).length,5);assert.equal(ids.filter(id=>id.startsWith('4-')).length,5);}
function cup(type,round,extras={}){const d={...event('3-1',0),type,round,...extras};assert(send(d).ok);const receipt=ctx.doGet({parameter:{action:'receipt',eventId:d.eventId,receiptToken:d.receiptToken,callback:'geoReceipt_'+crypto.randomUUID().replace(/-/g,'')}}).text;return {d,result:JSON.parse(receipt.slice(receipt.indexOf('(')+1,-2)).result};}
assert.equal(cup('challengeStart',1,{trainingId:crypto.randomUUID()}).result.ok,false,'Client mastery alone does not unlock');
const started=cup('challengeStart',1);assert(started.result.attemptId);
const duplicateStart=cup('challengeStart',1);assert.equal(duplicateStart.result.attemptId,started.result.attemptId,'Resume same formal attempt');
const responses=started.result.order.map(questionId=>({questionId,selected:answers[questionId]}));
const finished=cup('challengeFinish',1,{attemptId:started.result.attemptId,answers:responses});assert.equal(finished.result.correct,10);
assert(send(finished.d).ok,'Idempotent finish retry');
const changed=cup('challengeFinish',1,{attemptId:started.result.attemptId,answers:responses.map(a=>({...a,selected:(a.selected+1)%4}))});assert.equal(changed.result.correct,10,'First completion immutable');
function board(cls,round){const text=ctx.doGet({parameter:{action:'leaderboard',className:cls,round:String(round),callback:'geoCup_'+crypto.randomUUID().replace(/-/g,'')}}).text;return JSON.parse(text.slice(text.indexOf('(')+1,-2));}
const publicBoard=board('802',1);assert.equal(publicBoard.rows.length,1);assert.equal(publicBoard.rows[0].seat,'15');assert.equal(publicBoard.rows[0].correct,10);assert.equal(board('801',1).rows.length,0);assert.equal(board('802',2).rows.length,0);
assert(!JSON.stringify(publicBoard).includes(identity.name));assert(!JSON.stringify(publicBoard).includes(trainingId));
assert(!send({...event('3-1',0),type:'challengeFinish',round:2,attemptId:crypto.randomUUID(),answers:responses}).ok);
const again=cup('challengeStart',1);assert.notEqual(again.result.attemptId,started.result.attemptId,'New competition allowed after completion');
assert.notEqual(JSON.stringify(again.result.order),JSON.stringify(started.result.order),'Next formal order differs');
const lower=cup('challengeFinish',1,{attemptId:again.result.attemptId,answers:again.result.order.map(questionId=>({questionId,selected:(answers[questionId]+1)%4}))});assert.equal(lower.result.correct,0);assert.equal(board('802',1).rows.length,1);assert.equal(board('802',1).rows[0].correct,10,'Lower replay cannot replace best');
const stage2=cup('challengeStart',2),stage2answers=stage2.result.order.map(questionId=>({questionId,selected:answers[questionId]}));
cup('challengeFinish',2,{attemptId:stage2.result.attemptId,answers:stage2answers.map(a=>({...a,selected:(a.selected+1)%4}))});assert.equal(board('802',2).rows[0].correct,0);
const improve=cup('challengeStart',2);cup('challengeFinish',2,{attemptId:improve.result.attemptId,answers:improve.result.order.map(questionId=>({questionId,selected:answers[questionId]}))});assert.equal(board('802',2).rows[0].correct,10,'Higher replay replaces best');
vm.runInContext('Math.random=()=>0',ctx);
let lastOrder;
for(let i=0;i<3;i++){const trial=cup('challengeStart',3);assert.equal(new Set(trial.result.order).size,10);if(lastOrder)assert.notEqual(JSON.stringify(lastOrder),JSON.stringify(trial.result.order),'Server avoids repeated order even for identical random draws');lastOrder=trial.result.order;cup('challengeFinish',3,{attemptId:trial.result.attemptId,answers:trial.result.order.map(questionId=>({questionId,selected:answers[questionId]}))});}
console.log('PASS cup: fixed balanced rounds; server mastery gate; resume; immutable attempt; repeat competitions preserve best score; class/round isolation; public board excludes names and IDs.');

(async()=>{
 const local=new Map();let receiver=false,posts=0;
 const win={GEO_CONFIG:{gasUrl:'https://script.google.com/macros/s/TEST/exec'},addEventListener(){},dispatchEvent(){}};
 const front={window:win,localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)},navigator:{onLine:false},URL,JSON,Array,Promise,Error,AbortController,crypto:crypto.webcrypto,CustomEvent:class{},setInterval(){},setTimeout(){return 1},clearTimeout(){},fetch:async(url,options)=>{if(options.method==='POST'){posts++;return;}assert.equal(options.credentials,'omit');return {ok:true,text:async()=>new URL(url).searchParams.get('callback')+'('+JSON.stringify({ok:receiver})+');'};}};
 vm.createContext(front);vm.runInContext(fs.readFileSync('dist/reporting.js','utf8'),front);
 const reporter=win.GEO_REPORTER;reporter.enqueue({student:identity,trainingId,questionId:'3-1',selected:0});assert.equal(reporter.status().pending,1);
 front.navigator.onLine=true;await reporter.flush();assert.equal(posts,1);assert.equal(reporter.status().pending,1,'Opaque POST alone must not clear event');
 const id=JSON.parse(local.get('geo34-delivery-v2'))[0].eventId;
 receiver=true;await reporter.flush();assert.equal(reporter.status().pending,0);assert.equal(reporter.status().confirmed,1);assert.equal(JSON.parse(local.get('geo34-delivery-v2')).length,0);
 assert(id);console.log('PASS reporting: offline queue retained, unconfirmed POST retained, acknowledged retry cleared.');
})().catch(e=>{console.error(e);process.exitCode=1});

