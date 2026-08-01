import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { evaluateBuildReadiness, type BuildReadiness } from './levelRules';
import { getLevelPresentation } from './levelPresentation';
import type { MachineSnapshot } from './model';
import {
  LEVEL01_BONUSES,
  level01AttemptNumber,
  level01CollectedCount,
  level01HintVisible,
  loadLevel01Best,
  resetLevel01Attempt,
  saveLevel01Best,
  scoreLevel01,
  setLevel01HintVisible,
  updateLevel01Bonuses
} from './level01Gameplay';

type AppInternals={
 snapshot:MachineSnapshot;
 runtimeSnapshot:MachineSnapshot;
 runStartSnapshot:MachineSnapshot;
 mode:string;
 completed:boolean;
 elapsed:number;
 start:()=>void;
 stop:()=>void;
 updateUi:()=>void;
 setStatus:(message:string)=>void;
};

const COACH_KEY='young-inventor:level-01:coach-collapsed:v2';
const FAILED_TRIAL_SECONDS=14;

function hideAdvancedControls():void{
 const propertyGroups=[...document.querySelectorAll<HTMLElement>('.property-group')];
 for(const group of propertyGroups){
  const title=group.querySelector('h3')?.textContent?.trim();
  if(title==='Положение'||title==='Крепление'||title==='Действия')group.hidden=true;
 }
 const project=document.querySelector<HTMLElement>('.project-actions');
 if(project)project.hidden=true;
 const camera=document.querySelector<HTMLElement>('#camera-button');
 if(camera)camera.hidden=true;
}

function installGameShell():void{
 document.body.classList.add('level01-game-shell');
 const toolbar=document.querySelector<HTMLElement>('.top-toolbar');
 const campaign=document.querySelector<HTMLButtonElement>('#campaign-open');
 if(toolbar&&campaign){
  campaign.classList.add('level01-levels-button');
  campaign.textContent='← Уровни';
  toolbar.prepend(campaign);
 }
 const controls=document.querySelector<HTMLElement>('.simulation-controls');
 if(controls&&!document.querySelector('#level01-reset')){
  const reset=document.createElement('button');
  reset.id='level01-reset';
  reset.className='tool-button level01-reset';
  reset.type='button';
  reset.title='Начать уровень заново';
  reset.setAttribute('aria-label','Начать уровень заново');
  reset.textContent='↻';
  reset.addEventListener('click',()=>location.reload());
  controls.insertBefore(reset,document.querySelector('#run-button'));
 }
}

function ensureTakeaway():HTMLElement|null{
 const card=document.querySelector<HTMLElement>('#result-card');
 if(!card)return null;
 let takeaway=card.querySelector<HTMLElement>('.level-takeaway');
 if(!takeaway){
  takeaway=document.createElement('div');
  takeaway.className='level-takeaway';
  const time=card.querySelector('#result-time');
  card.insertBefore(takeaway,time);
 }
 return takeaway;
}

function ensureResultScore():HTMLElement|null{
 const card=document.querySelector<HTMLElement>('#result-card');
 if(!card)return null;
 let score=card.querySelector<HTMLElement>('.level01-result-score');
 if(!score){
  score=document.createElement('div');
  score.className='level01-result-score';
  const takeaway=card.querySelector('.level-takeaway');
  card.insertBefore(score,takeaway??card.querySelector('#result-time'));
 }
 return score;
}

function failedTrialMessage(snapshot:MachineSnapshot):string{
 const ball=snapshot.parts.find(part=>part.id===ACTIVE_LEVEL.targetPartId);
 const x=ball?.x??0;
 if(x<520)return 'Первый переход слишком резкий. Сдвинь первый рельс ближе к старту и дай шару плавно набрать скорость.';
 if(x<880)return 'Шар дошёл до середины. Убери ступеньку или зазор между первыми рельсами.';
 if(x<1240)return 'Почти получилось. Сделай последний переход к финишу мягче.';
 return 'Шар уже у цели. Чуть опусти конец последнего рельса в сторону контейнера.';
}

function scoreMarkup(score:ReturnType<typeof scoreLevel01>,best:ReturnType<typeof saveLevel01Best>):string{
 const medal=(earned:boolean,icon:string,title:string,copy:string)=>`<article class="result-medal${earned?' earned':''}"><i>${earned?icon:'○'}</i><div><b>${title}</b><span>${copy}</span></div></article>`;
 return `<div class="result-score-head"><strong>${score.medals}/3</strong><span>награды за решение</span><small>Лучшее: ${best.bestTime.toFixed(1)}с · бонусы ${best.bestBonuses}/${score.total}</small></div><div class="result-medals">${medal(score.smooth,'≈','Плавно','без резких стыков')}${medal(score.explorer,'✦','Все бонусы',`${score.collected}/${score.total} по пути`)}${medal(score.fast,'⚡','Быстро','быстрее 7,5 секунды')}</div>`;
}

