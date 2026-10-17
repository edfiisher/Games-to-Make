import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server.js';
import {questions,judge,scores,selectQuestions,normalize} from '../questions.js';
import {readHistory,remember} from '../public/progress.js';

const byId=new Map(questions.map(q=>[q.id,q]));
async function fixture(t){
 let time=1000;
 const server=createGameServer({now:()=>time});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 async function request(action,body){const response=await fetch(base+'/api/'+action,{method:'POST',body:JSON.stringify(body)});return {status:response.status,body:await response.json()}}
 async function post(action,body){const r=await request(action,body);assert.equal(r.status,200,JSON.stringify(r.body));return r.body}
 return {base,post,request,tick(ms){time+=ms}};
}
const auth=s=>({code:s.code,playerId:s.playerId});
const answerBody=s=>({...auth(s),roundId:s.roundId,answer:byId.get(s.question.id).answers[0].answer});

test('solo starts immediately with no name, archive or room selection; scores and completes seven turns',async t=>{
 const {post,request}=await fixture(t);let s=await post('start',{});const session=auth(s);
 assert.equal(s.phase,'answering');assert.equal(s.board.length,1);assert.equal(s.answers,undefined);assert.equal(s.deadline,26000);
 const ids=[],total=[];
 for(let i=0;i<7;i++){
  assert.equal(s.round,i);assert.equal(s.playedIds.length,i+1);ids.push(s.question.id);
  const first=byId.get(s.question.id).answers[0];total.push(scores[first.tier]);
  const old={...session,roundId:s.roundId,answer:first.answer};
  if(i===0){const reject=await post('answer',{...old,answer:'notarealanswerxyz'});assert.ok(reject.rejected);assert.equal(reject.deadline,s.deadline);assert.equal(reject.results.length,0)}
  s=await post('answer',old);assert.equal(s.results[i].score,scores[first.tier]);assert.equal(s.results[i].answer,first.answer);
  assert.equal((await request('answer',old)).status,409);
  if(i<6){s=await post('next',session);const stale=await request('answer',old);assert.equal(stale.status,409);assert.equal(stale.body.state.round,i+1)}
 }
 assert.equal(new Set(ids).size,7);assert.equal(s.phase,'done');assert.equal(s.answers.length,7);assert.equal(s.board[0].score,total.reduce((a,b)=>a+b,0));
 const summary=await post('state',{...session,summary:true});assert.equal(summary.answers,undefined);assert.equal(summary.results.length,7);
 const done=await post('next',session);assert.equal(done.phase,'done');assert.equal(done.results.length,7);
});

test('invitation joins the existing solo run and gives friends the same seven questions and independent timers',async t=>{
 const {post,tick}=await fixture(t);let host=await post('start',{name:'Host'});const hostAuth=auth(host);
 const guest=await post('join',{code:host.code.toLowerCase(),name:'Guest'});let friend=guest;const guestAuth=auth(guest);
 assert.equal(guest.phase,'intro');assert.equal(guest.question.id,host.question.id);assert.equal(guest.deadline,null);assert.equal(guest.board.length,2);
 tick(4000);friend=await post('next',guestAuth);assert.equal(friend.deadline-host.deadline,4000);
 for(let i=0;i<7;i++){
  assert.equal(friend.question.id,host.question.id);
  const chosen=byId.get(host.question.id).answers[0];host=await post('answer',answerBody(host));friend=await post('answer',answerBody(friend));
  assert.equal(host.results[i].score,scores[chosen.tier]);assert.equal(friend.results[i].score,host.results[i].score);
  if(i<6){host=await post('next',hostAuth);friend=await post('next',guestAuth)}
 }
 assert.ok(friend.board.every(p=>p.done));assert.equal(friend.board[0].score,friend.board[1].score);assert.equal(friend.board.filter(p=>p.isYou).length,1);
});

