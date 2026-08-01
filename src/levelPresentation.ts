import type { LevelSpec } from './level';

export interface LevelPresentation {
 eyebrow:string;
 taskTitle:string;
 taskBody:string;
 buildPrompt:string;
 concepts:string[];
 successTitle:string;
 successBody:string;
 takeaway:string;
}

const CONCEPTS:Record<string,string[]>={
 balance:['рычаг','ось','момент'],
 'rope-work':['натяжение','шкив','противовес'],
 'spring-step':['упругость','импульс','домино'],
 airflow:['поток','траектория','импульс'],
 automation:['сигнал','переключатель','цепочка'],
 'impulse-and-moment':['импульс','момент','натяжение','упругость']
};

const PRESENTATIONS:Record<string,LevelPresentation>={
 'first-ramp':{
  eyebrow:'ROUTE LAB · ПЕРВАЯ МИССИЯ',
  taskTitle:'Проложи свой первый маршрут',
  taskBody:'Старт и приёмник уже стоят на поле. Между ними — большой разрыв и всего три рельса. Построй собственную траекторию: главное довести шар до цели, а инженерные искры на пути дадут дополнительные награды.',
  buildPrompt:'3 рельса · свободная траектория · 3 необязательных бонуса · улучшай результат после финиша',
  concepts:['наклон','скорость','траектория'],
  successTitle:'Маршрут работает!',
  successBody:'Шар дошёл до приёмника. Теперь можно улучшить траекторию, собрать больше бонусов или выиграть время.',
  takeaway:'Наклон превращает высоту в скорость, а плавные стыки сохраняют эту скорость. Один и тот же финиш можно получить разными траекториями.'
 }
};

export function getLevelPresentation(level:LevelSpec,useAuthoredPresentation=true):LevelPresentation{
 if(useAuthoredPresentation&&PRESENTATIONS[level.id])return PRESENTATIONS[level.id];
 return {
  eyebrow:'ИНЖЕНЕРНАЯ ЗАДАЧА',
  taskTitle:level.title,
  taskBody:level.subtitle,
  buildPrompt:level.subtitle,
  concepts:useAuthoredPresentation?(CONCEPTS[level.id]??['механика','траектория']):['механика','траектория'],
  successTitle:'Механизм сработал',
  successBody:'Контрольный объект достиг приёмника.',
  takeaway:'Проверь, какое физическое действие оказалось ключевым для решения.'
 };
}
