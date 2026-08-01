import { ACTIVE_LEVEL, type LevelSpec } from './level';
import { PHYSICS_CONFIG } from './engine/physicsConfig';
import { PhysicsEngine } from './physics';
import { WORLD_HEIGHT, WORLD_WIDTH, cloneSnapshot, type MachineSnapshot, type PartState } from './model';

export type ValidationSeverity = 'pass' | 'warning' | 'error';
export interface ValidationCheck { id:string; severity:ValidationSeverity; title:string; detail:string; }
export interface LevelValidationReport {
  valid:boolean;
  checks:ValidationCheck[];
  baselineWon:boolean;
  referenceWon:boolean;
  referenceWinFrames:number[];
  simulationSeconds:number;
}

interface RunResult {
  won:boolean;
  winFrame:number;
  unstable:boolean;
  outOfBounds:boolean;
  maxSpeed:number;
  activeAtTimeout:boolean;
  signature:string;
}

const FIXED_STEP=1/120;
const BASELINE_FRAMES=1200;
const REFERENCE_FRAMES=3000;
const POSITION_MARGIN=350;
const SPEED_LIMIT=5200;

function snapshotForInitialState(level:LevelSpec,reference:MachineSnapshot):MachineSnapshot{
  const locked=reference.parts.filter(part=>part.locked).map(part=>({...part}));
  const parts=locked.length?locked:level.initialParts.map(part=>({...part,locked:true}));
  const ids=new Set(parts.map(part=>part.id));
  return {
    parts,
    ropes:reference.ropes.filter(rope=>ids.has(rope.a.partId)&&ids.has(rope.b.partId)&&(!rope.pulleyPartId||ids.has(rope.pulleyPartId))).map(rope=>({...rope,a:{...rope.a},b:{...rope.b}})),
    hinges:reference.hinges.filter(hinge=>ids.has(hinge.partId)).map(hinge=>({...hinge})),
    signals:(reference.signals??level.initialSignals).filter(link=>ids.has(link.sourcePartId)&&ids.has(link.targetPartId)).map(link=>({...link}))
  };
}

function finitePart(part:PartState):boolean{
  return Number.isFinite(part.x)&&Number.isFinite(part.y)&&Number.isFinite(part.angle);
}

function signature(snapshot:MachineSnapshot):string{
  return snapshot.parts
    .map(part=>`${part.id}:${Math.round(part.x*10)}:${Math.round(part.y*10)}:${Math.round(part.angle*1000)}`)
    .sort()
    .join('|');
}

function run(snapshot:MachineSnapshot,maxFrames:number):RunResult{
  const engine=new PhysicsEngine(cloneSnapshot(snapshot));
  let won=false;
  let winFrame=-1;
  let unstable=false;
  let outOfBounds=false;
  let maxSpeed=0;
  let activeAtTimeout=false;
  for(let frame=0;frame<maxFrames;frame+=1){
    engine.step(FIXED_STEP);
    const state=engine.snapshot();
    for(const part of state.parts){
      if(!finitePart(part))unstable=true;
      if(part.x<-POSITION_MARGIN||part.x>WORLD_WIDTH+POSITION_MARGIN||part.y<-POSITION_MARGIN||part.y>WORLD_HEIGHT+POSITION_MARGIN)outOfBounds=true;
      const motion=engine.partKinematics(part.id);
      if(motion){
        const speed=Math.hypot(motion.velocity.x,motion.velocity.y);
        maxSpeed=Math.max(maxSpeed,speed);
        if(!Number.isFinite(speed)||!Number.isFinite(motion.angularVelocity)||speed>SPEED_LIMIT)unstable=true;
        if(frame>maxFrames-240&&(speed>16||Math.abs(motion.angularVelocity)>0.18))activeAtTimeout=true;
      }
    }
    if(engine.hasWon()){
      won=true;
      winFrame=frame;
      return {won,winFrame,unstable,outOfBounds,maxSpeed,activeAtTimeout:false,signature:signature(state)};
    }
    if(unstable)break;
  }
  return {won,winFrame,unstable,outOfBounds,maxSpeed,activeAtTimeout,signature:signature(engine.snapshot())};
}

function check(id:string,severity:ValidationSeverity,title:string,detail:string):ValidationCheck{return{id,severity,title,detail};}