test('fresh selection avoids every played question until exhausted, then rotates oldest questions',()=>{
 let seen=[];const recent=[];
 while(questions.length-seen.length>=7){const run=selectQuestions(seen);assert.equal(run.freshCount,7);assert.equal(run.questions.length,7);for(const q of run.questions){assert.ok(!seen.includes(q.id));seen.push(q.id)}recent.push(run.questions.map(q=>q.id))}
 const last=selectQuestions(seen);assert.equal(last.freshCount,questions.length-seen.length);assert.equal(new Set(last.questions.map(q=>q.id)).size,7);
 const all=questions.map(q=>q.id);const first=selectQuestions(all);assert.equal(first.freshCount,0);assert.deepEqual(first.questions.map(q=>q.id),all.slice(0,7));
 const reordered=[...all.slice(7),...all.slice(0,7)];assert.deepEqual(selectQuestions(reordered).questions.map(q=>q.id),all.slice(7,14));
});

test('the API respects saved device history and has no archive picker endpoint',async t=>{
 const {base,post}=await fixture(t);const excluded=questions.slice(0,-7).map(q=>q.id);let s=await post('start',{seen:excluded});const session=auth(s),ids=[];
 for(let i=0;i<7;i++){assert.ok(!excluded.includes(s.question.id));ids.push(s.question.id);s=await post('skip',{...session,roundId:s.roundId});if(i<6)s=await post('next',session)}
 assert.equal(new Set(ids).size,7);const info=await (await fetch(base+'/api/info')).json();assert.equal(info.questionCount,questions.length);assert.equal(info.version,2);assert.equal(info.answers,undefined);
 assert.equal((await fetch(base+'/api/dives')).status,405);
});

test('timeouts are enforced server-side; expired rooms and invalid requests recover cleanly',async t=>{
 const {post,request,tick}=await fixture(t);const s=await post('start',{});const session=auth(s);
 tick(25001);const late=await request('answer',answerBody(s));assert.equal(late.status,409);assert.equal(late.body.state.results[0].score,0);assert.equal(late.body.state.phase,'feedback');
 assert.equal((await request('state',{...session,playerId:'wrong'})).status,404);
 assert.equal((await request('join',{code:'zzzzzz'})).status,400);assert.equal((await request('join',{code:'ABCDEF'})).status,404);
 assert.equal((await request('start',{seen:'bad'})).status,400);assert.equal((await request('start',{name:123})).status,400);
 tick(6*60*60*1000+1);const expired=await request('state',session);assert.equal(expired.status,404);assert.equal(expired.body.expired,true);
 const restored=await post('start',{seen:[s.question.id]});assert.notEqual(restored.question.id,s.question.id);
});

test('recorded question bank has distinct questions, valid source attribution and consistent answer tiers',()=>{
 assert.ok(questions.length>=82);assert.equal(new Set(questions.map(q=>q.id)).size,questions.length);assert.equal(new Set(questions.map(q=>normalize(q.text))).size,questions.length);
 for(const q of questions){assert.match(q.source,/^https:\/\/krillionanswers.com\/questions\//);assert.ok(q.answers.length);for(const a of q.answers){assert.ok(a.answer.trim());assert.ok(scores[a.tier]);assert.ok(Array.isArray(a.aliases))}const sample=q.answers[0];assert.equal(judge(q,sample.answer.toUpperCase()).tier,sample.tier)}
 assert.equal(judge(questions[0],'notarealanswerxyz'),null);
});

test('device progress survives sessions and moves repeated questions to the end of the history',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 assert.deepEqual(readHistory(storage),[]);remember(storage,['a','b','c']);remember(storage,['b','d']);assert.deepEqual(readHistory(storage),['a','c','b','d']);
 remember(storage,['d','d']);assert.deepEqual(readHistory(storage),['a','c','b','d']);
 const broken={getItem(){throw Error('storage disabled')},setItem(){throw Error('storage disabled')}};assert.deepEqual(remember(broken,['x']),['x']);
});
