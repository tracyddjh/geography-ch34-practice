const fs=require('fs'),vm=require('vm'),assert=require('assert');
const store=new Map(),els=new Map();
function el(id){if(!els.has(id))els.set(id,{style:{},dataset:{},classList:{toggle(){}},setAttribute(){},matches(){return false},querySelectorAll(){return []},showModal(){},close(){},focus(){},click(){this.onclick?.()},innerHTML:'',textContent:''});return els.get(id);}
const events=[];
const context={console,Math,Date,Number,String,Object,JSON,crypto:require('crypto').webcrypto,setTimeout,Blob,URL,confirm:()=>true,window:{scrollTo(){},addEventListener(){},GEO_CHALLENGE:{mount(){}},GEO_REPORTER:{status:()=>({configured:false,pending:0}),enqueue:event=>events.push(event)}},document:{querySelector(s){return s==='dialog[open]'?null:el(s)},addEventListener(){},createElement(){return el('download')}},sessionStorage:{getItem:()=>null,setItem(){}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)}};
vm.createContext(context);vm.runInContext(fs.readFileSync('dist/questions.js','utf8'),context);
const src=fs.readFileSync('dist/app.js','utf8').replace('profile();home();','window.TEST={start,choose,submit,nextRound,roundResult,stats,profile,score,getSession:()=>session};profile();home();');
vm.runInContext(src,context);const t=context.window.TEST,Q=context.window.QUESTIONS;
assert.equal(Q.length,20);for(const q of Q){assert(fs.existsSync('dist/'+q.image));if(q.passage)assert(fs.existsSync('dist/'+q.passage));assert(q.answer>=0&&q.answer<=3)}
t.start('all');assert.equal(t.getSession(),null,'Student identity is required');
t.profile().student={className:'802',seat:'15',name:'測試學生'};
t.start('all');assert.equal(t.getSession().queue.length,20);
// A wrong answer does not earn mastery; repeated submission cannot count again.
let q=t.getSession().queue[0];t.choose((q.answer+1)%4);t.submit();t.submit();assert.equal(t.score(q),0);assert.equal(t.profile().attempts,1);
// Finish this round, then correctly answer two full rounds as needed.
for(let i=1;i<20;i++){el('#next').click();q=t.getSession().queue[i];t.choose(q.answer);t.submit();}
assert.equal(t.stats(Q).done,0);assert.equal(t.stats(Q).one,19);el('#next').click();t.nextRound();
let count=t.getSession().queue.length;assert.equal(count,20);
for(let i=0;i<count;i++){q=t.getSession().queue[i];t.choose(q.answer);t.submit();if(i<count-1)el('#next').click();}
assert.equal(t.stats(Q).done,19);el('#next').click();t.nextRound();assert.equal(t.getSession().queue.length,1);
q=t.getSession().queue[0];t.choose(q.answer);t.submit();t.submit();assert.equal(t.stats(Q).done,20);assert.equal(t.profile().attempts,41);assert.equal(t.profile().correct,40);
assert.equal(JSON.parse(store.get('geo34-mastery-v1')).profiles['訪客'].correct,40);
assert.equal(events.length,41,'Each attempt queued exactly once');
assert(events.every(e=>e.student.className==='802'&&e.student.seat==='15'&&e.student.name==='測試學生'));
assert.equal(Q.filter(q=>t.profile().scores[q.id].firstCorrect).length,19,'First score stays 95 after mastery');
t.start('3');assert.equal(t.getSession().queue.length,0);
console.log('PASS: 20 assets; wrong answer; duplicate submission; mastery only after 2 correct; completed questions leave queue; 41 attempts/40 correct saved; completed chapter.');
