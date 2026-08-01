import type { LevelSpec } from './level';
import type { MachineSnapshot } from './model';

export interface BuildRequirementStatus {
 id:string;
 label:string;
 detail:string;
 met:boolean;
}

export interface BuildReadiness {
 ready:boolean;
 requirements:BuildRequirementStatus[];
 message:string;
}

const ROTATED_RAIL_THRESHOLD = 8 * Math.PI / 180;

function ready(requirements:BuildRequirementStatus[],fallback:string):BuildReadiness{
 const missing=requirements.find(item=>!item.met);
 return {ready:!missing,requirements,message:missing?.detail??fallback};
}

export function evaluateBuildReadiness(level:LevelSpec,snapshot:MachineSnapshot):BuildReadiness{
 if(level.id!=='first-ramp')return {ready:true,requirements:[],message:'Конструкция готова к испытанию.'};
 const rails=snapshot.parts.filter(part=>!part.locked&&part.kind==='plank');
 const rotated=rails.filter(part=>Math.abs(part.angle)>=ROTATED_RAIL_THRESHOLD);
 return ready([
  {
   id:'place-rails',
   label:'Размести все 3 направляющие',
   detail:'Перетащи на поле все три направляющие — разрыв рассчитан именно на полный комплект.',
   met:rails.length===3
  },
  {
   id:'shape-route',
   label:'Сделай спуск, а не прямую',
   detail:'Поверни хотя бы две направляющие на 8° или больше, чтобы шар набрал и сохранил скорость.',
   met:rotated.length>=2
  }
 ],'Маршрут собран. Можно запускать испытание.');
}
