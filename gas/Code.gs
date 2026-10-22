/** 地理第3–4課成績接收器。綁定到老師的 Google 試算表。
 * 初次部署前執行 setup()，授權後以「自己／所有人」部署網頁應用程式。
 * doGet 提供收件確認與只含班級座號的挑戰排行榜，不公開姓名。
 */
const ASSIGNMENT_ID = 'geography-ch34-v2';
const ANSWERS = {
  '3-1':0,'3-2':3,'3-3':3,'3-4':2,'3-5':0,
  '3-6':1,'3-7':3,'3-8':1,'3-9':1,'3-10':2,
  '4-1':1,'4-2':2,'4-3':3,'4-4':1,'4-5':1,
  '4-6':0,'4-7':2,'4-8':3,'4-9':0,'4-10':3
};
const LOG_HEADERS=['事件ID','收件確認碼','伺服器收件時間','作業ID','練習ID','班級','座號','姓名','題目ID','學生答案','是否答對','學生作答時間'];
const SUMMARY_HEADERS=['識別碼','更新時間','班級','座號','姓名','首次作答成績（100分）','首答已作答題數','首答答對題數','首答第3課成績（100分）','首答第4課成績（100分）','總作答次數','總答對次數','累計正確率（%）','精熟題數（20題）','精熟率（%）','練習ID'];

