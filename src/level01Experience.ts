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

const COACH_KEY='young-inventor:level-01:coach-collapsed:v1';
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
 if(x<520)return 'Шар потерял скорость у первого перехода. Подними начало первого рельса и немного перекрой стартовую площадку.';
 if(x<880)return 'Маршрут работает до середины. Сделай переход между первыми рельсами плавнее — без ступеньки и большого зазора.';
 if(x<1240)return 'Почти готово. Последний рельс должен мягко вывести шар на финишную платформу.';
 return 'Шар добрался до финиша. Чуть направь последний рельс вниз и ближе к зелёному приёмнику.';
}

function scoreMarkup(score:ReturnType<typeof scoreLevel01>,best:ReturnType<typeof saveLevel01Best>):string{
 const medal=(earned:boolean,icon:string,title:string,copy:string)=>`<article class="result-medal${earned?' earned':''}"><i>${earned?icon:'○'}</i><div><b>${title}</b><span>${copy}</span></div></article>`;
 return `<div class="result-score-head"><strong>${score.medals}/3</strong><span>инженерных наград</span><small>Рекорд: ${best.bestTime.toFixed(1)}с · бонусы ${best.bestBonuses}/${score.total}</small></div><div class="result-medals">${medal(score.smooth,'≈','Плавный маршрут','стыки без резких ступенек')}${medal(score.explorer,'✦','Исследователь',`собрано ${score.collected}/${score.total} бонусов`)}${medal(score.fast,'⚡','Быстрый запуск','финиш быстрее 7,5 секунды')}</div>`;
}

export function installLevel01Experience(appInstance:unknown):void{
 if(ACTIVE_LEVEL.id!=='first-ramp'||localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY))return;
 const app=appInstance as AppInternals;
 const frame=document.querySelector<HTMLElement>('.canvas-frame');
 if(!frame)return;
 const presentation=getLevelPresentation(ACTIVE_LEVEL);
 hideAdvancedControls();

 const resultAgain=document.querySelector<HTMLButtonElement>('#result-again');
 if(resultAgain)resultAgain.textContent='Улучшить маршрут';

 const stats=document.createElement('div');
 stats.className='level-brief-stats';
 stats.innerHTML=`<span><b>3</b> рельса</span><span><b>3</b> бонуса на пути</span><span><b>7.5с</b> быстрый финиш</span>`;
 document.querySelector('.task-card')?.appendChild(stats);

 const hud=document.createElement('section');
 hud.id='level01-hud';
 hud.className='level01-hud';
 hud.innerHTML=`<div class="hud-route"><small>МИССИЯ</small><strong>Доставь шар в приёмник</strong></div><div class="hud-stat"><i>✦</i><b data-bonus-count>0/${LEVEL01_BONUSES.length}</b><span>бонусы</span></div><div class="hud-stat"><i>↻</i><b data-attempt>1</b><span>попытка</span></div><div class="hud-best"><small>ЛУЧШЕЕ</small><strong data-best>—</strong></div>`;
 frame.appendChild(hud);

 const coach=document.createElement('section');
 coach.id='level-coach';
 coach.className='level-coach';
 coach.innerHTML=`
  <header><div><small>ПЕРВЫЙ ЗАПУСК</small><strong>Собери свой маршрут</strong></div><button id="level-coach-toggle" type="button" aria-label="Свернуть подсказки">−</button></header>
  <div class="coach-progress"><span></span><b>0/3</b></div>
  <ol>
   <li data-step="place"><i>1</i><div><b>Перетащи три рельса</b><span>Перекрой большой разрыв между стартом и финишем. Точных мест нет — решение выбираешь ты.</span></div></li>
   <li data-step="rotate"><i>2</i><div><b>Настрой траекторию</b><span>Поворачивай рельсы ручкой или Q / E. Фиолетовые искры — необязательные бонусы.</span></div></li>
   <li data-step="test"><i>3</i><div><b>Испытай и улучши</b><span>Запусти шар. После финиша попробуй собрать больше бонусов или пройти быстрее.</span></div></li>
  </ol>
  <p class="coach-note">Секрет надёжности: небольшой нахлёст между рельсами лучше идеально ровного, но разорванного стыка.</p>
  <p class="coach-feedback" hidden></p>
  <div class="coach-actions"><button id="level-hint-button" type="button" hidden>Показать пример маршрута</button></div>`;
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
  toggle.textContent=isCollapsed?'?':'−';
  toggle.setAttribute('aria-label',isCollapsed?'Показать подсказки':'Свернуть подсказки');
 };
 const flashCoach=()=>{
  coach.classList.add('attention');
  window.clearTimeout(attentionTimer);
  attentionTimer=window.setTimeout(()=>coach.classList.remove('attention'),850);
 };
 const syncHud=()=>{
  const count=hud.querySelector<HTMLElement>('[data-bonus-count]');if(count)count.textContent=`${level01CollectedCount()}/${LEVEL01_BONUSES.length}`;
  const attempt=hud.querySelector<HTMLElement>('[data-attempt]');if(attempt)attempt.textContent=String(level01AttemptNumber());
  const best=hud.querySelector<HTMLElement>('[data-best]');const record=loadLevel01Best();if(best)best.textContent=record?`${record.bestTime.toFixed(1)}с · ${record.bestMedals}/3`:'первый запуск';
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
  hintButton.textContent=visible?'Скрыть пример':'Показать пример маршрута';
  app.setStatus(visible?'Показан один из возможных маршрутов. Его не обязательно повторять точно.':'Пример скрыт — снова ищи собственное решение.');
 });

 const render=(readiness:BuildReadiness=evaluateBuildReadiness(ACTIVE_LEVEL,app.snapshot))=>{
  const place=readiness.requirements.find(item=>item.id==='place-rails')?.met??false;
  const rotate=readiness.requirements.find(item=>item.id==='shape-route')?.met??false;
  const test=runAttempted||app.mode!=='build'||app.completed;
  const states={place,rotate,test};
  let completed=0;
  for(const [step,met] of Object.entries(states)){
   const item=coach.querySelector<HTMLElement>(`[data-step="${step}"]`);
   item?.classList.toggle('done',met);
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
    app.setStatus(`Инженерный бонус ${total}/${LEVEL01_BONUSES.length}! Продолжай следить за траекторией.`);
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
    coach.classList.remove('collapsed');
    localStorage.setItem(COACH_KEY,'0');
    syncToggle();
    flashCoach();
    render();
   }
  }
  requestAnimationFrame(watchTrial);
 };
 requestAnimationFrame(watchTrial);

 const takeaway=ensureTakeaway();
 if(takeaway)takeaway.innerHTML=`<small>ЧТО ТЫ СЕЙЧАС ПРОВЕРИЛ</small><strong>${presentation.takeaway}</strong>`;
 const resultScore=ensureResultScore();
 window.addEventListener('tim-level-complete',()=>{
  feedback.hidden=true;
  const score=scoreLevel01(app.runStartSnapshot,app.elapsed);
  const best=saveLevel01Best(score,app.elapsed);
  if(resultScore)resultScore.innerHTML=scoreMarkup(score,best);
  coach.classList.remove('collapsed');
  localStorage.setItem(COACH_KEY,'0');
  syncToggle();syncHud();render();
 });

 app.setStatus('Построй собственную траекторию из трёх рельсов. Бонусные искры собирать необязательно.');
 render();
}