export function validateLevel(level:LevelSpec,referenceSnapshot:MachineSnapshot):LevelValidationReport{
  const checks:ValidationCheck[]=[];
  const target=referenceSnapshot.parts.find(part=>part.id===level.targetPartId)??level.initialParts.find(part=>part.id===level.targetPartId);
  if(!target)checks.push(check('target','error','Целевой объект не найден','Выбранный targetPartId отсутствует в стартовом состоянии и эталонной конструкции.'));
  else checks.push(check('target','pass','Целевой объект определён',`${target.id} (${target.kind}) используется для проверки победы.`));

  const receiver=level.receiver;
  const receiverInside=receiver.x-receiver.innerWidth/2>=0&&receiver.x+receiver.innerWidth/2<=WORLD_WIDTH&&receiver.y-receiver.innerHeight/2>=0&&receiver.y+receiver.innerHeight/2<=WORLD_HEIGHT;
  checks.push(receiverInside
    ?check('receiver','pass','Приёмник находится на поле','Зона победы полностью помещается в физическом мире.')
    :check('receiver','error','Приёмник выходит за границы','Перемести или уменьши зону победы.'));

  if(level.platforms.length===0)checks.push(check('platforms','warning','Нет платформ','Уровень может быть корректным, но большинство объектов сразу упадёт.'));
  else checks.push(check('platforms','pass','Геометрия присутствует',`Платформ: ${level.platforms.length}.`));

  const originalLevel={...ACTIVE_LEVEL,platforms:ACTIVE_LEVEL.platforms,receiver:ACTIVE_LEVEL.receiver,initialParts:ACTIVE_LEVEL.initialParts,initialSignals:ACTIVE_LEVEL.initialSignals,inventory:ACTIVE_LEVEL.inventory};
  const mutableGravity=PHYSICS_CONFIG as unknown as {gravity:number};
  const originalGravity=mutableGravity.gravity;
  Object.assign(ACTIVE_LEVEL,level);
  mutableGravity.gravity=level.gravity;

  let baseline:RunResult;
  const references:RunResult[]=[];
  try{
    baseline=run(snapshotForInitialState(level,referenceSnapshot),BASELINE_FRAMES);
    for(let index=0;index<3;index+=1)references.push(run(referenceSnapshot,REFERENCE_FRAMES));
  }finally{
    Object.assign(ACTIVE_LEVEL,originalLevel);
    mutableGravity.gravity=originalGravity;
  }

  if(baseline.unstable)checks.push(check('baseline-stability','error','Пустой уровень численно нестабилен',`Зафиксирована некорректная скорость или координата. Максимальная скорость: ${Math.round(baseline.maxSpeed)} px/с.`));
  else if(baseline.outOfBounds)checks.push(check('baseline-bounds','error','Объект покидает игровой мир','Без действий игрока одна из стартовых деталей выходит далеко за границы поля.'));
  else checks.push(check('baseline-stability','pass','Пустой запуск стабилен',`10 секунд симуляции без численного сбоя; максимум ${Math.round(baseline.maxSpeed)} px/с.`));

  if(baseline.won)checks.push(check('self-win','error','Уровень проходит сам','Цель достигнута без добавленных игроком деталей.'));
  else checks.push(check('self-win','pass','Самопрохождения нет','Стартовое состояние не достигает цели за 10 секунд.'));

  const referenceWon=references.every(result=>result.won);
  if(referenceWon)checks.push(check('solution','pass','Эталонное решение проходит',`Победа во всех трёх запусках: ${references.map(result=>(result.winFrame*FIXED_STEP).toFixed(2)+' с').join(', ')}.`));
  else checks.push(check('solution','error','Эталонное решение не доказано',`Успешных запусков: ${references.filter(result=>result.won).length} из 3. Собери рабочее решение на поле перед проверкой.`));

  const unstableReference=references.some(result=>result.unstable||result.outOfBounds);
  if(unstableReference)checks.push(check('solution-stability','error','Эталонная конструкция нестабильна','Есть выход за мир, нечисловое состояние или чрезмерная скорость.'));
  else checks.push(check('solution-stability','pass','Эталонная конструкция устойчива','Все три запуска сохранили конечные координаты и допустимые скорости.'));

  if(referenceWon){
    const frames=references.map(result=>result.winFrame);
    const deterministic=Math.max(...frames)-Math.min(...frames)<=1&&references.every(result=>result.signature===references[0].signature);
    checks.push(deterministic
      ?check('determinism','pass','Результат повторяем','Кадр победы и финальное состояние совпали во всех запусках.')
      :check('determinism','error','Результат недетерминирован','Одинаковая конструкция даёт разные кадры победы или разные финальные состояния.'));
  }

  if(!referenceWon&&references.some(result=>result.activeAtTimeout))checks.push(check('timeout','warning','Механизм не успокаивается','Через 25 секунд детали всё ещё активно движутся, но цель не достигнута.'));

  return {
    valid:!checks.some(item=>item.severity==='error'),
    checks,
    baselineWon:baseline.won,
    referenceWon,
    referenceWinFrames:references.map(result=>result.winFrame),
    simulationSeconds:REFERENCE_FRAMES*FIXED_STEP
  };
}
