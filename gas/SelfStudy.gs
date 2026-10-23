// 與原 Code.gs 放在同一個 Apps Script 專案，不需替換原程式。
function selfStudyHeaders_(){
  return ['事件ID','收件確認碼','老師收件時間','班級','座號','姓名','分數','答對題數',
    '第1題','第2題','第3題','第4題','第5題','第6題','第7題','第8題','第9題','第10題',
    '學生交卷時間','測驗版本','練習ID','收件核對資料'];
}

function setupSelfStudyExam(){
  const sh=ensureSheet_(spreadsheet_(),'3-2自學完成測驗',selfStudyHeaders_());
  sh.setFrozenRows(1);
}

function selfStudyExamPost_(ss,d){
  const version='industry-self-study-exam-v1';
  const key=[0,3,1,2,2,2,0,2,0,3];
  if(d.examVersion!==version)throw new Error('自學測驗版本不符');
  if(!Array.isArray(d.answers)||d.answers.length!==10||
    d.answers.some(a=>!Number.isInteger(a)||a<0||a>3)){
    throw new Error('必須完整作答10題');
  }
  const student=[d.student.className.trim(),d.student.seat,d.student.name.trim()];
  const signature=JSON.stringify([version,d.trainingId,student,d.answers,d.createdAt]);
  const sh=ensureSheet_(ss,'3-2自學完成測驗',selfStudyHeaders_());
  const found=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,1)
    .createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
  const correct=d.answers.filter((a,i)=>a===key[i]).length;
  const result={score:correct*10,correct:correct,total:10,status:'submitted'};
  if(found){
    const row=sh.getRange(found.getRow(),1,1,selfStudyHeaders_().length).getValues()[0];
    if(String(row[1])!==d.receiptToken||String(row[21])!==signature){
      throw new Error('重複事件的內容不符');
    }
  }else{
    const row=sh.getLastRow()+1;
    sh.getRange(row,4,1,3).setNumberFormat('@');
    sh.appendRow([d.eventId,d.receiptToken,new Date(),safeText_(student[0]),
      student[1],safeText_(student[2]),result.score,correct,
      ...d.answers.map(a=>'ABCD'[a]),d.createdAt,version,d.trainingId,signature]);
  }
  // Reuse the existing durable receipt mechanism; retrying does not duplicate scores.
  const receipts=ensureSheet_(ss,'挑戰收件',CUP_RECEIPTS);
  const receipt=receipts.getLastRow()>1?receipts.getRange(2,1,receipts.getLastRow()-1,1)
    .createTextFinder(d.eventId).matchEntireCell(true).findNext():null;
  if(!receipt)receipts.appendRow([d.eventId,d.receiptToken,JSON.stringify(result)]);
  SpreadsheetApp.flush();
  CacheService.getScriptCache().put(d.eventId,
    JSON.stringify({token:d.receiptToken,ok:true}),21600);
  return json_({ok:true,result:result});
}
