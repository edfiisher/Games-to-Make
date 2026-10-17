// Independently curated prototype data. Tiers are not Krillion's answer data.
const make=(id,text,groups)=>({id,text,answers:groups.flatMap(([tier,words])=>words.split('|').map(word=>{const [answer,...aliases]=word.split('=');return {answer,aliases,tier}}))});
export const scores={plankton:10,tooclever:15,schooler:30,rare:60,deepcut:85,krillion:100};
export const questions=[
make('potato','Name a way to prepare potatoes',[
 ['plankton','mashed=mash|fried=fries|baked=bake'],['schooler','roasted=roast|boiled=boil|chips=crisps'],['tooclever','vodka'],['rare','gratin=dauphinoise|gnocchi|hasselback'],['deepcut','fondant|duchesse'],['krillion','pommes anna=anna potatoes']]),
make('animal','Name an animal whose name is exactly four letters long',[
 ['plankton','bear|lion|wolf'],['schooler','frog|deer|goat|duck|crab|fish'],['tooclever','kiwi'],['rare','ibex|lynx|mole|newt|toad|hare|seal|swan|orca'],['deepcut','kudu|oryx|rhea|dodo|puma'],['krillion','tahr']]),
make('element','Name a chemical element whose symbol is one letter',[
 ['plankton','hydrogen=h|oxygen=o|carbon=c'],['schooler','nitrogen=n|sulfur=sulphur=s|phosphorus=p'],['rare','potassium=k|fluorine=f|iodine=i|boron=b'],['deepcut','tungsten=w|vanadium=v|uranium=u'],['krillion','yttrium=y']]),
make('country','Name a country whose English name ends in E',[
 ['plankton','france'],['schooler','greece|chile'],['tooclever','zimbabwe'],['rare','singapore|ukraine|belize|cape verde=cabo verde|sierra leone'],['deepcut',"mozambique|suriname|sao tome and principe=são tomé and príncipe"],['krillion',"east timor=timor leste=timor-leste"]]),
make('station','Name a type of station',[
 ['plankton','train=railway=rail|bus'],['schooler','police|fire|space|radio|petrol=gas'],['tooclever','playstation'],['rare','weather|power|television=tv|research|coastguard'],['deepcut','pumping|seismic|whaling'],['krillion','lifeboat']]),
make('team','Name a superhero team',[
 ['plankton','avengers=the avengers|justice league'],['schooler','x men=x-men|fantastic four=fantastic 4|teen titans'],['tooclever','guardians of the galaxy'],['rare','defenders=the defenders|doom patrol|suicide squad|young justice'],['deepcut','alpha flight|excalibur|new mutants'],['krillion','great lakes avengers']]),
make('moon','Name a moon in our Solar System',[
 ['plankton','moon=the moon=luna'],['schooler','titan|europa|io'],['tooclever','enceladus'],['rare','ganymede|callisto|phobos|deimos|triton'],['deepcut','iapetus|rhea|dione|tethys|miranda|oberon|titania'],['krillion','hyperion']])];
export const normalize=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function judge(question,raw){const value=normalize(raw);return question.answers.find(a=>[a.answer,...a.aliases].some(x=>normalize(x)===value))??null}
export const publicQuestions=questions.map(({id,text})=>({id,text}));
