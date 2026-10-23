(() => {
 'use strict';
 const VERSION='ch34-cup-v1';
 const rounds=[
  ['3-6','3-5','3-2','3-4','3-1','4-5','4-6','4-4','4-7','4-1'],
  ['3-2','3-1','3-9','3-8','3-10','4-4','4-9','4-6','4-5','4-10'],
  ['3-5','3-3','3-1','3-4','3-7','4-5','4-2','4-10','4-7','4-1']
 ];
 let app,ctx,run=null,timer=null,view=0;
 const $=s=>app.querySelector(s),esc=s=>ctx.escape(s);
 async function rpc(params){
  const callback='geoCup_'+crypto.randomUUID().replace(/-/g,''),url=new URL(window.GEO_CONFIG.gasUrl);
  Object.entries({...params,callback}).forEach(([k,v])=>url.searchParams.set(k,v));
  const control=new AbortController(),timeout=setTimeout(()=>control.abort(),20000);
  try{
   // Omit Google cookies so a teacher signed into multiple accounts uses the same public service as students.
   const response=await fetch(url.href,{credentials:'omit',mode:'cors',signal:control.signal});
   if(!response.ok)throw new Error('無法連線挑戰服務，請稍後重試');
   const text=await response.text(),prefix=callback+'(';
   if(!text.startsWith(prefix)||!text.endsWith(');'))throw new Error('挑戰服務需要更新，請通知老師。');
   const data=JSON.parse(text.slice(prefix.length,-2));if(!data?.ok)throw new Error(data?.error||'挑戰服務未就緒');return data;
  }finally{clearTimeout(timeout);}
 }
 function envelope(type,round){const p=ctx.profile();return {type,round,student:{...p.student},trainingId:p.trainingId};}
 function stateKey(round){return 'geo34-cup-'+ctx.profile().trainingId+'-'+round;}
 function persist(){if(run&&!run.practice)sessionStorage.setItem(stateKey(run.round),JSON.stringify(run));}
 function clearTimer(){clearInterval(timer);timer=null;}
 function mount(target,context){clearTimer();view++;app=target;ctx=context;run=null;
  const section=document.createElement('section');section.className='cup-section';
  const unlocked=!!ctx.profile().student&&ctx.mastered();
  section.innerHTML=`<div class="section-head"><div><div class="eyebrow">GEOGRAPHY CHALLENGE CUP</div><h2>地理闖關挑戰賽 🏆</h2></div><span class="pill">${unlocked?'已解鎖':'完成全部精熟後解鎖'}</span></div><div class="cup-entry-guide"><p>先完成「中國的產業轉型與區域差異」與「全球化下的中國」兩課的精熟練習。</p><p><strong>第3–4課共20題，每題答對兩次，就可以進入地理闖關挑戰賽拿禮物！</strong></p><p class="muted">精熟紀錄成功回傳後解鎖。挑戰賽共3場，每場10題（第3、4課各5題）；同場題目相同，題序隨機。</p>${unlocked?'<p><strong>✓ 你已完成精熟練習，可以開始挑戰！</strong></p>':''}</div><div class="cup-cards">${rounds.map((_,i)=>`<article class="chapter-card"><span class="chapter-no">CHALLENGE 0${i+1}</span><h3>第 ${i+1} 場挑戰</h3><p>第 3 課 5 題 ＋ 第 4 課 5 題</p><button class="primary" data-cup="${i+1}" ${unlocked?'':'disabled'}>${unlocked?'進入挑戰 →':'尚未解鎖'}</button></article>`).join('')}</div><p class="muted">可以重複正式挑戰，每場保留最高分；同分取較短用時。每次出題順序都與上一次不同。中途離開仍繼續計時。排行榜只公開班級、座號。</p><button id="cup-board" class="secondary">查看分班排行榜 ↗</button><p id="cup-message" role="status"></p>`;
  target.querySelector('.cards').after(section);
  section.querySelectorAll('[data-cup]').forEach(b=>b.onclick=()=>enter(Number(b.dataset.cup)));
  section.querySelector('#cup-board').onclick=()=>leaderboard(1);
 }
 async function enter(round){if(!ctx.profile().student||!ctx.mastered())return;
  const marker=view;const message=$('#cup-message');message.textContent='正在確認精熟資格與挑戰紀錄…';
  app.querySelectorAll('[data-cup]').forEach(b=>b.disabled=true);
  try{
   const info=await rpc({action:'challengeInfo'});if(info.version!==VERSION||JSON.stringify(info.rounds)!==JSON.stringify(rounds))throw new Error('題組版本已更新，請重新整理網站。');
   await window.GEO_REPORTER.flush();if(window.GEO_REPORTER.status().pending)throw new Error('還有答題紀錄尚未確認回傳，請先重試回傳。');
   const result=await window.GEO_REPORTER.request(envelope('challengeStart',round));
   if(marker!==view)return;if(!result?.ok)throw new Error(result?.error||'挑戰服務需要更新');
   if(result.completed)return resultPage(round,result,false,true);
   let old;try{old=JSON.parse(sessionStorage.getItem(stateKey(round)));}catch{}
   if(!Array.isArray(result.order)||result.order.length!==10||new Set(result.order).size!==10||result.order.some(id=>!rounds[round-1].includes(id)))throw new Error('挑戰題序格式不符，請通知老師更新接收器。');
   run=old&&old.attemptId===result.attemptId?old:{round,attemptId:result.attemptId,order:result.order,answers:[],index:0,practice:false};
   run.clockBase=Date.now()-Math.max(0,result.serverNow-result.startedAt);run.startedAt=result.startedAt;persist();
   if(run.answers.length===10)return finish();question();
  }catch(error){if(marker===view){message.textContent=error.message;app.querySelectorAll('[data-cup]').forEach(b=>b.disabled=false);}}
 }
 function question(){clearTimer();const q=window.QUESTIONS.find(q=>q.id===run.order[run.index]);
  app.innerHTML=`<div class="practice-head"><button id="cup-exit" class="quiet">← 回到首頁</button><span>第 ${run.round} 場 · ${run.index+1} / 10 題 · ${run.practice?'自由練習':'正式挑戰'}</span><b id="cup-clock" aria-label="挑戰用時"></b></div><div class="cup-track" aria-label="挑戰進度">${run.order.map((_,i)=>`<span class="${i<run.index?'done':i===run.index?'current':''}">${i+1}</span>`).join('')}</div><div class="practice-layout"><article class="question-card"><div class="question-top"><h2>第 ${q.chapter} 課 · 練習本第 ${q.number} 題</h2><button id="cup-full" class="quiet">查看整頁 ↗</button></div><div class="question-images">${q.passage?`<div class="passage-wrap"><p class="passage-label">共用閱讀文章</p><img src="${q.passage}" alt="原題共用閱讀文章" data-zoom></div>`:''}<img src="${q.image}" alt="練習本原題文字、圖片與選項，點擊放大" data-zoom></div><div class="source-note">練習本第 ${q.page} 頁 · 題目與選項均為原稿</div></article><aside class="answer-panel"><div class="eyebrow">CHOOSE YOUR ANSWER</div><h2>你的答案是？</h2><p class="muted">依照原稿的 A、B、C、D 選項作答。確認後不能返回修改，完成整場後公布成績。</p><div class="choice-grid">${['A','B','C','D'].map((v,i)=>`<button class="choice" data-cup-choice="${i}" aria-pressed="false">${v}</button>`).join('')}</div><button id="cup-next" class="primary" disabled>${run.index===9?'完成並送出':'確認，前往下一題 →'}</button><p class="muted">${run.practice?'自由練習不改變正式排名。':'正式成績由老師端確認，離開或重新整理不會重置計時。'}</p><p id="cup-send-status" role="status"></p></aside></div>`;
  let selected=null;
  app.querySelectorAll('[data-cup-choice]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.cupChoice);app.querySelectorAll('[data-cup-choice]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});$('#cup-next').disabled=false;});
  $('#cup-next').onclick=()=>{if(selected===null)return;run.answers.push({questionId:q.id,selected});run.index++;persist();if(run.index===10)finish();else question();};
  $('#cup-exit').onclick=()=>{if(confirm('要離開挑戰嗎？正式場次仍會繼續計時，回來可以接著作答。')){clearTimer();ctx.home();}};
  $('#cup-full').onclick=()=>ctx.openImage('assets/page-'+q.pdfPage+'.png','練習本第 '+q.page+' 頁');app.querySelectorAll('[data-zoom]').forEach(im=>im.onclick=()=>ctx.openImage(im.src,'練習本原稿'));
  const tick=()=>{if($('#cup-clock'))$('#cup-clock').textContent=Math.max(0,Math.floor((Date.now()-run.clockBase)/1000))+' 秒';};tick();timer=setInterval(tick,1000);window.scrollTo({top:0,behavior:'instant'});
 }
 async function finish(){clearTimer();
  if(run.practice){const correct=run.answers.filter(a=>window.QUESTIONS.find(q=>q.id===a.questionId).answer===a.selected).length;return resultPage(run.round,{correct,elapsed:Math.ceil((Date.now()-run.clockBase)/1000)},true);}
  const marker=view;app.innerHTML='<section class="round-title"><h1>10 題完成，正在確認成績…</h1><p>請保持網頁開啟。成績經老師端確認後才會列入排名。</p><p id="cup-error" role="status"></p><button id="cup-retry" hidden>重試送出</button><button id="cup-home">回到首頁</button></section>';
  $('#cup-home').onclick=()=>ctx.home();$('#cup-retry').onclick=finish;
  try{await window.GEO_REPORTER.flush();const result=await window.GEO_REPORTER.request({...envelope('challengeFinish',run.round),attemptId:run.attemptId,answers:run.answers});if(marker!==view)return;if(!result?.ok)throw new Error(result?.error||'尚未確認成績');const round=run.round;sessionStorage.removeItem(stateKey(round));resultPage(round,result,false);}
  catch(error){if(marker!==view)return;$('#cup-error').textContent=error.message;$('#cup-retry').hidden=false;}
 }
 function resultPage(round,result,practice,previous=false){clearTimer();app.innerHTML=`<section class="round-title"><div class="round-symbol">🏆</div><div class="eyebrow">CHALLENGE ${round} COMPLETE</div><h1>第 ${round} 場${previous?'本次成績已確認':'挑戰完成'}！</h1><div class="cup-score">${Number(result.correct)*10}<small> / 100 分</small></div><p>答對 ${Number(result.correct)} / 10 題 · 用時 ${Number(result.elapsed)} 秒</p><p>${practice?'這是自由練習，不影響排行榜。':'老師端已確認正式成績。每人每場保留最高分，同分保留較短用時。'}</p><div class="action-row"><button id="cup-show-board" class="primary">查看本班排名</button><button id="cup-play-again">再次正式挑戰</button><button id="cup-home">回到首頁</button></div></section>`;
  $('#cup-home').onclick=()=>ctx.home();$('#cup-show-board').onclick=()=>leaderboard(round);$('#cup-play-again').onclick=()=>{ctx.home();enter(round);};
 }
 async function leaderboard(round){clearTimer();view++;const marker=view;
  app.innerHTML=`<section class="cup-section"><div class="eyebrow">CLASS LEADERBOARD</div><h1>班級挑戰排行榜</h1><p>各班、各場分開排名。答對題數優先，同分比較用時；題數及用時相同則並列。</p><form id="cup-filter" class="cup-filter"><label>班級<input id="cup-class" maxlength="40" required placeholder="例如：812" value="${esc(ctx.profile().student?.className||'')}"></label><label>挑戰場次<select id="cup-round">${[1,2,3].map(n=>`<option value="${n}" ${n===round?'selected':''}>第 ${n} 場</option>`).join('')}</select></label><button class="primary">查詢排行榜</button></form><div id="cup-ranking" role="status">請輸入班級查詢。</div><button id="cup-home" class="quiet">← 回到首頁</button></section>`;
  $('#cup-home').onclick=()=>ctx.home();let serial=0;
  const load=async()=>{const seq=++serial,cls=$('#cup-class').value.trim().replace(/班$/,'').trim(),stage=Number($('#cup-round').value);if(!cls)return;$('#cup-ranking').textContent='正在讀取正式成績…';try{const data=await rpc({action:'leaderboard',className:cls,round:stage});if(marker!==view||seq!==serial)return;$('#cup-ranking').innerHTML=data.rows.length?`<div class="cup-table-wrap"><table class="cup-table"><caption>${esc(cls)} 班 · 第 ${stage} 場</caption><thead><tr><th>名次</th><th>班級</th><th>座號</th><th>分數</th><th>用時</th></tr></thead><tbody>${data.rows.map(r=>`<tr><td>${Number(r.rank)}</td><td>${esc(r.className)}</td><td>${esc(r.seat)} 號</td><td>${Number(r.correct)*10}</td><td>${Number(r.elapsed)} 秒</td></tr>`).join('')}</tbody></table></div>`:'這個班級目前還沒有完成本場的正式成績。';}catch(error){if(marker===view&&seq===serial)$('#cup-ranking').textContent=error.message;}};
  $('#cup-filter').onsubmit=e=>{e.preventDefault();load();};if(ctx.profile().student)load();window.scrollTo({top:0,behavior:'instant'});
 }
 window.GEO_CHALLENGE={mount,rounds};
})();
