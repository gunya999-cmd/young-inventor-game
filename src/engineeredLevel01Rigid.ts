import { World, Vec2, Circle, Box, RevoluteJoint, PrismaticJoint, type Body } from 'planck';

type SimState = 'idle'|'running'|'won'|'failed';
const SCALE_X=4, SCALE_Y=2.25;

export function installEngineeredLevel01Rigid():void{
  document.body.innerHTML=`<main class="eng01"><header><div><b>LEVEL 01 · REAL PHYSICS PROOF</b><span>Никаких scripted phases — только Planck rigid bodies</span></div><nav><button id="eng-play">▶ ПУСК</button><button id="eng-stop">■ СТОП</button><button id="eng-reset">↺ СБРОС</button></nav></header><section class="eng-stage"><canvas id="eng-canvas"></canvas><aside><h2>Что должно произойти</h2><ol><li>Шар 1 катится по рампе.</li><li>Он давит на ЛЕВОЕ плечо качелей.</li><li>Левое плечо идёт ВНИЗ, правое — ВВЕРХ.</li><li>Правое плечо поднимает вертикальный стопор.</li><li>Шар 2 освобождается.</li><li>Шар 2 катится в корзину.</li></ol><dl><dt>Гравитация</dt><dd>9.81 м/с²</dd><dt>Шар 1</dt><dd>0.40 кг</dd><dt>Шар 2</dt><dd>0.30 кг</dd><dt>Качели</dt><dd>revolute joint</dd><dt>Стопор</dt><dd>prismatic joint</dd></dl><p id="eng-status">Готово к запуску.</p></aside></section><footer><span>ФИЗИЧЕСКАЯ ЦЕПЬ:</span> шар 1 → качели → стопор → шар 2 → корзина</footer></main>`;
  const canvas=document.querySelector<HTMLCanvasElement>('#eng-canvas')!;
  const ctx=canvas.getContext('2d')!;
  const status=document.querySelector<HTMLElement>('#eng-status')!;
  let world:World,state:SimState='idle',running=false,last=performance.now();
  let ball1:Body,ball2:Body,seesaw:Body,stopper:Body;

  const ramp1={a:Vec2(.28,1.72),b:Vec2(1.30,1.18)};
  const pivot=Vec2(1.55,.92);
  const ramp2={a:Vec2(2.45,.92),b:Vec2(3.50,.42)};
  const basket={x:3.60,y:.20,w:.30,h:.34};

  function makeEdgeBox(a:{x:number;y:number},b:{x:number;y:number},thickness=.035){
    const dx=b.x-a.x,dy=b.y-a.y,L=Math.hypot(dx,dy),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,ang=Math.atan2(dy,dx);
    const body=world.createBody({position:Vec2(cx,cy),angle:ang});
    body.createFixture(Box(L/2,thickness),{friction:.35,restitution:.02});return body;
  }

  function build(){
    world=new World(Vec2(0,-9.81));
    makeEdgeBox(ramp1.a,ramp1.b,.035);makeEdgeBox(ramp2.a,ramp2.b,.035);
    makeEdgeBox(Vec2(3.43,.15),Vec2(3.86,.15),.025);
    makeEdgeBox(Vec2(3.48,.15),Vec2(3.48,.55),.02);makeEdgeBox(Vec2(3.78,.15),Vec2(3.78,.55),.02);

    ball1=world.createDynamicBody({position:Vec2(.36,1.78),bullet:true});
    ball1.createFixture(Circle(.065),{density:30.15,friction:.55,restitution:.03});

    seesaw=world.createDynamicBody({position:pivot,angle:0});
    seesaw.createFixture(Box(.43,.035),{density:4.0,friction:.45,restitution:.02});
    const ground=world.createBody();
    world.createJoint(RevoluteJoint({enableLimit:true,lowerAngle:-0.20,upperAngle:0.20},ground,seesaw,pivot));

    ball2=world.createDynamicBody({position:Vec2(2.52,1.02),bullet:true});
    ball2.createFixture(Circle(.055),{density:31.55,friction:.5,restitution:.02});

    stopper=world.createDynamicBody({position:Vec2(2.67,1.02),fixedRotation:true});
    stopper.createFixture(Box(.025,.15),{density:15,friction:.5});
    world.createJoint(PrismaticJoint({enableLimit:true,lowerTranslation:0,upperTranslation:.30},ground,stopper,Vec2(2.67,.87),Vec2(0,1)));

    const follower=world.createDynamicBody({position:Vec2(1.94,.98),fixedRotation:true});
    follower.createFixture(Box(.055,.10),{density:3,friction:.4});
    world.createJoint(PrismaticJoint({enableLimit:true,lowerTranslation:0,upperTranslation:.34},ground,follower,Vec2(1.94,.88),Vec2(0,1)));

    const link=world.createDynamicBody({position:Vec2(2.30,1.15)});
    link.createFixture(Box(.33,.022),{density:1.2,friction:.45});
    world.createJoint(RevoluteJoint({},follower,link,Vec2(1.98,1.15)));
    world.createJoint(RevoluteJoint({},stopper,link,Vec2(2.62,1.15)));

    state='idle';running=false;status.textContent='Готово к запуску.';
  }

  function reset(){build();draw();}
  function start(){build();running=true;state='running';status.textContent='Симуляция идёт. Следим за реальными контактами.';}
  function stop(){running=false;status.textContent='Остановлено.';}
  document.querySelector('#eng-play')!.addEventListener('click',start);
  document.querySelector('#eng-stop')!.addEventListener('click',stop);
  document.querySelector('#eng-reset')!.addEventListener('click',reset);

  function pos(b:Body){return b.getPosition();}
  function step(dt:number){if(!running)return;const fixed=1/120;let acc=Math.min(dt,.05);while(acc>0){world.step(fixed);acc-=fixed;}
    const p2=pos(ball2);
    if(p2.x>basket.x-.12&&p2.x<basket.x+basket.w&&p2.y<.52){state='won';running=false;status.textContent='✓ УСПЕХ: шар 2 физически оказался в корзине.';}
    if(pos(ball1).y<-.2||p2.y<-.2){state='failed';running=false;status.textContent='✗ Механизм не сработал. Никакой автоподмены результата.';}
  }

  function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  const sx=(x:number)=>x/SCALE_X*canvas.clientWidth,sy=(y:number)=>(SCALE_Y-y)/SCALE_Y*canvas.clientHeight;
  function drawCircle(b:Body,r:number,fill:string){const p=b.getPosition();ctx.fillStyle=fill;ctx.strokeStyle='#343b3d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(p.x),sy(p.y),r/SCALE_X*canvas.clientWidth,0,Math.PI*2);ctx.fill();ctx.stroke();}
  function line(a:{x:number;y:number},b:{x:number;y:number},w=10,color='#7c8385'){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sx(a.x),sy(a.y));ctx.lineTo(sx(b.x),sy(b.y));ctx.stroke();}
  function draw(){const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!world)return;ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#f2f3f1';ctx.fillRect(0,0,cw,ch);ctx.strokeStyle='#d9dcda';ctx.lineWidth=1;for(let x=.25;x<4;x+=.25){ctx.beginPath();ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),ch);ctx.stroke();}for(let y=.25;y<2.25;y+=.25){ctx.beginPath();ctx.moveTo(0,sy(y));ctx.lineTo(cw,sy(y));ctx.stroke();}
    line(ramp1.a,ramp1.b,12);line(ramp2.a,ramp2.b,12);drawCircle(ball1,.065,'#4d5558');drawCircle(ball2,.055,'#a6abad');
    const sp=pos(seesaw),sa=seesaw.getAngle();ctx.save();ctx.translate(sx(sp.x),sy(sp.y));ctx.rotate(-sa);ctx.fillStyle='#b8bdbe';ctx.strokeStyle='#3d4446';ctx.lineWidth=2;ctx.fillRect(-sx(.43),-7,sx(.86),14);ctx.strokeRect(-sx(.43),-7,sx(.86),14);ctx.restore();ctx.fillStyle='#2f3638';ctx.beginPath();ctx.arc(sx(pivot.x),sy(pivot.y),8,0,Math.PI*2);ctx.fill();
    const st=pos(stopper);ctx.fillStyle='#d05b4e';ctx.strokeStyle='#3d4446';ctx.fillRect(sx(st.x-.025),sy(st.y+.15),sx(.05),.30/SCALE_Y*ch);ctx.strokeRect(sx(st.x-.025),sy(st.y+.15),sx(.05),.30/SCALE_Y*ch);
    ctx.strokeStyle='#434a4c';ctx.lineWidth=5;ctx.strokeRect(sx(3.48),sy(.55),sx(.30),.40/SCALE_Y*ch);for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(sx(3.50+i*.055),sy(.55));ctx.lineTo(sx(3.50+i*.055),sy(.15));ctx.stroke();}
    ctx.fillStyle='#303638';ctx.font='700 13px system-ui';ctx.fillText('BALL 1',sx(.28),sy(1.95));ctx.fillText('LEFT SIDE ↓',sx(1.12),sy(.73));ctx.fillText('RIGHT SIDE ↑',sx(1.62),sy(1.20));ctx.fillText('STOPPER',sx(2.56),sy(1.34));ctx.fillText('BALL 2',sx(2.40),sy(1.18));ctx.fillText('GOAL',sx(3.48),sy(.66));
    if(state==='won'){ctx.fillStyle='rgba(255,255,255,.90)';ctx.fillRect(cw*.36,ch*.08,cw*.30,ch*.12);ctx.strokeStyle='#687173';ctx.strokeRect(cw*.36,ch*.08,cw*.30,ch*.12);ctx.fillStyle='#2f3638';ctx.textAlign='center';ctx.font='700 23px system-ui';ctx.fillText('✓ REAL PHYSICS SUCCESS',cw*.51,ch*.15);ctx.textAlign='left';}
  }
  function frame(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;step(dt);draw();requestAnimationFrame(frame);}window.addEventListener('resize',resize);build();resize();requestAnimationFrame(frame);
}
