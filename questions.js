import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';

export const scores={plankton:10,tooclever:15,schooler:30,rare:60,deepcut:85,krillion:100};
export const bank=JSON.parse(readFileSync(new URL('./data/questions.json',import.meta.url),'utf8'));
export const questions=bank.questions;
export const normalize=value=>value.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const answers=new Map(questions.map(q=>{
 const index=new Map();
 for(const a of q.answers)for(const word of [a.answer,...a.aliases]){
  const key=normalize(word);if(!index.has(key))index.set(key,a);
 }
 return [q.id,index];
}));
export function judge(question,raw){return answers.get(question.id)?.get(normalize(raw))??null}
export function selectQuestions(seen=[],size=7){
 const history=new Map(seen.map((id,i)=>[id,i]));
 const fresh=questions.filter(q=>!history.has(q.id));
 for(let i=fresh.length-1;i>0;i--){const j=randomInt(i+1);[fresh[i],fresh[j]]=[fresh[j],fresh[i]]}
 // Once the bank is exhausted, return the least recently seen first.
 const older=questions.filter(q=>history.has(q.id)).sort((a,b)=>history.get(a.id)-history.get(b.id));
 return {questions:[...fresh,...older].slice(0,size),freshCount:Math.min(fresh.length,size)};
}
