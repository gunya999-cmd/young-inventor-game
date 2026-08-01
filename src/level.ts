import type { PartKind, PartState, SignalLink } from './model';

export const CUSTOM_LEVEL_STORAGE_KEY = 'young-inventor:custom-level:v1';
export const SELECTED_LEVEL_STORAGE_KEY = 'young-inventor:campaign:selected:v1';
export interface LevelPlatform { id:string;x:number;y:number;width:number;height:number;angle:number; }
export interface LevelReceiver { x:number;y:number;innerWidth:number;innerHeight:number;wallThickness:number;floorThickness:number; }
export interface LevelSpec {
 id:string;number:number;title:string;subtitle:string;gravity:number;platforms:LevelPlatform[];receiver:LevelReceiver;
 initialParts:PartState[];initialSignals:SignalLink[];inventory:Readonly<Record<PartKind,number>>;maxRopes:number;maxHinges:number;
 targetPartId?:string; parTime?:number; parParts?:number;
}

const EMPTY_INVENTORY:Record<PartKind,number>={ball:0,plank:0,wall:0,lever:0,pulley:0,weight:0,domino:0,rubberball:0,spring:0,magnet:0,sheave:0,motor:0,gear:0,conveyor:0,switch:0,button:0,latch:0};
function inventory(values:Partial<Record<PartKind,number>>):Readonly<Record<PartKind,number>>{return {...EMPTY_INVENTORY,...values};}
function campaignLevel(number:number,id:string,title:string,subtitle:string,available:Partial<Record<PartKind,number>>,parTime:number,parParts:number):LevelSpec{
 const receiverX=1380;
 return {id,number,title,subtitle,gravity:9.81,
  platforms:[{id:'floor',x:800,y:815,width:1500,height:30,angle:0},{id:'start',x:260,y:300,width:390,height:24,angle:.18},{id:'mid',x:770,y:500,width:300,height:24,angle:number%2?.06:-.05},{id:'finish',x:1180,y:610,width:270,height:24,angle:.04}],
  receiver:{x:receiverX,y:680,innerWidth:150,innerHeight:105,wallThickness:22,floorThickness:22},
  initialParts:[{id:'target-ball',kind:'ball',x:105,y:175,angle:0,fixed:false,locked:true}],initialSignals:[],inventory:inventory(available),maxRopes:number>=3?2:1,maxHinges:number>=2?2:1,targetPartId:'target-ball',parTime,parParts};
}

/**
 * Level 01 is intentionally authored separately from the campaign template.
 * It is the interaction tutorial and therefore has one readable problem:
 * bridge a single large drop with exactly three movable guide rails.
 */
export const LEVEL_01:LevelSpec={
 id:'first-ramp',number:1,title:'Первый маршрут',
 subtitle:'Соедини стартовую площадку с финишем тремя направляющими и проведи шар в приёмник.',
 gravity:9.81,
 platforms:[
  {id:'floor',x:800,y:820,width:1560,height:30,angle:0},
  {id:'left-safety',x:32,y:470,width:24,height:700,angle:0},
  {id:'right-safety',x:1568,y:470,width:24,height:700,angle:0},
  {id:'start-ramp',x:270,y:260,width:380,height:24,angle:.14},
  {id:'finish-ramp',x:1160,y:500,width:300,height:24,angle:.07}
 ],
 receiver:{x:1400,y:610,innerWidth:150,innerHeight:110,wallThickness:22,floorThickness:22},
 initialParts:[{id:'target-ball',kind:'ball',x:105,y:170,angle:0,fixed:false,locked:true}],
 initialSignals:[],inventory:inventory({plank:3}),maxRopes:0,maxHinges:0,targetPartId:'target-ball',parTime:12,parParts:3
};
export const LEVEL_02=campaignLevel(2,'balance','Равновесие','Используй балансир и ось, чтобы передать шару импульс.',{plank:3,lever:1,weight:1},22,4);
export const LEVEL_03=campaignLevel(3,'rope-work','Верёвочная работа','Проведи шар через механизм с верёвкой и шкивом.',{plank:3,lever:1,sheave:2,weight:1},28,5);
export const LEVEL_04=campaignLevel(4,'spring-step','Пружинный шаг','Подбрось шар пружиной на следующую секцию.',{plank:3,spring:1,domino:4},26,5);
export const LEVEL_05=campaignLevel(5,'airflow','Воздушный поток','Используй вентилятор, чтобы скорректировать траекторию шара.',{plank:3,pulley:1,domino:5},28,5);
export const LEVEL_06=campaignLevel(6,'automation','Автоматика','Собери цепочку с переключателем и управляемым устройством.',{plank:3,conveyor:1,switch:1,spring:1,domino:5},32,6);
export const LEVEL_07:LevelSpec={
 id:'impulse-and-moment',number:7,title:'Импульс и момент',subtitle:'Подними контрольный шар выше центральной перегородки и доставь его в приёмник.',gravity:9.81,
 platforms:[{id:'floor',x:800,y:815,width:1500,height:30,angle:0},{id:'start-rail',x:285,y:295,width:440,height:26,angle:.24},{id:'left-bench',x:610,y:465,width:250,height:24,angle:.055},{id:'barrier',x:825,y:585,width:30,height:320,angle:0},{id:'right-bench',x:1080,y:510,width:300,height:24,angle:.04}],
 receiver:{x:1390,y:650,innerWidth:150,innerHeight:110,wallThickness:22,floorThickness:22},
 initialParts:[{id:'target-ball',kind:'ball',x:115,y:170,angle:0,fixed:false,locked:true},{id:'level-weight',kind:'weight',x:330,y:650,angle:0,fixed:false,locked:true},{id:'level-latch',kind:'latch',x:330,y:710,angle:0,fixed:true,locked:true},{id:'level-lever-lock',kind:'latch',x:535,y:642,angle:0,fixed:true,locked:true},{id:'level-button',kind:'button',x:825,y:610,angle:-Math.PI/2,fixed:true,locked:true}],
 initialSignals:[{id:'level-signal-weight',sourcePartId:'level-button',targetPartId:'level-latch',action:'release'},{id:'level-signal-lever',sourcePartId:'level-button',targetPartId:'level-lever-lock',action:'release'}],
 inventory:inventory({plank:3,lever:1,pulley:1,domino:6,spring:1,sheave:2,motor:1,gear:3,conveyor:1,switch:1}),maxRopes:3,maxHinges:2,targetPartId:'target-ball',parTime:38,parParts:8
};
export const CAMPAIGN_LEVELS:ReadonlyArray<LevelSpec>=[LEVEL_01,LEVEL_02,LEVEL_03,LEVEL_04,LEVEL_05,LEVEL_06,LEVEL_07];

