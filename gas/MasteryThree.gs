// 只顯示學生資料、各章完成狀態與時間；識別碼藏於第8欄。
function masteryThreeHeaders_(){
 return ['班級','座號','姓名','第3課是否完成精熟','第4課是否完成精熟','第3課完成時間','第4課完成時間','識別碼'];
}
function setupMasteryThree(){
 const ss=spreadsheet_(),headers=masteryThreeHeaders_(),old=ss.getSheetByName('精熟進度總表');
 let backup;
 if(old&&old.getLastRow()&&old.getRange(1,1,1,headers.length).getValues()[0].join('|')!==headers.join('|')){
  backup=old;backup.setName('精熟進度備份_'+Date.now());
 }
 const sheet=ensureSheet_(ss,'精熟進度總表',headers);sheet.hideColumns(8);sheet.setFrozenColumns(3);
 sheet.getRange('F:G').setNumberFormat('yyyy/mm/dd hh:mm:ss');
 const log=ss.getSheetByName('答題紀錄'),students={};
 if(log)log.getDataRange().getValues().slice(1).filter(r=>r[3]===ASSIGNMENT_ID).forEach(r=>{
  const key=JSON.stringify([r[4],String(r[5]),String(r[6]),String(r[7])]);
  students[key]={trainingId:r[4],student:{className:String(r[5]),seat:String(r[6]),name:String(r[7])}};
 });
 Object.values(students).forEach(d=>updateMasteryThree_(ss,d));
 if(backup)backup.hideSheet();
}
function updateMasteryThree_(ss,d){
 const ids=Object.keys(ANSWERS),wins={};ids.forEach(id=>wins[id]=0);
 const cls=safeText_(d.student.className.trim()),seat=String(d.student.seat),name=safeText_(d.student.name.trim());
 const log=ss.getSheetByName('答題紀錄');if(!log)throw new Error('缺少答題紀錄');
 const records=log.getDataRange().getValues().slice(1).filter(r=>r[3]===ASSIGNMENT_ID&&
  r[4]===d.trainingId&&String(r[5])===cls&&String(r[6])===seat&&String(r[7])===name);
 const completed={3:'',4:''};
 records.forEach(r=>{const id=questionId_(r[8],ss);if(Object.prototype.hasOwnProperty.call(wins,id)&&(r[10]===true||r[10]==='TRUE'))wins[id]++;
  [3,4].forEach(ch=>{if(!completed[ch]&&ids.filter(id=>id.startsWith(ch+'-')).every(id=>wins[id]>=3))completed[ch]=r[2];});});
 const sheet=ensureSheet_(ss,'精熟進度總表',masteryThreeHeaders_());
 const key=JSON.stringify([ASSIGNMENT_ID,cls,seat,name,d.trainingId]);
 const found=sheet.getLastRow()>1?sheet.getRange(2,8,sheet.getLastRow()-1,1).createTextFinder(key).matchEntireCell(true).findNext():null;
 const values=[cls,seat,name,completed[3]?'已完成':'未完成',completed[4]?'已完成':'未完成',completed[3],completed[4],key];
 const row=found?found.getRow():sheet.getLastRow()+1;
 sheet.getRange(row,1,1,3).setNumberFormat('@');
 sheet.getRange(row,1,1,values.length).setValues([values]);
}
