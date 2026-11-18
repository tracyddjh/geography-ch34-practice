// 加入原接收器專案；依老師端已收到的逐題紀錄確認精熟。
function masteryThreeHeaders_(){
 return ['識別碼','更新時間','班級','座號','姓名','第3章精熟題數','第4章精熟題數',
  '總精熟題數','完成狀態','全部完成時間',...Object.keys(ANSWERS).map(id=>id+'答對次數'),'精熟題目複習作答次數','練習ID'];
}
function setupMasteryThree(){
 ensureSheet_(spreadsheet_(),'精熟進度總表',masteryThreeHeaders_());
}
function updateMasteryThree_(ss,d){
 const ids=Object.keys(ANSWERS),wins={};ids.forEach(id=>wins[id]=0);
 const cls=safeText_(d.student.className.trim()),seat=String(d.student.seat),name=safeText_(d.student.name.trim());
 const log=ss.getSheetByName('答題紀錄');if(!log)throw new Error('缺少答題紀錄');
 const records=log.getDataRange().getValues().slice(1).filter(r=>r[3]===ASSIGNMENT_ID&&
  r[4]===d.trainingId&&String(r[5])===cls&&String(r[6])===seat&&String(r[7])===name);
 let completed='',reviewed=0;
 records.forEach(r=>{const id=questionId_(r[8],ss);if(wins[id]>=3)reviewed++;if(Object.prototype.hasOwnProperty.call(wins,id)&&(r[10]===true||r[10]==='TRUE'))wins[id]++;
  if(!completed&&ids.every(id=>wins[id]>=3))completed=r[2];});
 const sheet=ensureSheet_(ss,'精熟進度總表',masteryThreeHeaders_());
 const key=JSON.stringify([ASSIGNMENT_ID,cls,seat,name,d.trainingId]);
 const found=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(key).matchEntireCell(true).findNext():null;
 const c3=ids.filter(id=>id.startsWith('3-')&&wins[id]>=3).length;
 const c4=ids.filter(id=>id.startsWith('4-')&&wins[id]>=3).length;
 const values=[key,new Date(),cls,seat,name,c3,c4,c3+c4,c3+c4===20?'已完成精熟':'練習中',completed,
  ...ids.map(id=>wins[id]),reviewed,d.trainingId];
 const row=found?found.getRow():sheet.getLastRow()+1;
 sheet.getRange(row,3,1,3).setNumberFormat('@');
 sheet.getRange(row,1,1,values.length).setValues([values]);
}