function createMissionCard(frame:HTMLElement):HTMLElement{
 const mission=document.createElement('section');
 mission.id='level01-mission-card';
 mission.className='level01-mission-card';
 mission.innerHTML=`<small>ЗАДАЧА</small><strong>Доставь шар в контейнер</strong><p>Построй путь через разрыв. У тебя только три рельса.</p><div><span>3 рельса</span><span>3 бонуса</span></div>`;
 frame.appendChild(mission);
 return mission;
}

export function installLevel01Experience(appInstance:unknown):void{
 if(ACTIVE_LEVEL.id!=='first-ramp'||localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY))return;
 const app=appInstance as AppInternals;
 const frame=document.querySelector<HTMLElement>('.canvas-frame');
 if(!frame)return;
 const presentation=getLevelPresentation(ACTIVE_LEVEL);
 hideAdvancedControls();
 installGameShell();
 createMissionCard(frame);

 const resultAgain=document.querySelector<HTMLButtonElement>('#result-again');
 if(resultAgain)resultAgain.textContent='Попробовать лучше';

 const hud=document.createElement('section');
 hud.id='level01-hud';
 hud.className='level01-hud';
 hud.innerHTML=`<div class="hud-stat"><i>✦</i><b data-bonus-count>0/${LEVEL01_BONUSES.length}</b><span>бонусы</span></div><div class="hud-stat"><i>↻</i><b data-attempt>1</b><span>попытка</span></div><div class="hud-best"><small>ЛУЧШЕЕ</small><strong data-best>—</strong></div>`;
 frame.appendChild(hud);

 const coach=document.createElement('section');
 coach.id='level-coach';
 coach.className='level-coach';
 coach.innerHTML=`
  <header><div><small>ПОДСКАЗКА</small><strong>С чего начать</strong></div><button id="level-coach-toggle" type="button" aria-label="Свернуть подсказку">×</button></header>
  <div class="coach-progress"><span></span><b>0/3</b></div>
  <ol>
   <li data-step="place"><i>1</i><div><b>Поставь три рельса</b><span>Перетащи их из лотка на поле и перекрой большой разрыв.</span></div></li>
   <li data-step="rotate"><i>2</i><div><b>Сделай плавный спуск</b><span>Выбери рельс и поверни его. Стыки лучше немного перекрывать.</span></div></li>
   <li data-step="test"><i>3</i><div><b>Испытай маршрут</b><span>Нажми «Испытать» и смотри, где шар теряет скорость.</span></div></li>
  </ol>
  <p class="coach-feedback" hidden></p>
  <div class="coach-actions"><button id="level-hint-button" type="button" hidden>Показать пример</button></div>`;
 frame.appendChild(coach);

 const feedback=coach.querySelector<HTMLElement>('.coach-feedback')!;
 const hintButton=coach.querySelector<HTMLButtonElement>('#level-hint-button')!;
 let runAttempted=false;
 let failedAttempts=0;
 let attentionTimer=0;
 const collapsed=localStorage.getItem(COACH_KEY)==='1';
 coach.classList.toggle('collapsed',collapsed);

 const toggle=coach.querySelector<HTMLButtonElement>('#level-coach-toggle')!;
 const syncToggle=()=>{
  const isCollapsed=coach.classList.contains('collapsed');
  toggle.textContent=isCollapsed?'?':'×';
  toggle.setAttribute('aria-label',isCollapsed?'Показать подсказку':'Свернуть подсказку');
 };
 const flashCoach=()=>{
  coach.classList.remove('collapsed');
  coach.classList.add('attention');
  localStorage.setItem(COACH_KEY,'0');
  syncToggle();
  window.clearTimeout(attentionTimer);
  attentionTimer=window.setTimeout(()=>coach.classList.remove('attention'),700);
 };
 const syncHud=()=>{
  const count=hud.querySelector<HTMLElement>('[data-bonus-count]');if(count)count.textContent=`${level01CollectedCount()}/${LEVEL01_BONUSES.length}`;
  const attempt=hud.querySelector<HTMLElement>('[data-attempt]');if(attempt)attempt.textContent=String(level01AttemptNumber());
  const best=hud.querySelector<HTMLElement>('[data-best]');const record=loadLevel01Best();if(best)best.textContent=record?`${record.bestTime.toFixed(1)}с · ${record.bestMedals}/3`:'—';
 };
 syncToggle();syncHud();
 toggle.addEventListener('click',()=>{
  coach.classList.toggle('collapsed');
  localStorage.setItem(COACH_KEY,coach.classList.contains('collapsed')?'1':'0');
  syncToggle();
 });
 hintButton.addEventListener('click',()=>{
  const visible=!level01HintVisible();
  setLevel01HintVisible(visible);
  hintButton.textContent=visible?'Скрыть пример':'Показать пример';
  app.setStatus(visible?'Это только один из вариантов. Попробуй сделать по-своему.':'Пример скрыт.');
 });

 const render=(readiness:BuildReadiness=evaluateBuildReadiness(ACTIVE_LEVEL,app.snapshot))=>{
  const place=readiness.requirements.find(item=>item.id==='place-rails')?.met??false;
  const rotate=readiness.requirements.find(item=>item.id==='shape-route')?.met??false;
  const test=runAttempted||app.mode!=='build'||app.completed;
  const states={place,rotate,test};
  let completed=0;
  let activeAssigned=false;
  for(const [step,met] of Object.entries(states)){
   const item=coach.querySelector<HTMLElement>(`[data-step="${step}"]`);
   item?.classList.toggle('done',met);
   const active=!met&&!activeAssigned;
   item?.classList.toggle('active',active);
   if(active)activeAssigned=true;
   if(met)completed+=1;
  }
  const progress=coach.querySelector<HTMLElement>('.coach-progress span');
  if(progress)progress.style.width=`${completed/3*100}%`;
  const count=coach.querySelector<HTMLElement>('.coach-progress b');
  if(count)count.textContent=`${completed}/3`;
  coach.classList.toggle('ready',readiness.ready&&!test);
  coach.classList.toggle('complete',app.completed);
  document.querySelector<HTMLButtonElement>('#run-button')?.classList.toggle('level-ready',readiness.ready);
  syncHud();
 };

 const originalUpdate=app.updateUi.bind(app);
 app.updateUi=()=>{originalUpdate();render();};
 const originalStart=app.start.bind(app);
 app.start=()=>{
  const readiness=evaluateBuildReadiness(ACTIVE_LEVEL,app.snapshot);
  if(!readiness.ready){
   app.setStatus(readiness.message);
   render(readiness);
   flashCoach();
   return;
  }
  feedback.hidden=true;
  feedback.textContent='';
  runAttempted=true;
  resetLevel01Attempt();
  syncHud();
  originalStart();
  render(readiness);
 };

 const watchTrial=()=>{
  if(app.mode==='running'&&!app.completed){
   const collectedNow=updateLevel01Bonuses(app.runtimeSnapshot);
   if(collectedNow.length){
    syncHud();
    const total=level01CollectedCount();
    app.setStatus(`Бонус ${total}/${LEVEL01_BONUSES.length}`);
    hud.classList.remove('bonus-pulse');void hud.offsetWidth;hud.classList.add('bonus-pulse');
   }
   if(app.elapsed>=FAILED_TRIAL_SECONDS){
    const message=failedTrialMessage(app.runtimeSnapshot);
    app.stop();
    failedAttempts+=1;
    app.setStatus(message);
    feedback.textContent=message;
    feedback.hidden=false;
    hintButton.hidden=failedAttempts<1;
    flashCoach();
    render();
   }
  }
  requestAnimationFrame(watchTrial);
 };
 requestAnimationFrame(watchTrial);

 const takeaway=ensureTakeaway();
 if(takeaway)takeaway.innerHTML=`<small>ПОЧЕМУ ЭТО СРАБОТАЛО</small><strong>${presentation.takeaway}</strong>`;
 const resultScore=ensureResultScore();
 window.addEventListener('tim-level-complete',()=>{
  feedback.hidden=true;
  const score=scoreLevel01(app.runStartSnapshot,app.elapsed);
  const best=saveLevel01Best(score,app.elapsed);
  if(resultScore)resultScore.innerHTML=scoreMarkup(score,best);
  coach.classList.add('collapsed');
  localStorage.setItem(COACH_KEY,'1');
  syncToggle();syncHud();render();
 });

 app.setStatus('Соедини старт и цель тремя рельсами.');
 render();
}
