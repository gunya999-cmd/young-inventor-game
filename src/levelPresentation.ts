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

const PRESENTATIONS:Record<string,LevelPresentation>={
 'first-ramp':{
  eyebrow:'ПЕРВАЯ ИНЖЕНЕРНАЯ ЗАДАЧА',
  taskTitle:'Построй непрерывный спуск',
  taskBody:'Шар стартует слева, а финишная площадка находится ниже и далеко справа. У тебя ровно три направляющие: соедини ими разрыв так, чтобы шар нигде не сорвался и попал в зелёный приёмник.',
  buildPrompt:'3 направляющие · соедини разрыв · задай им наклон · затем испытай конструкцию',
  concepts:['наклон','ускорение','траектория'],
  successTitle:'Первый маршрут работает!',
  successBody:'Шар прошёл весь построенный тобой путь и попал в приёмник.',
  takeaway:'Наклон превращает высоту в скорость: плавная непрерывная траектория надёжнее резких ступенек.'
 }
};

export function getLevelPresentation(level:LevelSpec):LevelPresentation{
 return PRESENTATIONS[level.id]??{
  eyebrow:'ИНЖЕНЕРНАЯ ЗАДАЧА',
  taskTitle:level.title,
  taskBody:level.subtitle,
  buildPrompt:level.subtitle,
  concepts:['механика','траектория'],
  successTitle:'Механизм сработал',
  successBody:'Контрольный объект достиг приёмника.',
  takeaway:'Проверь, какое физическое действие оказалось ключевым для решения.'
 };
}
