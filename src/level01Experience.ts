import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { evaluateBuildReadiness, type BuildReadiness } from './levelRules';
import { getLevelPresentation } from './levelPresentation';
import type { MachineSnapshot } from './model';

type AppInternals={
 snapshot:MachineSnapshot;
 mode:string;
 completed:boolean;
 start:()=>void;
 updateUi:()=>void;
 setStatus:(message:string)=>void;
};

const COACH_KEY='young-inventor:level-01:coach-collapsed:v1';

function hideAdvancedControls():void{
 const propertyGroups=[...document.querySelectorAll<HTMLElement>('.property-group')];
 for(const group of propertyGroups){
  const title=group.querySelector('h3')?.textContent?.trim();
  if(title==='Положение'||title==='Крепление')group.hidden=true;
 }
 const project=document.querySelector<HTMLElement>('.project-actions');
 if(project)project.hidden=true;
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

export function installLevel01Experience(appInstance:unknown):void{
 if(ACTIVE_LEVEL.id!=='first-ramp'||localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY))return;
 const app=appInstance as AppInternals;
 const frame=document.querySelector<HTMLElement>('.canvas-frame');
 if(!frame)return;
 const presentation=getLevelPresentation(ACTIVE_LEVEL);
 hideAdvancedControls();

 const stats=document.createElement('div');
 stats.className='level-brief-stats';
 stats.innerHTML=`<span><b>3</b> направляющие</span><span><b>${ACTIVE_LEVEL.parTime??12}с</b> цель на ★★★</span><span><b>1</b> понятная задача</span>`;
 document.querySelector('.task-card')?.appendChild(stats);

 const coach=document.createElement('section');
 coach.id='level-coach';
 coach.className='level-coach';
 coach.innerHTML=`
  <header><div><small>КАК НАЧАТЬ</small><strong>Собери маршрут</strong></div><button id="level-coach-toggle" type="button" aria-label="Свернуть подсказки">−</button></header>
  <div class="coach-progress"><span></span><b>0/3</b></div>
  <ol>
   <li data-step="place"><i>1</i><div><b>Перетащи 3 рельса</b><span>Возьми направляющие слева и перекрой ими большой разрыв.</span></div></li>
   <li data-step="rotate"><i>2</i><div><b>Сделай плавный спуск</b><span>Выбирай рельс и поворачивай круглой ручкой или клавишами Q / E.</span></div></li>
   <li data-step="test"><i>3</i><div><b>Испытай конструкцию</b><span>Когда путь готов, нажми «Испытать маршрут» и наблюдай за шаром.</span></div></li>
  </ol>
  <p class="coach-note">Совет: стыки лучше слегка перекрывать — шар не любит ступеньки.</p>`;
 frame.appendChild(coach);

 let runAttempted=false;
 let attentionTimer=0;
 const collapsed=localStorage.getItem(COACH_KEY)==='1';
 coach.classList.toggle('collapsed',collapsed);

 const toggle=coach.querySelector<HTMLButtonElement>('#level-coach-toggle')!;
 const syncToggle=()=>{
  const isCollapsed=coach.classList.contains('collapsed');
  toggle.textContent=isCollapsed?'?':'−';
  toggle.setAttribute('aria-label',isCollapsed?'Показать подсказки':'Свернуть подсказки');
 };
 syncToggle();
 toggle.addEventListener('click',()=>{
  coach.classList.toggle('collapsed');
  localStorage.setItem(COACH_KEY,coach.classList.contains('collapsed')?'1':'0');
  syncToggle();
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
 };

 const originalUpdate=app.updateUi.bind(app);
 app.updateUi=()=>{originalUpdate();render();};
 const originalStart=app.start.bind(app);
 app.start=()=>{
  const readiness=evaluateBuildReadiness(ACTIVE_LEVEL,app.snapshot);
  if(!readiness.ready){
   app.setStatus(readiness.message);
   render(readiness);
   coach.classList.add('attention');
   window.clearTimeout(attentionTimer);
   attentionTimer=window.setTimeout(()=>coach.classList.remove('attention'),850);
   return;
  }
  runAttempted=true;
  originalStart();
  render(readiness);
 };

 const takeaway=ensureTakeaway();
 if(takeaway)takeaway.innerHTML=`<small>ЧТО ТЫ СЕЙЧАС ПРОВЕРИЛ</small><strong>${presentation.takeaway}</strong>`;
 window.addEventListener('tim-level-complete',()=>{
  coach.classList.remove('collapsed');
  localStorage.setItem(COACH_KEY,'0');
  syncToggle();
  render();
 });

 app.setStatus('Шаг 1 из 3: перетащи на поле три направляющие и соедини старт с финишем.');
 render();
}
