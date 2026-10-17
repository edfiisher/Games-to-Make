import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGameServer} from '../server.js';
import {questions,judge,scores} from '../questions.js';
test('private rooms, scoring, deadlines, duplicate protection and a full dive',async t=>{
 let time=1000;const server=createGameServer({now:()=>time});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 async function call(action,data){const r=await fetch(base+'/api/'+action,{method:'POST',body:JSON.stringify(data)});return {status:r.status,body:await r.json()}}
 const a=(await call('join',{name:'Alex',diveId:'practice'})).body;const auth={code:a.code,playerId:a.playerId};assert.equal(a.phase,'intro');assert.equal(a.board.length,1);assert.equal(a.answers,undefined);
 const b=(await call('join',{name:'Sam',code:a.code,diveId:'2026-10-11'})).body;assert.equal(b.board.length,2);assert.equal(b.diveId,'practice');
 assert.equal((await call('state',{...auth,playerId:'wrong'})).status,404);
 assert.equal((await call('join',{name:'X',code:'BAD'})).status,404);
 let s=(await call('next',auth)).body;assert.equal(s.deadline,26000);assert.equal(s.question.id,'potato');
 let bad=(await call('answer',{...auth,answer:'a made up answer'})).body;assert.ok(bad.rejected);assert.equal(bad.phase,'answering');assert.equal(bad.results.length,0);
 s=(await call('answer',{...auth,answer:'MASH'})).body;assert.equal(s.results[0].score,10);assert.equal(s.results[0].answer,'mashed');
 assert.equal((await call('answer',{...auth,answer:'mashed'})).status,409);
 await call('next',auth);time+=25001;s=(await call('answer',{...auth,answer:'tahr'})).body;assert.equal(s.state.results[1].score,0);assert.equal(s.state.phase,'feedback');
 for(let i=2;i<7;i++){await call('next',auth);s=(await call('answer',{...auth,answer:questions[i].answers.at(-1).answer})).body;assert.equal(s.results[i].score,100)}
 assert.equal(s.results.length,7);assert.equal(s.answers.length,7);assert.equal(s.board.find(p=>p.name==='Alex').score,510);
 const sam=(await call('state',{code:b.code,playerId:b.playerId})).body;assert.equal(sam.results.length,0);assert.equal(sam.board[0].score,510);
 await call('next',auth);s=(await call('next',auth)).body;assert.equal(s.phase,'done');assert.equal(s.results.length,7);
 const page=await fetch(base+'/');assert.equal(page.status,200);assert.match(await page.text(),/Flat Dive/);
 const traversal=await fetch(base+'/questions.js');assert.equal(traversal.status,404);
});
test('curated aliases normalize consistently',()=>{assert.equal(judge(questions[2],'SULPHUR').answer,'sulfur');assert.equal(judge(questions[5],'X-Men').answer,'x men');assert.equal(judge(questions[0],'nonsense'),null)});
test('recorded archives retain all seven questions and source tiers',async t=>{
 const {readFile}=await import('node:fs/promises');const archive=JSON.parse(await readFile(new URL('../data/archive.json',import.meta.url),'utf8'));
 assert.ok(archive.dives.length>=7);
 for(const dive of archive.dives){assert.equal(dive.questions.length,7);for(const q of dive.questions){assert.ok(q.answers.length>0);assert.match(q.source,/^https:\/\/krillionanswers.com\/questions\//)}}
 const server=createGameServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=async(action,b)=>(await fetch(base+'/api/'+action,{method:'POST',body:JSON.stringify(b)})).json();
 const list=await (await fetch(base+'/api/dives')).json();assert.equal(list.dives.length,archive.dives.length+1);assert.equal(JSON.stringify(list).includes('Yttrium'),false);
 const dive=archive.dives.at(-1);const p=await post('join',{name:'Archive player',diveId:dive.id});const auth={code:p.code,playerId:p.playerId};assert.equal(p.diveId,dive.id);
 for(let i=0;i<7;i++){const s=await post('next',auth);assert.equal(s.question.text,dive.questions[i].text);const a=dive.questions[i].answers[0];assert.ok(a);const result=await post('answer',{...auth,answer:a.answer});assert.equal(result.results[i].score,scores[a.tier]);assert.equal(result.results[i].tier,a.tier)}
 const final=await post('state',auth);assert.equal(final.board[0].score,dive.questions.reduce((n,q)=>n+scores[q.answers[0].tier],0));assert.equal(final.answers.length,7);
});
