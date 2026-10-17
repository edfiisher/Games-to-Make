import {writeFile} from 'node:fs/promises';
const origin='https://krillionanswers.com';
const scores={plankton:10,tooclever:15,schooler:30,rare:60,deepcut:85,krillion:100};
async function get(path){const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Archive request failed: ${r.status}`);return r.json()}
const index=await get('/api/answers/index/?q=Name&mode=daily&limit=80');
const docs=index.results.map(r=>r.document).filter(d=>d.kind==='prompt'&&d.modeSlug==='daily');
if(index.results.length>=80)throw Error('Search reached limit; investigate pagination before importing');
const groups=new Map();
for(const d of docs){
 const {answers}=await get('/api/answers/index/?'+new URLSearchParams({promptId:d.promptId}));
 if(!Array.isArray(answers)||!answers.length||answers.length!==d.answerCount)throw Error('Incomplete answer set: '+d.promptId);
 const q={id:d.promptId,text:d.promptText,position:d.promptPosition,source:origin+d.href,answers:answers.map(a=>{
  if(typeof a.text!=='string'||!a.text.trim()||scores[a.tier]!==a.score)throw Error('Invalid answer: '+d.promptId);
  return {answer:a.text,aliases:[],tier:a.tier};
 })};
 if(!groups.has(d.sessionSlug))groups.set(d.sessionSlug,[]);groups.get(d.sessionSlug).push(q);
}
const dives=[...groups].sort(([a],[b])=>b.localeCompare(a)).map(([date,qs])=>{
 qs.sort((a,b)=>a.position-b.position);
 if(qs.length!==7||qs.some((q,i)=>q.position!==i+1))throw Error('Incomplete dive: '+date);
 return {id:date,label:date,questions:qs};
});
const data={source:origin+'/answer-finder/',retrievedAt:new Date().toISOString(),note:'Third-party recorded reveal data. Not independently verified against the live validator; no aliases supplied by the source endpoint.',dives};
await writeFile(new URL('../data/archive.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Imported ${dives.length} complete dives, ${docs.length} questions, ${dives.flatMap(d=>d.questions).reduce((n,q)=>n+q.answers.length,0)} recorded answers`);
