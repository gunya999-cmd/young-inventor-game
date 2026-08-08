import './physicsFoundation.css';
import { buildFoundationLevel, foundationSuccess, type FoundationLevel, type FoundationScene } from './physicsFoundation';

const W=4,H=2.25;

export function installPhysicsFoundation():void{
  let level:FoundationLevel=0;
  let scene:FoundationScene=buildFoundationLevel(level);
  let running=false,won=false,last=performance.now();

  document.body.innerHTML=`<main class="pf"><header><div><h1>PHYSICS FOUNDATION v1</h1><p>Сначала физика. Потом уровни. Потом арт.</p></div><nav><span class="tabs"><button id="pf-l0" class="active">LEVEL 00</button><button id="pf-l1">LEVEL 01</button></span><button id="pf-run" class="primary">▶ ПУСК</button><button id="pf-reset">↺ СБРОС</button></nav></header><section class="layout"><canvas id="pf-canvas"></canvas><aside><h2 id="pf-title"></h2><div id="pf-copy"></div><div class="status" id="pf-status">Готово.</div><div class="legend"><span><i class="dot"></i> динамическое тело</span><span>— статическая рампа / опора</span><span>◉ шарнир качелей</span></div></aside></section><footer id="pf-footer"></footer></main>`;

  const canvas=document.querySelector<HTMLCanvasElement>('#pf-canvas')!;
  const ctx=canvas.getContext('2d')!;
  const status=document.querySelector<HTMLElement>('#pf-status')!;
  const title=document.querySelector<HTMLElement>('#pf-title')!;
  const copy=document.querySelector<HTMLElement>('#pf-copy')!;
  const footer=document.querySelector<HTMLElement>('#pf-footer')!;

  const sx=(x:number)=>x/W*canvas.clientWidth;
  const sy=(y:number)=>(H-y)/H*canvas.clientHeight;
  const px=(m:number)=>m/W*canvas.clientWidth;
  const py=(m:number)=>m/H*canvas.clientHeight;

  function line(a:[number,number],b:[number,number],width=10){ctx.strokeStyle='#7c8385';ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sx(a[0]),sy(a[1]));ctx.lineTo(sx(b[0]),sy(b[1]));ctx.stroke();}
  function circle(x:number,y:number,r:number,fill='#60686a'){ctx.fillStyle=fill;ctx.strokeStyle='#333a3c';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(x),sy(y),px(r),0,Math.PI*2);ctx.fill();ctx.stroke();}

  function setLevel(next:FoundationLevel){level=next;scene=buildFoundationLevel(level);running=false;won=false;status.textContent='Готово.';document.querySelector('#pf-l0')!.classList.toggle('active',level===0);document.querySelector('#pf-l1')!.classList.toggle('active',level===1);updateCopy();draw();}
  function updateCopy(){
    if(level===0){title.textContent='LEVEL 00 · НАКЛОННАЯ ПЛОСКОСТЬ';copy.innerHTML='<p><b>Цель:</b> шар должен физически попасть в корзину.</p><ol><li>На шар действует только гравитация.</li><li>Он катится по фиксированной рампе.</li><li>Корзина ловит шар геометрией коллайдеров.</li></ol><p>Никаких триггеров движения или телепортации.</p>';footer.textContent='ЦЕПЬ: гравитация → качение → корзина';}
    else{title.textContent='LEVEL 01 · РЫЧАГ';copy.innerHTML='<p><b>Цель:</b> поднять правое плечо качелей до физической мишени.</p><ol><li>Шар катится с левой рампы.</li><li>Он давит на левое плечо.</li><li>Качели вращаются вокруг настоящего revolute joint.</li><li>Правое плечо поднимается и касается мишени.</li></ol><p>Это минимальный рабочий урок момента силы.</p>';footer.textContent='ЦЕПЬ: гравитация → импульс шара → момент на оси → подъём правого плеча → цель';}
  }

  document.querySelector('#pf-l0')!.addEventListener('click',()=>setLevel(0));
  document.querySelector('#pf-l1')!.addEventListener('click',()=>setLevel(1));
  document.querySelector('#pf-run')!.addEventListener('click',()=>{scene=buildFoundationLevel(level);running=true;won=false;status.textContent='Симуляция идёт: движок считает контакты.';});
  document.querySelector('#pf-reset')!.addEventListener('click',()=>setLevel(level));

  function step(dt:number){if(!running)return;let left=Math.min(dt,.05);const fixed=1/120;while(left>0){scene.world.step(fixed);left-=fixed;}if(foundationSuccess(level,scene)){won=true;running=false;status.textContent='✓ PASS — цель достигнута только физикой.';}const p=scene.ball.getPosition();if(p.y<-.3){running=false;status.textContent='✗ FAIL — тело покинуло рабочую область.';}}

  function drawGrid(){ctx.fillStyle='#f3f4f2';ctx.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);ctx.strokeStyle='#d9ddda';ctx.lineWidth=1;for(let x=.25;x<W;x+=.25){ctx.beginPath();ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),canvas.clientHeight);ctx.stroke();}for(let y=.25;y<H;y+=.25){ctx.beginPath();ctx.moveTo(0,sy(y));ctx.lineTo(canvas.clientWidth,sy(y));ctx.stroke();}}
  function draw(){if(!canvas.clientWidth)return;drawGrid();const bp=scene.ball.getPosition();if(level===0){line([.35,1.72],[2.55,.46],13);line([2.48,.18],[3.42,.18],7);line([2.50,.18],[2.50,.60],7);line([3.40,.18],[3.40,.60],7);circle(bp.x,bp.y,.07);ctx.fillStyle='#303638';ctx.font='700 14px system-ui';ctx.fillText('START',sx(.28),sy(2.00));ctx.fillText('GOAL',sx(2.72),sy(.70));}
    else{line([.32,1.70],[1.08,1.16],12);const seesaw=scene.seesaw!,sp=seesaw.getPosition(),a=seesaw.getAngle();ctx.save();ctx.translate(sx(sp.x),sy(sp.y));ctx.rotate(-a);ctx.fillStyle='#b7bcbd';ctx.strokeStyle='#3d4446';ctx.lineWidth=2;ctx.fillRect(-px(.62),-py(.04),px(1.24),py(.08));ctx.strokeRect(-px(.62),-py(.04),px(1.24),py(.08));ctx.restore();circle(1.48,.88,.028,'#303638');circle(bp.x,bp.y,.07);circle(2.04,1.055,.055,'#eceeeb');ctx.fillStyle='#303638';ctx.font='700 13px system-ui';ctx.fillText('ШАР',sx(.34),sy(1.95));ctx.fillText('ЛЕВОЕ ПЛЕЧО ↓',sx(.86),sy(.70));ctx.fillText('ПРАВОЕ ПЛЕЧО ↑',sx(1.58),sy(1.24));ctx.fillText('ЦЕЛЬ',sx(1.94),sy(1.20));}
    if(won){ctx.fillStyle='rgba(255,255,255,.90)';ctx.fillRect(canvas.clientWidth*.34,canvas.clientHeight*.08,canvas.clientWidth*.34,76);ctx.strokeStyle='#687173';ctx.strokeRect(canvas.clientWidth*.34,canvas.clientHeight*.08,canvas.clientWidth*.34,76);ctx.fillStyle='#2f3638';ctx.font='800 24px system-ui';ctx.textAlign='center';ctx.fillText('✓ PHYSICS PASS',canvas.clientWidth*.51,canvas.clientHeight*.08+46);ctx.textAlign='left';}}
  function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  function frame(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;step(dt);draw();requestAnimationFrame(frame);}
  window.addEventListener('resize',resize);updateCopy();resize();requestAnimationFrame(frame);
}
