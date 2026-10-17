import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const origin='https://krillionanswers.com';
const scores={plankton:10,tooclever:15,schooler:30,rare:60,deepcut:85,krillion:100};
const modes=['daily','movies','sports','geography','unlimited'];
async function get(path,json=true){
 const response=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error(`Source request failed (${response.status}): ${path}`);
 return json?response.json():response.text();
}
const page=await get('/answer-finder/',false);
const expected=Number(page.match(/<strong>([\d,]+)<\/strong><span>Indexed Question Records/)[1].replaceAll(',',''));
const records=new Map();
for(const mode of modes){
 const {results}=await get('/api/answers/index/?'+new URLSearchParams({q:'Name',mode,limit:'80'}));
 for(const {document:d} of results)if(d.kind==='prompt')records.set(d.promptId,d);
}
if(records.size!==expected)throw Error(`Search coverage incomplete: ${records.size}/${expected} records; investigate paging before refreshing`);
// Repeated historical records are the same question, not fresh content.
const unique=new Map();
for(const d of [...records.values()].sort((a,b)=>b.officialDate.localeCompare(a.officialDate))){
 const key=d.promptText.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 if(!unique.has(key))unique.set(key,{...d,key});
}
const questions=[];
for(const d of unique.values()){
 const {answers}=await get('/api/answers/index/?'+new URLSearchParams({promptId:d.promptId}));
 if(!Array.isArray(answers)||!answers.length||answers.length!==d.answerCount)throw Error(`Incomplete answers: ${d.promptId}`);
 questions.push({id:createHash('sha256').update(d.key).digest('hex').slice(0,24),text:d.promptText,source:origin+d.href,sourceRecord:d.promptId,mode:d.modeSlug,recordedAt:d.officialDate,answers:answers.map(a=>{
  if(!a.text?.trim()||scores[a.tier]!==a.score)throw Error(`Invalid tier or score: ${d.promptId}`);
  return {answer:a.text,aliases:[],tier:a.tier};
 })});
 if(questions.length%20===0)console.log(`Validated ${questions.length}/${unique.size} unique questions`);
}
if(questions.length<49)throw Error('Unexpected question-bank regression');
const data={source:origin+'/answer-finder/',retrievedAt:new Date().toISOString(),indexedRecords:records.size,note:'Deduplicated third-party recorded reveal data; latest record retained per question. Tiers are recorded, not live-validator verified. Source endpoint does not supply aliases.',questions};
await writeFile(new URL('../data/questions.json',import.meta.url),JSON.stringify(data,null,2)+'\n');
console.log(`Saved ${questions.length} distinct questions and ${questions.reduce((n,q)=>n+q.answers.length,0)} recorded answer entries from ${records.size} historical records`);
