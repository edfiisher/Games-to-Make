import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {questions,scores,judge} from './questions.js';
import {readFileSync} from 'node:fs';
const archive=JSON.parse(readFileSync(new URL('./data/archive.json',import.meta.url),'utf8'));
const dives=[...archive.dives,{id:'practice',label:'Original practice set',questions}];
const ROUND_MS=25000, MAX_BODY=4096;
export function createGameServer({now=Date.now}={}) {
 const rooms=new Map();
 const token=()=>randomBytes(16).toString('hex');
 function state(room,player){
  if(player?.phase==='answering' && now()>=player.deadline)finish(room,player,null,null);
  const completed=player?.results.length===7;
  return {code:room.code,playerId:player?.id,phase:player?.phase,deadline:player?.deadline,serverNow:now(),round:player?.results.length??0,diveId:room.dive.id,diveLabel:room.dive.label,question:!completed&&player?{id:room.dive.questions[player.results.length].id,text:room.dive.questions[player.results.length].text}:null,results:player?.results??[],board:[...room.players.values()].map(p=>({name:p.name,score:p.results.reduce((s,r)=>s+r.score,0),rounds:p.results.length,done:p.results.length===7})).sort((a,b)=>b.score-a.score),...(completed?{answers:room.dive.questions.map(q=>({text:q.text,answers:q.answers.map(a=>({answer:a.answer,tier:a.tier,score:scores[a.tier]}))}))}:{})};
 }
 function finish(room,p,answer,raw){p.results.push({prompt:room.dive.questions[p.results.length].text,answer:answer?.answer??null,raw:raw??null,tier:answer?.tier??'miss',score:answer?scores[answer.tier]:0});p.phase='feedback';p.deadline=null}
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/api/dives'&&req.method==='GET')return send(200,{dives:dives.map(d=>({id:d.id,label:d.label,questions:d.questions.length,answerCount:d.questions.reduce((n,q)=>n+q.answers.length,0)}))});
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='POST')return send(405,{error:'Use POST'});
    let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>MAX_BODY)return send(413,{error:'Request too large'})}
    let b;try{b=JSON.parse(body)}catch{return send(400,{error:'Invalid request'})}
    if(!b||typeof b!=='object')return send(400,{error:'Invalid request'});
    if(url.pathname==='/api/join'){
     if(typeof b.name!=='string'||!b.name.trim()||b.name.length>24)return send(400,{error:'Enter a name (1–24 characters)'});
     if(b.code!=null&&typeof b.code!=='string')return send(400,{error:'Invalid room code'});
     const code=b.code?.trim().toUpperCase();let room;
     if(code){room=rooms.get(code);if(!room)return send(404,{error:'Room not found. Check the code.'})}
     else{if(rooms.size>=100)return send(503,{error:'Server full'});let c;do{c=randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(c));const dive=dives.find(d=>d.id===(b.diveId??dives[0].id));if(!dive)return send(400,{error:'Choose an available dive'});room={code:c,dive,players:new Map()};rooms.set(c,room)}
     if(room.players.size>=12)return send(409,{error:'Room full (12 players)'});
     const p={id:token(),name:b.name.trim(),results:[],phase:'intro',deadline:null};room.players.set(p.id,p);return send(200,state(room,p));
    }
    const room=rooms.get(b.code),p=room?.players.get(b.playerId);if(!p)return send(404,{error:'Session not found. Join a room again.'});
    state(room,p);
    if(url.pathname==='/api/next'){
     if(p.phase==='intro'||p.phase==='feedback') {if(p.results.length===7)p.phase='done';else{p.phase='answering';p.deadline=now()+ROUND_MS}}
    }else if(url.pathname==='/api/answer'){
     if(p.phase!=='answering')return send(409,{error:'Round ended',state:state(room,p)});
     if(typeof b.answer!=='string'||b.answer.length>160)return send(400,{error:'Answer too long'});
     const a=judge(room.dive.questions[p.results.length],b.answer);
     if(a)finish(room,p,a,b.answer);else return send(200,{...state(room,p),rejected:'That answer is not in the recorded answer list. Try another.'});
    }else if(url.pathname==='/api/skip'){
     if(p.phase==='answering')finish(room,p,null,null);
    }else if(url.pathname!=='/api/state')return send(404,{error:'Not found'});
    return send(200,state(room,p));
   }
   if(req.method!=='GET')return send(405,{error:'Use GET'});
   const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
   const f=files[url.pathname];if(!f)return send(404,{error:'Not found'});
   res.writeHead(200,{'Content-Type':f[1]+'; charset=utf-8','X-Content-Type-Options':'nosniff'});res.end(await readFile(new URL('./public/'+f[0],import.meta.url)));
  }catch{if(!res.headersSent)send(500,{error:'Server error'});else res.end()}
 });return server;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const port=Number(process.env.PORT??3000);createGameServer().listen(port,'0.0.0.0',()=>console.log(`Flat Dive listening on port ${port}`))}
