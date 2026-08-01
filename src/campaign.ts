import { ACTIVE_LEVEL, CAMPAIGN_LEVELS, CUSTOM_LEVEL_STORAGE_KEY, SELECTED_LEVEL_STORAGE_KEY, type LevelSpec } from './level';

export const CAMPAIGN_PROGRESS_KEY='young-inventor:campaign:progress:v1';
export interface LevelProgress { stars:number; bestTime:number; fewestParts:number; completed:boolean; }
export interface CampaignProgress { levels:Record<string,LevelProgress>; }

const CAMPAIGN_LEVEL_IDS=new Set(CAMPAIGN_LEVELS.map(level=>level.id));
const finiteNonNegative=(value:unknown):value is number=>typeof value==='number'&&Number.isFinite(value)&&value>=0;

function normalizeLevelProgress(value:unknown):LevelProgress|null{
 if(!value||typeof value!=='object')return null;
 const raw=value as Partial<LevelProgress>;
 if(typeof raw.completed!=='boolean'||!Number.isInteger(raw.stars)||raw.stars!<0||raw.stars!>3||!finiteNonNegative(raw.bestTime)||!Number.isInteger(raw.fewestParts)||raw.fewestParts!<0)return null;
 return {completed:raw.completed,stars:raw.stars!,bestTime:raw.bestTime,fewestParts:raw.fewestParts!};
}

export function loadCampaignProgress(storage:Pick<Storage,'getItem'>=localStorage):CampaignProgress{
 try{
  const raw=storage.getItem(CAMPAIGN_PROGRESS_KEY);if(!raw)return{levels:{}};
  const parsed=JSON.parse(raw) as {levels?:unknown};
  if(!parsed||typeof parsed!=='object'||!parsed.levels||typeof parsed.levels!=='object'||Array.isArray(parsed.levels))return{levels:{}};
  const levels:Record<string,LevelProgress>={};
  for(const [levelId,value] of Object.entries(parsed.levels as Record<string,unknown>)){
   if(!CAMPAIGN_LEVEL_IDS.has(levelId))continue;
   const normalized=normalizeLevelProgress(value);if(normalized)levels[levelId]=normalized;
  }
  return{levels};
 }catch{return{levels:{}};}
}
export function calculateStars(level:LevelSpec,elapsed:number,usedParts:number):number{
 const parTime=level.parTime??30,parParts=level.parParts??6;
 if(elapsed<=parTime&&usedParts<=parParts)return 3;
 if(elapsed<=parTime*1.5||usedParts<=Math.ceil(parParts*1.5))return 2;
 return 1;
}
export function recordCompletion(progress:CampaignProgress,level:LevelSpec,elapsed:number,usedParts:number):CampaignProgress{
 const previous=progress.levels[level.id]; const stars=calculateStars(level,elapsed,usedParts);
 return{levels:{...progress.levels,[level.id]:{completed:true,stars:Math.max(previous?.stars??0,stars),bestTime:previous?Math.min(previous.bestTime,elapsed):elapsed,fewestParts:previous?Math.min(previous.fewestParts,usedParts):usedParts}}};
}
export function isLevelUnlocked(level:LevelSpec,progress:CampaignProgress):boolean{
 const index=CAMPAIGN_LEVELS.findIndex(candidate=>candidate.id===level.id);if(index<=0)return true;return Boolean(progress.levels[CAMPAIGN_LEVELS[index-1].id]?.completed);
}
export function nextCampaignLevel(level:LevelSpec):LevelSpec|null{const i=CAMPAIGN_LEVELS.findIndex(candidate=>candidate.id===level.id);return i>=0&&i<CAMPAIGN_LEVELS.length-1?CAMPAIGN_LEVELS[i+1]:null;}
export function isCampaignCompletionEligible(levelId:string,storage:Pick<Storage,'getItem'>=localStorage):boolean{
 if(storage.getItem(CUSTOM_LEVEL_STORAGE_KEY))return false;
 return CAMPAIGN_LEVEL_IDS.has(levelId);
}

function saveProgress(progress:CampaignProgress):void{localStorage.setItem(CAMPAIGN_PROGRESS_KEY,JSON.stringify(progress));}
function selectLevel(level:LevelSpec):void{localStorage.removeItem(CUSTOM_LEVEL_STORAGE_KEY);localStorage.setItem(SELECTED_LEVEL_STORAGE_KEY,level.id);location.reload();}
function starsText(stars:number):string{return '★'.repeat(stars)+'☆'.repeat(3-stars);}

