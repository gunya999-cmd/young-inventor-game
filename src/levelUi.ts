import { ACTIVE_LEVEL, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { getLevelPresentation } from './levelPresentation';

function text(selector:string,value:string):void{
 const element=document.querySelector<HTMLElement>(selector);
 if(element)element.textContent=value;
}

export function installActiveLevelUi():void{
 const customActive=Boolean(localStorage.getItem(CUSTOM_LEVEL_STORAGE_KEY));
 const canonicalLevel01=ACTIVE_LEVEL.id==='first-ramp'&&!customActive;
 const number=String(ACTIVE_LEVEL.number).padStart(2,'0');
 const presentation=getLevelPresentation(ACTIVE_LEVEL,!customActive);
 const root=document.querySelector<HTMLElement>('#app');
 if(root)root.dataset.levelId=customActive?'custom':ACTIVE_LEVEL.id;

 document.title=`Машина изобретателя · ${ACTIVE_LEVEL.title}`;
 text('.mission-summary .level-number',number);
 text('.mission-summary .eyebrow',presentation.eyebrow);
 text('.mission-summary h1',ACTIVE_LEVEL.title);
 text('.mission-summary .mission-copy',ACTIVE_LEVEL.subtitle);
 text('.task-card .eyebrow','ЗАДАЧА');
 text('.task-card h2',presentation.taskTitle);
 text('.task-card > p:not(.eyebrow)',presentation.taskBody);
 text('.build-prompt span',presentation.buildPrompt);
 text('#result-card h2',presentation.successTitle);
 text('#result-card > p:not(.eyebrow)',presentation.successBody);

 const concepts=document.querySelector<HTMLElement>('.principles-row');
 if(concepts){
  concepts.replaceChildren(...presentation.concepts.map(label=>{
   const chip=document.createElement('span');chip.textContent=label;return chip;
  }));
 }

 if(canonicalLevel01){
  text('.library-panel .panel-heading h2','Направляющие');
  text('.library-panel .panel-badge','3 ШТ.');
  const connections=document.querySelector<HTMLElement>('.connections-card');
  if(connections)connections.hidden=true;
  for(const button of document.querySelectorAll<HTMLButtonElement>('.palette-part')){
   button.hidden=button.dataset.kind!=='plank';
  }
  for(const label of document.querySelectorAll<HTMLElement>('.inventory-section-label'))label.hidden=true;
  const run=document.querySelector<HTMLButtonElement>('#run-button');
  if(run)run.textContent='▶ Испытать маршрут';
 }
}
