import {readHistory,remember} from './progress.js';

const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tiers={plankton:'● Green run',tooclever:'↺ Crowded line',schooler:'◆ Blue run',rare:'◆ Black run',deepcut:'✳ Off-piste',krillion:'✦ First tracks',miss:'— Caught an edge'};
const storage={getItem(key){try{return localStorage.getItem(key)}catch{return null}},setItem(key,value){try{localStorage.setItem(key,value)}catch{}}};
const SESSION_KEY='fresh-tracks-session-v1';
let session=null,state=null,view='',busy=false,offset=0,sound=false,audio,generation=0,polling=false;
let knownCount=0;
$('name').value=storage.getItem('fresh-tracks-name')??'';
$('name').addEventListener('input',()=>storage.setItem('fresh-tracks-name',$('name').value));
function saveSession(){try{session?sessionStorage.setItem(SESSION_KEY,JSON.stringify(session)):sessionStorage.removeItem(SESSION_KEY)}catch{}}
function newSession(s){generation++;session={code:s.code,playerId:s.playerId};state=null;view='';saveSession();render(s);history.replaceState(null,'','/')}
function showHome(){generation++;session=null;state=null;view='';saveSession();$('home').hidden=false;$('game').hidden=true;document.body.classList.remove('playing');$('run-number').textContent='YOUR NEXT RUN AWAITS';moveSkier(0);updateBankNote();history.replaceState(null,'','/')}
function updateBankNote(){const seen=readHistory(storage).length;const left=Math.max(0,knownCount-seen);$('bank-note').textContent=knownCount?`${knownCount} questions on the mountain · ${left?left+' still unexplored':'time to revisit some favourite lines'}`:'New turns, every time you play.'}
function setBusy(value){busy=value;for(const el of document.querySelectorAll('#start, #answerform button, #joinform button, [data-next], #skip, #again, #new-run'))el.disabled=value}
function report(error){if(error.expired)showHome();$('error').textContent=error.name==='TimeoutError'?'The mountain is taking a moment. Please try again.':error.message}
async function api(action,data={}){
 const r=await fetch('/api/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...session,...data}),signal:AbortSignal.timeout(20000)});
 if(!r.headers.get('content-type')?.includes('application/json'))throw Error('The server is waking up. Please try again in a moment.');
 const d=await r.json();
 if(!r.ok){const error=Error(d.error??'Could not reach the mountain. Try again.');error.expired=d.expired;error.state=d.state;throw error}
 return d;
}
async function act(action,data={}){
 if(busy)return;const started=generation;setBusy(true);$('error').textContent='';
 try{const s=await api(action,{roundId:state?.roundId,...data});if(started===generation)render(s)}
 catch(error){if(started===generation){if(error.state)render(error.state);report(error)}}
 finally{setBusy(false)}
}
async function startRun(){
 if(busy)return;setBusy(true);$('error').textContent='';
 try{newSession(await api('start',{name:$('name').value,seen:readHistory(storage)}));if(innerWidth<761)$('game').scrollIntoView({block:'start',behavior:'smooth'})}
 catch(error){report(error)}finally{setBusy(false)}
}
async function join(code){
 if(busy)return;setBusy(true);$('error').textContent='';
 try{newSession(await api('join',{code,name:$('name').value}));if(innerWidth<761)$('game').scrollIntoView({block:'start',behavior:'smooth'})}
 catch(error){report(error)}finally{setBusy(false)}
}
$('start').onclick=startRun;
$('new-run').onclick=startRun;
$('joinform').onsubmit=event=>{event.preventDefault();join($('code').value.trim())};
$('sound').onclick=()=>{sound=!sound;$('sound').textContent=sound?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-pressed',String(sound));if(sound)tone()};
function tone(){if(!sound)return;try{audio??=new AudioContext();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(330,audio.currentTime);o.frequency.exponentialRampToValueAtTime(660,audio.currentTime+.18);g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.3);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.3)}catch{}}

