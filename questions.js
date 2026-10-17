import {readFileSync} from 'node:fs';
import {randomInt} from 'node:crypto';
import {createAnswerMatcher} from './answer-matching.js';

export const scores={plankton:10,tooclever:15,schooler:30,rare:60,deepcut:85,krillion:100};
export const bank=JSON.parse(readFileSync(new URL('./data/questions.json',import.meta.url),'utf8'));
export const questions=bank.questions;
export {normalize} from './answer-matching.js';
const matchers=new Map(questions.map(q=>[q.id,createAnswerMatcher(q)]));
export function judge(question,raw){return matchers.get(question.id)?.direct(raw)??null}
export function suggestAnswer(question,raw){return matchers.get(question.id)?.suggest(raw)??null}
export function selectQuestions(seen=[],size=7){
 const history=new Map(seen.map((id,i)=>[id,i]));
 const fresh=questions.filter(q=>!history.has(q.id));
 for(let i=fresh.length-1;i>0;i--){const j=randomInt(i+1);[fresh[i],fresh[j]]=[fresh[j],fresh[i]]}
 // Once the bank is exhausted, return the least recently seen first.
 const older=questions.filter(q=>history.has(q.id)).sort((a,b)=>history.get(a.id)-history.get(b.id));
 return {questions:[...fresh,...older].slice(0,size),freshCount:Math.min(fresh.length,size)};
}