export function installCampaign():void{
 if(document.querySelector('#campaign-open'))return;
 const host=document.querySelector<HTMLElement>('.workspace')??document.body;
 const button=document.createElement('button');button.id='campaign-open';button.className='tool-button';button.textContent=`🗺 Кампания · ${ACTIVE_LEVEL.number}`;host.prepend(button);
 const overlay=document.createElement('div');overlay.id='campaign-overlay';overlay.hidden=true;overlay.innerHTML=`<section id="campaign-panel"><header><div><strong>Кампания юного изобретателя</strong><small>Проходи уровни по порядку и улучшай лучший результат.</small></div><button id="campaign-close">×</button></header><div id="campaign-summary"></div><div id="campaign-levels"></div></section>`;document.body.appendChild(overlay);
 const style=document.createElement('style');style.textContent=`#campaign-open{margin:8px 12px}#campaign-overlay{position:fixed;inset:0;z-index:10020;background:rgba(3,9,13,.82);display:grid;place-items:center;padding:18px}#campaign-overlay[hidden]{display:none}#campaign-panel{width:min(900px,96vw);max-height:92vh;overflow:auto;background:#12232d;color:#eefaff;border:1px solid #456a79;border-radius:18px;padding:20px;box-shadow:0 28px 80px #000}#campaign-panel header{display:flex;justify-content:space-between;gap:20px;align-items:center}#campaign-panel header small{display:block;opacity:.65;margin-top:4px}#campaign-panel button{border:1px solid #4e7180;border-radius:9px;background:#203b48;color:#fff;padding:9px 12px}#campaign-summary{margin:16px 0;padding:12px;border-radius:12px;background:#0c1b23}.campaign-card{display:grid;grid-template-columns:70px 1fr auto;gap:14px;align-items:center;padding:14px;margin:9px 0;border:1px solid #365563;border-radius:13px;background:#172c37}.campaign-card.current{border-color:#70d7f1;box-shadow:0 0 0 1px rgba(112,215,241,.3)}.campaign-card.locked{opacity:.45}.campaign-number{font-size:26px;font-weight:900;text-align:center}.campaign-meta strong{display:block;font-size:15px}.campaign-meta small{display:block;opacity:.68;margin-top:4px}.campaign-stars{color:#ffd35b;font-size:20px;letter-spacing:2px}.campaign-best{font-size:11px;opacity:.72;margin-top:4px}@media(max-width:650px){.campaign-card{grid-template-columns:48px 1fr}.campaign-card>button{grid-column:1/-1}}`;document.head.appendChild(style);
 const render=()=>{const progress=loadCampaignProgress();const earned=Object.values(progress.levels).reduce((sum,item)=>sum+item.stars,0);const completed=Object.values(progress.levels).filter(item=>item.completed).length;overlay.querySelector('#campaign-summary')!.textContent=`Пройдено: ${completed}/${CAMPAIGN_LEVELS.length} · Звёзды: ${earned}/${CAMPAIGN_LEVELS.length*3}`;const list=overlay.querySelector('#campaign-levels')!;list.innerHTML='';for(const level of CAMPAIGN_LEVELS){const result=progress.levels[level.id];const unlocked=isLevelUnlocked(level,progress);const card=document.createElement('article');card.className=`campaign-card${level.id===ACTIVE_LEVEL.id?' current':''}${unlocked?'':' locked'}`;card.innerHTML=`<div class="campaign-number">${unlocked?level.number:'🔒'}</div><div class="campaign-meta"><strong>${level.title}</strong><small>${level.subtitle}</small><div class="campaign-stars">${starsText(result?.stars??0)}</div><div class="campaign-best">${result?`Лучшее: ${result.bestTime.toFixed(1)}с · ${result.fewestParts} дет.`:`Пар: ${level.parTime??30}с · ${level.parParts??6} дет.`}</div></div><button ${unlocked?'':'disabled'}>${level.id===ACTIVE_LEVEL.id?'Текущий':'Играть'}</button>`;card.querySelector('button')!.addEventListener('click',()=>selectLevel(level));list.appendChild(card);}};
 button.onclick=()=>{render();overlay.hidden=false;};overlay.querySelector<HTMLButtonElement>('#campaign-close')!.onclick=()=>overlay.hidden=true;
 window.addEventListener('tim-level-complete',(event)=>{const detail=(event as CustomEvent<{elapsed:number;usedParts:number;levelId:string}>).detail;if(!detail||detail.levelId!==ACTIVE_LEVEL.id||!isCampaignCompletionEligible(detail.levelId))return;const progress=recordCompletion(loadCampaignProgress(),ACTIVE_LEVEL,detail.elapsed,detail.usedParts);saveProgress(progress);const result=progress.levels[ACTIVE_LEVEL.id];let resultInfo=document.querySelector<HTMLElement>('#campaign-result');if(!resultInfo){resultInfo=document.createElement('div');resultInfo.id='campaign-result';document.querySelector('#result-card')?.appendChild(resultInfo);}if(resultInfo){resultInfo.innerHTML=`<strong>${starsText(result.stars)}</strong><small> Лучшее: ${result.bestTime.toFixed(1)}с · ${result.fewestParts} дет.</small>`;const next=nextCampaignLevel(ACTIVE_LEVEL);if(next&&isLevelUnlocked(next,progress)){const nextButton=document.createElement('button');nextButton.textContent='Следующий уровень →';nextButton.onclick=()=>selectLevel(next);resultInfo.appendChild(nextButton);}}button.textContent=`🗺 Кампания · ${ACTIVE_LEVEL.number}`;});
}
