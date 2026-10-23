// 新增到原成績接收器專案，保留 Code.gs 與 SelfStudy.gs。
function mixedExamIds_(){
  return ['3-1','3-2','3-3','3-4','3-5','3-6','3-7','3-8','3-9','3-10',
    '4-1','4-2','4-3','4-4','4-5','4-6','4-7','4-8','4-9','4-10'];
}
function mixedExamHeaders_(){
  return ['事件ID','收件確認碼','老師收件時間','班級','座號','姓名','分數','答對題數',
    ...mixedExamIds_().map(id=>'第'+id+'題'),
    '學生交卷時間','測驗版本','測驗ID','作答題序','收件核對資料'];
}
function setupMixedExam(){
  const sh=ensureSheet_(spreadsheet_(),'第3–4課習作測驗成績',mixedExamHeaders_());
  sh.setFrozenRows(1);
}
function mixedExamPost_(ss,d){
  const version='mixed-workbook-exam-v1',ids=mixedExamIds_();
  if(d.examVersion!==version)throw new Error('習作測驗版本不符');
  if(!d.answers||typeof d.answers!=='object'||Array.isArray(d.answers)||
    Object.keys(d.answers).length!==20||
    ids.some(id=>!Object.prototype.hasOwnProperty.call(d.answers,id)||
      !Number.isInteger(d.answers[id])||d.answers[id]<0||d.answers[id]>3)){
    throw new Error('必須完整作答20題');
  }
  if(!Array.isArray(d.order)||d.order.length!==20||new Set(d.order).size!==20||
    d.order.some(id=>ids.indexOf(id)<0))throw new Error('作答題序不符');
  const student=[d.student.className.trim(),d.student.seat,d.student.name.trim()];
  const answers=ids.map(id=>d.answers[id]);
  const signature=JSON.stringify([version,d.trainingId,student,answers,d.order,d.createdAt]);
  const headers=mixedExamHeaders_();
  const sh=ensureSheet_(ss,'第3–4課習作測驗成績',headers);
  const found=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1)
    .createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
  const correct=ids.filter(id=>d.answers[id]===ANSWERS[id]).length;
  const result={score:correct*5,correct:correct,total:20,status:'submitted'};
  if(found){
    const row=sh.getRange(found.getRow(),1,1,headers.length).getValues()[0];
    if(String(row[1])!==d.receiptToken||String(row[headers.length-1])!==signature){
      throw new Error('重複事件的內容不符');
    }
  }else{
    sh.getRange(sh.getLastRow()+1,4,1,3).setNumberFormat('@');
    sh.appendRow([d.eventId,d.receiptToken,new Date(),safeText_(student[0]),
      student[1],safeText_(student[2]),result.score,correct,
      ...answers.map(a=>'ABCD'[a]),d.createdAt,version,d.trainingId,
      JSON.stringify(d.order),signature]);
  }
  const receipts=ensureSheet_(ss,'挑戰收件',CUP_RECEIPTS);
  const receipt=receipts.getLastRow()>1?receipts.getRange(2,1,receipts.getLastRow()-1,1)
    .createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
  if(!receipt)receipts.appendRow([d.eventId,d.receiptToken,JSON.stringify(result)]);
  SpreadsheetApp.flush();
  CacheService.getScriptCache().put(d.eventId,
    JSON.stringify({token:d.receiptToken,ok:true}),21600);
  return json_({ok:true,result:result});
}