function setup(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  if(!ss)throw new Error('請從成績試算表的「擴充功能 → Apps Script」開啟此程式');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',ss.getId());
  ensureSheet_(ss,'答題紀錄',LOG_HEADERS);
  ensureSheet_(ss,'成績總表',SUMMARY_HEADERS);
}
function spreadsheet_(){
  const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if(!id)throw new Error('請先執行 setup');
  return SpreadsheetApp.openById(id);
}
function ensureSheet_(ss,name,headers){
  let sh=ss.getSheetByName(name)||ss.insertSheet(name);
  if(sh.getLastRow()===0){sh.appendRow(headers);sh.setFrozenRows(1);}
  else if(sh.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|'))throw new Error(name+'欄位與接收器版本不符，請使用新的成績試算表');
  return sh;
}
function safeText_(s){s=String(s);return /^[=+@-]/.test(s)?"'"+s:s;}
function questionId_(value,ss){return value instanceof Date?Utilities.formatDate(value,ss.getSpreadsheetTimeZone(),'M-d'):String(value);}
function validate_(d){
  if(d.assignmentId!==ASSIGNMENT_ID)throw new Error('作業ID不符');
  for(const key of ['eventId','receiptToken','trainingId'])if(!/^[a-f0-9-]{36}$/i.test(d[key]||''))throw new Error('紀錄識別碼格式錯誤');
  if(!d.student||typeof d.student!=='object')throw new Error('缺少學生資料');
  for(const key of ['className','seat','name'])if(typeof d.student[key]!=='string'||!d.student[key].trim()||d.student[key].length>40)throw new Error('學生資料格式錯誤');
  if(!/^\d{1,3}$/.test(d.student.seat)||Number(d.student.seat)<1)throw new Error('座號格式錯誤');
  if(!d.type&&(!Object.prototype.hasOwnProperty.call(ANSWERS,d.questionId)||!Number.isInteger(d.selected)||d.selected<0||d.selected>3))throw new Error('題目或選項格式錯誤');
  if(!Number.isFinite(Date.parse(d.createdAt)))throw new Error('作答時間格式錯誤');
}
function doPost(e){
  let lock;
  try{
    if(!e||!e.postData||e.postData.contents.length>5000)throw new Error('無效的請求');
    const d=JSON.parse(e.postData.contents);validate_(d);
    lock=LockService.getScriptLock();lock.waitLock(25000);
    const ss=spreadsheet_();
    if(d.type)return challengePost_(ss,d);
    const log=ensureSheet_(ss,'答題紀錄',LOG_HEADERS);
    const found=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
    if(found){
      const row=log.getRange(found.getRow(),1,1,12).getValues()[0];
      if(String(row[1])!==d.receiptToken||row[3]!==d.assignmentId||row[4]!==d.trainingId||String(row[5])!==safeText_(d.student.className.trim())||String(row[6])!==d.student.seat||String(row[7])!==safeText_(d.student.name.trim())||questionId_(row[8],ss)!==d.questionId||row[9]!=='ABCD'[d.selected])throw new Error('重複事件的內容不符');
    }else{
      log.getRange(log.getLastRow()+1,9).setNumberFormat('@');
      log.appendRow([d.eventId,d.receiptToken,new Date(),d.assignmentId,d.trainingId,safeText_(d.student.className.trim()),d.student.seat,safeText_(d.student.name.trim()),d.questionId,'ABCD'[d.selected],d.selected===ANSWERS[d.questionId],d.createdAt]);
    }
    // Also rebuild for duplicate retries, in case the prior summary update failed.
    updateSummary_(ss,d);SpreadsheetApp.flush();
    CacheService.getScriptCache().put(d.eventId,JSON.stringify({token:d.receiptToken,ok:true}),21600);
    return json_({ok:true});
  }catch(error){console.error(String(error));return json_({ok:false,error:'寫入失敗，請確認部署及資料格式'});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
function updateSummary_(ss,d){
  const log=ss.getSheetByName('答題紀錄'),rows=log.getDataRange().getValues().slice(1);
  const first={},wins={};let attempts=0,correct=0;
  const cls=safeText_(d.student.className.trim()),name=safeText_(d.student.name.trim());
  rows.filter(r=>r[3]===d.assignmentId&&r[4]===d.trainingId&&String(r[5])===cls&&String(r[6])===d.student.seat&&String(r[7])===name).forEach(r=>{
    attempts++;const yes=r[10]===true||r[10]==='TRUE';if(yes)correct++;
    const qid=questionId_(r[8],ss);
    if(!Object.prototype.hasOwnProperty.call(first,qid))first[qid]=yes;
    wins[qid]=(wins[qid]||0)+(yes?1:0);
  });
  const keys=Object.keys(first),n=keys.length,firstCorrect=keys.filter(k=>first[k]).length;
  // Grade uses the fixed syllabus denominator, so unanswered questions are not a 100.
  const firstGrade=firstCorrect*5;
  const chGrade=ch=>keys.filter(k=>k.startsWith(ch+'-')&&first[k]).length*10;
  const mastered=Object.keys(wins).filter(k=>wins[k]>=2).length;
  const id=JSON.stringify([d.assignmentId,d.trainingId,d.student.className.trim(),d.student.seat,d.student.name.trim()]);
  const sheet=ensureSheet_(ss,'成績總表',SUMMARY_HEADERS);
  const found=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext():null;
  const values=[id,new Date(),cls,d.student.seat,name,firstGrade,n,firstCorrect,chGrade(3),chGrade(4),attempts,correct,Math.round(correct/attempts*10000)/100,mastered,mastered*5,d.trainingId];
  if(found)sheet.getRange(found.getRow(),1,1,values.length).setValues([values]);else sheet.appendRow(values);
}
function doGet(e){
  const p=e&&e.parameter||{};
  if(p.action==='challengeInfo'||p.action==='leaderboard')return challengeGet_(p);
  if(p.action!=='receipt')return json_({ok:true,service:'geography-ch34-v2',message:'成績接收器已啟用；此網址不提供學生名單或成績查詢。'});
  if(!/^geoReceipt_[a-f0-9]{32}$/i.test(p.callback||''))return json_({ok:false,error:'無效的回呼格式'});
  let ok=false,result;
  try{const sh=spreadsheet_().getSheetByName('挑戰收件');if(sh){const row=sh.getDataRange().getValues().slice(1).find(r=>r[0]===p.eventId&&r[1]===p.receiptToken);if(row){ok=true;result=JSON.parse(row[2]);}}}catch(error){console.error(String(error));}
  if(/^[a-f0-9-]{36}$/i.test(p.eventId||'')&&/^[a-f0-9-]{36}$/i.test(p.receiptToken||'')){
    try{const cached=JSON.parse(CacheService.getScriptCache().get(p.eventId)||'null');ok=ok||!!cached&&cached.ok===true&&cached.token===p.receiptToken;}catch(error){console.error(String(error));}
  }
  // Only a receipt is returned; no class, name, score, or answer is exposed by GET.
  return ContentService.createTextOutput(p.callback+'('+JSON.stringify({ok:ok,result:result,error:ok?null:'尚未確認寫入；請稍後重試'})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

// 三場固定題組；只在學生端打亂題序。答案、精熟資格與排名皆由伺服器計算。
const CHALLENGE_VERSION='ch34-cup-v1';
const CHALLENGE_ROUNDS=[
 ['3-6','3-5','3-2','3-4','3-1','4-5','4-6','4-4','4-7','4-1'],
 ['3-2','3-1','3-9','3-8','3-10','4-4','4-9','4-6','4-5','4-10'],
 ['3-5','3-3','3-1','3-4','3-7','4-5','4-2','4-10','4-7','4-1']
];
const CUP_HEADERS=['識別碼','班級','座號','場次','練習ID','挑戰ID','開始時間','完成時間','答對題數','秒數','答案'];
const CUP_RECEIPTS=['事件ID','確認碼','回覆'];
function cupKey_(d){return JSON.stringify([CHALLENGE_VERSION,d.student.className.trim(),String(Number(d.student.seat)),d.round]);}
function cupRows_(ss){return ensureSheet_(ss,'挑戰成績',CUP_HEADERS).getDataRange().getValues().slice(1);}
function hasMastery_(ss,d){
 const sh=ss.getSheetByName('答題紀錄');if(!sh)return false;
 const wins={};
 sh.getDataRange().getValues().slice(1).filter(r=>r[3]===ASSIGNMENT_ID&&r[4]===d.trainingId&&String(r[5])===safeText_(d.student.className.trim())&&String(r[6])===d.student.seat&&String(r[7])===safeText_(d.student.name.trim())).forEach(r=>{const qid=questionId_(r[8],ss);if(r[10]===true||r[10]==='TRUE')wins[qid]=(wins[qid]||0)+1;});
 return Object.keys(ANSWERS).every(q=>wins[q]>=2);
}
function challengePost_(ss,d){
 if(!['challengeStart','challengeFinish'].includes(d.type)||!Number.isInteger(d.round)||d.round<1||d.round>3)throw new Error('挑戰場次錯誤');
 const receipts=ensureSheet_(ss,'挑戰收件',CUP_RECEIPTS);
 const prior=receipts.getDataRange().getValues().slice(1).find(r=>r[0]===d.eventId);
 if(prior){if(prior[1]!==d.receiptToken)throw new Error('確認碼錯誤');return json_({ok:true});}
 const sheet=ensureSheet_(ss,'挑戰成績',CUP_HEADERS),rows=cupRows_(ss);
 const matches=r=>String(r[1])===safeText_(d.student.className.trim())&&String(r[2])===String(Number(d.student.seat))&&Number(r[3])===d.round&&r[4]===d.trainingId;
 const idx=d.type==='challengeFinish'?rows.findIndex(r=>matches(r)&&r[5]===d.attemptId):rows.findIndex(r=>matches(r)&&!r[7]);
 const row=idx<0?null:rows[idx];
 let result;
 if(d.type==='challengeStart'){
  if(!hasMastery_(ss,d))result={ok:false,error:'老師端尚未確認全部精熟，請先回首頁重試回傳，再進入挑戰。'};
  else {
   const started=row?new Date(row[6]).getTime():Date.now(),attemptId=row?row[5]:d.eventId;
   let order;
   if(row){try{order=JSON.parse(row[10]).order;}catch{}}
   if(!order){
    order=CHALLENGE_ROUNDS[d.round-1].slice();
    for(let i=order.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const x=order[i];order[i]=order[j];order[j]=x;}
    const previous=rows.filter(r=>String(r[1])===safeText_(d.student.className.trim())&&String(r[2])===String(Number(d.student.seat))&&Number(r[3])===d.round).pop();
    if(previous){try{const saved=JSON.parse(previous[10]),last=Array.isArray(saved)?saved.map(a=>a.questionId):saved.order;if(JSON.stringify(last)===JSON.stringify(order)){const x=order[0];order[0]=order[1];order[1]=x;}}catch{}}
   }
   if(!row)sheet.appendRow([cupKey_(d)+'|'+attemptId,safeText_(d.student.className.trim()),String(Number(d.student.seat)),d.round,d.trainingId,attemptId,new Date(started),'','','',JSON.stringify({order})]);
   result={ok:true,attemptId,order,startedAt:started,serverNow:Date.now()};
  }
 }else{
  if(!row||row[4]!==d.trainingId||row[5]!==d.attemptId)throw new Error('找不到挑戰');
  if(row[7])result={ok:true,completed:true,correct:Number(row[8]),elapsed:Number(row[9])};
  else {
   const ids=CHALLENGE_ROUNDS[d.round-1];
   if(!Array.isArray(d.answers)||d.answers.length!==10||new Set(d.answers.map(a=>a.questionId)).size!==10||d.answers.some(a=>!ids.includes(a.questionId)||!Number.isInteger(a.selected)||a.selected<0||a.selected>3))throw new Error('挑戰答案不完整');
   if(row[10]){const expected=JSON.parse(row[10]).order;if(expected&&JSON.stringify(expected)!==JSON.stringify(d.answers.map(a=>a.questionId)))throw new Error('挑戰題序不符');}
   const correct=d.answers.filter(a=>ANSWERS[a.questionId]===a.selected).length,elapsed=Math.max(1,Math.ceil((Date.now()-new Date(row[6]).getTime())/1000));
   sheet.getRange(idx+2,8,1,4).setValues([[new Date(),correct,elapsed,JSON.stringify(d.answers)]]);
   result={ok:true,completed:true,correct,elapsed};
  }
 }
 receipts.appendRow([d.eventId,d.receiptToken,JSON.stringify(result)]);SpreadsheetApp.flush();return json_({ok:true});
}
function challengeGet_(p){
 if(!/^geoCup_[a-f0-9]{32}$/i.test(p.callback||''))return json_({ok:false,error:'無效的回呼'});
 let data;
 try{
  if(p.action==='challengeInfo')data={ok:true,version:CHALLENGE_VERSION,rounds:CHALLENGE_ROUNDS};
  else {
   const round=Number(p.round),cls=String(p.className||'').trim();
   if(!cls||cls.length>40||![1,2,3].includes(round))throw new Error('請選擇班級與場次');
   const best={};cupRows_(spreadsheet_()).filter(r=>String(r[1])===safeText_(cls)&&Number(r[3])===round&&r[7]).forEach(r=>{const key=String(r[2]),old=best[key];if(!old||Number(r[8])>Number(old[8])||Number(r[8])===Number(old[8])&&Number(r[9])<Number(old[9]))best[key]=r;});
   const rows=Object.values(best).sort((a,b)=>Number(b[8])-Number(a[8])||Number(a[9])-Number(b[9]));
   let rank=0,previous;const board=rows.map((r,i)=>{const tie=r[8]+'|'+r[9];if(tie!==previous)rank=i+1;previous=tie;return {rank,className:cls,seat:String(r[2]),correct:Number(r[8]),elapsed:Number(r[9])};});
   data={ok:true,version:CHALLENGE_VERSION,rows:board.slice(0,500)};
  }
 }catch(error){data={ok:false,error:'排行榜暫時無法讀取，請稍後重試'};}
 // Public projection contains no student names, training IDs, or receipt tokens.
 return ContentService.createTextOutput(p.callback+'('+JSON.stringify(data)+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