const PART_KINDS:PartKind[]=['ball','plank','wall','lever','pulley','weight','domino','rubberball','spring','magnet','sheave','motor','gear','conveyor','switch','button','latch'];
const finite=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value);
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));

export function normalizeLevel(value:unknown,fallback:LevelSpec=LEVEL_07):LevelSpec|null{
 if(!value||typeof value!=='object')return null; const raw=value as Partial<LevelSpec>;
 if(typeof raw.id!=='string'||!raw.id.trim()||typeof raw.title!=='string'||typeof raw.subtitle!=='string')return null;
 if(!Array.isArray(raw.platforms)||!Array.isArray(raw.initialParts)||!Array.isArray(raw.initialSignals)||!raw.receiver||!raw.inventory)return null;
 const parts=raw.initialParts.filter((part):part is PartState=>Boolean(part&&typeof part.id==='string'&&PART_KINDS.includes(part.kind)&&finite(part.x)&&finite(part.y)&&finite(part.angle)&&typeof part.fixed==='boolean')).map(part=>({...part,locked:true}));
 if(!parts.length)return null; const ids=new Set(parts.map(part=>part.id)); const targetPartId=typeof raw.targetPartId==='string'&&ids.has(raw.targetPartId)?raw.targetPartId:parts[0].id;
 const inv={} as Record<PartKind,number>; for(const kind of PART_KINDS)inv[kind]=clamp(Math.round(Number((raw.inventory as Record<string,unknown>)[kind])||0),0,99);
 const receiver=raw.receiver as Partial<LevelReceiver>; if(!finite(receiver.x)||!finite(receiver.y)||!finite(receiver.innerWidth)||!finite(receiver.innerHeight))return null;
 return {id:raw.id.trim(),number:clamp(Math.round(Number(raw.number)||1),1,999),title:raw.title.trim()||fallback.title,subtitle:raw.subtitle.trim(),gravity:clamp(Number(raw.gravity)||9.81,0,30),
  platforms:raw.platforms.filter((p):p is LevelPlatform=>Boolean(p&&typeof p.id==='string'&&finite(p.x)&&finite(p.y)&&finite(p.width)&&finite(p.height)&&finite(p.angle))).map(p=>({...p,width:clamp(p.width,10,3000),height:clamp(p.height,5,1000)})),
  receiver:{x:receiver.x,y:receiver.y,innerWidth:clamp(receiver.innerWidth,40,600),innerHeight:clamp(receiver.innerHeight,40,500),wallThickness:clamp(Number(receiver.wallThickness)||22,5,100),floorThickness:clamp(Number(receiver.floorThickness)||22,5,100)},
  initialParts:parts,initialSignals:raw.initialSignals.filter(link=>Boolean(link&&typeof link.id==='string'&&ids.has(link.sourcePartId)&&ids.has(link.targetPartId)&&(link.action==='activate'||link.action==='release'))).map(link=>({...link})),
  inventory:inv,maxRopes:clamp(Math.round(Number(raw.maxRopes)||0),0,20),maxHinges:clamp(Math.round(Number(raw.maxHinges)||0),0,20),targetPartId,
  parTime:finite(raw.parTime)?clamp(raw.parTime,1,600):fallback.parTime,parParts:finite(raw.parParts)?clamp(Math.round(raw.parParts),1,99):fallback.parParts};
}

function loadActiveLevel():LevelSpec{
 if(typeof localStorage==='undefined')return LEVEL_07;
 const custom=localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY); if(custom){try{return normalizeLevel(JSON.parse(custom))??LEVEL_07;}catch{/* ignore */}}
 const selected=localStorage.getItem(SELECTED_LEVEL_STORAGE_KEY); return CAMPAIGN_LEVELS.find(level=>level.id===selected)??LEVEL_07;
}
export const ACTIVE_LEVEL=loadActiveLevel();