// Sharing is optional: every solo run can become a shared run.
$('invite').onclick=()=>{if(!state)return;$('invite-link').value=location.origin+'/?room='+state.code;$('roomcode').textContent=state.code;$('share-status').textContent='';$('share').hidden=!navigator.share;$('invite-dialog').showModal()};
$('close-invite').onclick=()=>$('invite-dialog').close();
$('invite-dialog').addEventListener('click',event=>{if(event.target===$('invite-dialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close()}});
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('invite-link').value);$('share-status').textContent='Link copied. Send it to your friend.'}catch{$('invite-link').select();$('share-status').textContent='Select and copy the link above, or send the invite code.'}};
$('share').onclick=async()=>{try{await navigator.share({title:'Join my Fresh Tracks run',text:'Same mountain. Same questions. Race you to the bottom?',url:$('invite-link').value})}catch(error){if(error.name!=='AbortError')$('share-status').textContent='Try copying the link instead.'}};

const path=$('run-path'),trail=$('ski-trail'),length=path.getTotalLength();
trail.style.strokeDasharray=String(length);
let position=0,animation=0;
function moveSkier(target){
 cancelAnimationFrame(animation);const from=position,start=performance.now(),duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:1100;
 const frame=now=>{const t=duration?Math.min(1,(now-start)/duration):1;position=from+(target-from)*(1-Math.pow(1-t,3));const point=path.getPointAtLength(position*length);$('skier').setAttribute('transform',`translate(${point.x} ${point.y})`);trail.style.strokeDashoffset=String(length*(1-position));if(t<1)animation=requestAnimationFrame(frame)};
 animation=requestAnimationFrame(frame);
}
moveSkier(0);
function resultSheet(q,index){return `<details class="answer-sheet" data-sheet="${index}"><summary>${escape(q.text)}</summary><div class="sheet-content"></div></details>`}
function paintAnswers(details,query=''){
 const q=state.answers[Number(details.dataset.sheet)];const filtered=q.answers.filter(a=>a.answer.toLowerCase().includes(query.toLowerCase()));
 details.querySelector('.answer-list').innerHTML=filtered.length?filtered.slice(0,150).map(a=>`<div>${escape(a.answer)} <b>· ${a.score}</b></div>`).join('')+(filtered.length>150?`<p>Showing 150 of ${filtered.length} · type to narrow the list.</p>`:''):'No recorded match.';
}
function render(s){
 if(state?.code===s.code&&s.revision<state.revision)return;
 if(s.code===state?.code&&!s.answers&&state.answers)s.answers=state.answers;
 state=s;offset=s.serverNow-Date.now();remember(storage,s.playedIds);knownCount=s.bankSize;
 $('home').hidden=true;$('game').hidden=false;document.body.classList.add('playing');$('error').textContent='';
 const score=s.results.reduce((total,r)=>total+r.score,0);$('score').textContent=score;$('distance').innerHTML=(score*10).toLocaleString()+'<span>m</span>';
 moveSkier(score/700);$('run-number').textContent=s.board.length>1?'SHARED RUN · '+s.board.length+' SKIERS':'SOLO RUN';
 $('dots').innerHTML=Array.from({length:7},(_,i)=>`<i class="${i<s.results.length?'done':''}"></i>`).join('');
 $('roundlabel').textContent=s.results.length===7?'RUN COMPLETE':`TURN ${s.phase==='feedback'?s.round:s.round+1} / 7`;
 $('leaderboard').hidden=s.board.length<2;
 $('board').innerHTML=s.board.map((p,i)=>`<li class="${p.isYou?'you':''}"><div>${i+1}. ${escape(p.name)}${p.isYou?' (you)':''}<small>${p.done?'At the valley':p.rounds+' of 7 turns complete'}</small></div><b>${(p.score*10).toLocaleString()}m</b></li>`).join('');
 const key=s.code+':'+s.phase+':'+s.round;
 if(key===view){if($('rejected'))$('rejected').textContent=s.rejected??'';return}
 const previous=view;view=key;const stage=$('stage');stage.classList.remove('urgent');
 if(s.phase==='intro'){
  stage.innerHTML=`<div class="kicker">YOU’RE ON THE GUEST LIST</div><h2>Your friend’s run.<br>Your own line.</h2><p class="hint">You’ve joined their game. You’ll get the same seven questions, with your own 25-second timer for each.</p><button data-next class="primary">START MY RUN ↘</button>`;
 }else if(s.phase==='answering'){
  stage.innerHTML=`<div class="kicker">TURN ${s.round+1} OF 7 · THINK OFF-PISTE</div><h2 id="question">${escape(s.question.text)}</h2><div class="clockline"><span>FIND ONE RARE ANSWER</span><strong id="seconds">25.0</strong></div><div class="timer"><i id="bar"></i></div><form id="answerform"><input id="answer" aria-label="Your answer" placeholder="Take a different line…" maxlength="160" autocomplete="off" required><button type="submit" class="primary">LET IT RUN ↘</button></form><p id="rejected" role="status"></p><button id="skip" class="text-button">Pass this turn</button>`;
  $('answerform').onsubmit=event=>{event.preventDefault();act('answer',{answer:$('answer').value})};$('skip').onclick=()=>act('skip');if(innerWidth>=761)$('answer').focus({preventScroll:true});
 }else if(s.phase==='feedback'){
  const r=s.results.at(-1);if(previous)tone();
  stage.innerHTML=`<div class="feedback"><span class="tier">${tiers[r.tier]}</span><div class="points">+${(r.score*10).toLocaleString()}<small>m</small></div><p class="answerlabel">${escape(r.answer??r.raw??'No answer this turn')}</p><p class="hint">${r.score?`+${r.score} points. A little further down the mountain.`:'No distance this time. A new line is coming.'}</p><button data-next class="primary">NEXT TURN ↘</button></div>`;
 }else{
  if(previous)tone();
  stage.innerHTML=`<div class="kicker">THAT’S A WRAP. SKIS OFF.</div><div class="result-total">${(score*10).toLocaleString()}<small> metres skied</small></div><p class="hint">${score} / 700 points · ${s.board.length>1?'See how your friends are getting on below.':'Just you, seven turns, and a very good mountain.'}</p><div class="finish-actions"><button id="again" class="primary">FRESH SNOW. ANOTHER RUN? ↘</button></div>${s.freshCount<7?'<p class="recycle-note">You’re exploring familiar terrain. Once you’ve seen every question, the least recently played ones return.</p>':''}${s.results.map((r,i)=>`<div class="resultrow"><div><small>${i+1}. ${escape(r.prompt)}</small>${escape(r.answer??r.raw??'—')}</div><span>${tiers[r.tier]}<br><b>+${r.score*10}m</b></span></div>`).join('')}<div class="sheets"><div class="kicker">THE LINES YOU COULD HAVE TAKEN</div>${(s.answers??[]).map(resultSheet).join('')}</div>`;
  $('again').onclick=startRun;
  for(const details of stage.querySelectorAll('.answer-sheet'))details.addEventListener('toggle',()=>{
   if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';const index=details.dataset.sheet;
   details.querySelector('.sheet-content').innerHTML=`<input aria-label="Search answers for question ${Number(index)+1}" placeholder="Search recorded answers…"><div class="answer-list"></div>`;
   details.querySelector('input').oninput=event=>paintAnswers(details,event.target.value);paintAnswers(details);
  });
 }
 for(const button of stage.querySelectorAll('[data-next]'))button.onclick=()=>act('next');
 setBusy(busy);
}
setInterval(()=>{
 if(state?.phase!=='answering')return;const left=Math.max(0,state.deadline-Date.now()-offset);
 if($('seconds')){$('seconds').textContent=(left/1000).toFixed(1);$('bar').style.width=(left/250)+'%';$('stage').classList.toggle('urgent',left<5000)}
},100);
setInterval(async()=>{
 if(!session||busy||polling||document.visibilityState==='hidden')return;
 polling=true;const started=generation;
 try{const s=await api('state',{summary:!!state?.answers});if(started===generation&&!busy)render(s)}
 catch(error){if(started===generation)report(error)}finally{polling=false}
},1200);

async function boot(){
 fetch('/api/info').then(r=>r.json()).then(info=>{knownCount=info.questionCount;updateBankNote()}).catch(()=>{});
 const invite=new URLSearchParams(location.search).get('room');
 try{session=JSON.parse(sessionStorage.getItem(SESSION_KEY))}catch{}
 // A shared link takes priority over the run already open in this tab.
 if(invite){
  if(session?.code===invite.toUpperCase()){try{render(await api('state'));history.replaceState(null,'','/');return}catch{session=null}}
  session=null;await join(invite);return;
 }
 if(session){setBusy(true);try{const s=await api('state');if(s.phase==='done'){remember(storage,s.playedIds);showHome()}else render(s)}catch{showHome()}finally{setBusy(false)}}
}
boot();
