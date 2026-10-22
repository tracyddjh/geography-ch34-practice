/** 地理第3–4課成績接收器。綁定到老師的 Google 試算表。
 * 初次部署前執行 setup()，授權後以「自己／所有人」部署網頁應用程式。
 * doGet 只回傳不含學生資料的收件確認，不提供成績或名單查詢。
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
function validate_(d){
  if(d.assignmentId!==ASSIGNMENT_ID)throw new Error('作業ID不符');
  for(const key of ['eventId','receiptToken','trainingId'])if(!/^[a-f0-9-]{36}$/i.test(d[key]||''))throw new Error('紀錄識別碼格式錯誤');
  if(!d.student||typeof d.student!=='object')throw new Error('缺少學生資料');
  for(const key of ['className','seat','name'])if(typeof d.student[key]!=='string'||!d.student[key].trim()||d.student[key].length>40)throw new Error('學生資料格式錯誤');
  if(!/^\d{1,3}$/.test(d.student.seat)||Number(d.student.seat)<1)throw new Error('座號格式錯誤');
  if(!Object.prototype.hasOwnProperty.call(ANSWERS,d.questionId)||!Number.isInteger(d.selected)||d.selected<0||d.selected>3)throw new Error('題目或選項格式錯誤');
  if(!Number.isFinite(Date.parse(d.createdAt)))throw new Error('作答時間格式錯誤');
}
function doPost(e){
  let lock;
  try{
    if(!e||!e.postData||e.postData.contents.length>5000)throw new Error('無效的請求');
    const d=JSON.parse(e.postData.contents);validate_(d);
    lock=LockService.getScriptLock();lock.waitLock(25000);
    const ss=spreadsheet_(),log=ensureSheet_(ss,'答題紀錄',LOG_HEADERS);
    const found=log.getLastRow()>1?log.getRange(2,1,log.getLastRow()-1,1).createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
    if(found){
      const row=log.getRange(found.getRow(),1,1,12).getValues()[0];
      if(String(row[1])!==d.receiptToken||row[3]!==d.assignmentId||row[4]!==d.trainingId||String(row[5])!==safeText_(d.student.className.trim())||String(row[6])!==d.student.seat||String(row[7])!==safeText_(d.student.name.trim())||row[8]!==d.questionId||row[9]!=='ABCD'[d.selected])throw new Error('重複事件的內容不符');
    }else{
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
    if(!Object.prototype.hasOwnProperty.call(first,r[8]))first[r[8]]=yes;
    wins[r[8]]=(wins[r[8]]||0)+(yes?1:0);
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
  if(p.action!=='receipt')return json_({ok:true,service:'geography-ch34-v2',message:'成績接收器已啟用；此網址不提供學生名單或成績查詢。'});
  if(!/^geoReceipt_[a-f0-9]{32}$/i.test(p.callback||''))return json_({ok:false,error:'無效的回呼格式'});
  let ok=false;
  if(/^[a-f0-9-]{36}$/i.test(p.eventId||'')&&/^[a-f0-9-]{36}$/i.test(p.receiptToken||'')){
    try{const cached=JSON.parse(CacheService.getScriptCache().get(p.eventId)||'null');ok=!!cached&&cached.ok===true&&cached.token===p.receiptToken;}catch(error){console.error(String(error));}
  }
  // Only a receipt is returned; no class, name, score, or answer is exposed by GET.
  return ContentService.createTextOutput(p.callback+'('+JSON.stringify({ok:ok,error:ok?null:'尚未確認寫入；請稍後重試'})+');').setMimeType(ContentService.MimeType.JAVASCRIPT);
}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
