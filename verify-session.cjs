const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const local=new Map(),tab=new Map();
function boot(session){
 const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{style:{},dataset:{},value:'',classList:{toggle(){}},setAttribute(){},matches(){return false},querySelectorAll(){return []},showModal(){this.opened=true},close(){this.opened=false},focus(){},innerHTML:'',textContent:''});return elements.get(id);}
 const c={console,Math,Date,Number,String,Object,JSON,crypto:crypto.webcrypto,setTimeout,Blob,URL,confirm:()=>true,window:{scrollTo(){},addEventListener(){},GEO_CHALLENGE:{mount(){}},GEO_REPORTER:{status:()=>({configured:true,pending:0})}},document:{querySelector:s=>el(s),addEventListener(){}},sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v)},localStorage:{getItem:k=>local.get(k),setItem:(k,v)=>local.set(k,v)}};
 vm.createContext(c);vm.runInContext(fs.readFileSync('dist/questions.js','utf8'),c);vm.runInContext(fs.readFileSync('dist/app.js','utf8'),c);return el;
}
const oldKey=JSON.stringify(['801','1','舊學生']);local.set('geo34-mastery-v1',JSON.stringify({active:oldKey,profiles:{[oldKey]:{student:{className:'801',seat:'1',name:'舊學生'},scores:{},attempts:0,correct:0}}}));
let el=boot(tab);assert(el('#app').innerHTML.includes('請先填寫班級、座號、姓名'),'New tab ignores prior local active identity');
el('#student-class').value='802班';el('#student-seat').value='02';el('#student-name').value='測試學生';el('#student-form').onsubmit({preventDefault(){}});
assert(el('#app').innerHTML.includes('802 班 2 號 測試學生'));assert(!el('#app').innerHTML.includes('切換學生'));assert(!el('#app').innerHTML.includes('id="edit-student"'));assert(el('#profile').disabled);
el('#student-name').value='其他學生';el('#student-form').onsubmit({preventDefault(){}});assert(el('#app').innerHTML.includes('測試學生'),'Cannot replace identity in same tab');
el=boot(tab);assert(el('#app').innerHTML.includes('802 班 2 號 測試學生'),'Reload retains tab identity');
el=boot(new Map());assert(el('#app').innerHTML.includes('請先填寫班級、座號、姓名'),'Fresh tab accepts next student without clearing local progress');assert(local.get('geo34-mastery-v1').includes('測試學生'));
console.log('PASS identity: legacy active ignored; class/seat normalized; switching removed and blocked; reload retains; fresh tab resets identity and preserves saved progress.');
