import { ACTIVE_LEVEL } from './level';

const CONCEPTS:Record<string,string[]>={
 'first-ramp':['наклон','скорость','траектория'],
 balance:['рычаг','ось','момент'],
 'rope-work':['натяжение','шкив','противовес'],
 'spring-step':['упругость','импульс','домино'],
 airflow:['поток','траектория','импульс'],
 automation:['сигнал','переключатель','цепочка'],
 'impulse-and-moment':['импульс','момент','натяжение','упругость']
};

function text(selector:string,value:string):void{
 const element=document.querySelector<HTMLElement>(selector);
 if(element)element.textContent=value;
}

export function installActiveLevelUi():void{
 const number=String(ACTIVE_LEVEL.number).padStart(2,'0');
 document.title=`Машина изобретателя · ${ACTIVE_LEVEL.title}`;
 text('.mission-summary .level-number',number);
 text('.mission-summary h1',ACTIVE_LEVEL.title);
 text('.mission-summary .mission-copy',ACTIVE_LEVEL.subtitle);
 text('.task-card h2',ACTIVE_LEVEL.title);
 text('.task-card > p',ACTIVE_LEVEL.subtitle);
 text('.build-prompt span',ACTIVE_LEVEL.subtitle);

 const concepts=document.querySelector<HTMLElement>('.principles-row');
 if(concepts){
  concepts.replaceChildren(...(CONCEPTS[ACTIVE_LEVEL.id]??['механика','траектория']).map(label=>{
   const chip=document.createElement('span');chip.textContent=label;return chip;
  }));
 }
}
