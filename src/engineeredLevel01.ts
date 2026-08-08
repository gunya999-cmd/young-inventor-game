type Phase='idle'|'ball1'|'lever'|'weight'|'ball2'|'won';

type Pt={x:number;y:number};
const W=4,H=2.25,g=9.81;
const ball1={m:.40,r:.065};
const ball2={m:.30,r:.055};
const counter={m:1.20};
const gateMass=.35;
const r1a={x:.30,y:1.65},r1b={x:1.42,y:1.14};
const r2a={x:2.77,y:.82},r2b={x:3.57,y:.39};
const leverPivot={x:1.62,y:1.02};
const pulley={x:2.30,y:1.72};
const weightTop=1.42,gateBottom=.78;

const len=(a:Pt,b:Pt)=>Math.hypot(b.x-a.x,b.y-a.y);
const rampAngle=(a:Pt,b:Pt)=>Math.atan2(a.y-b.y,b.x-a.x);
const r1L=len(r1a,r1b),r2L=len(r2a,r2b),theta1=rampAngle(r1a,r1b),theta2=rampAngle(r2a,r2b);
const rollA=(theta:number)=>5/7*g*Math.sin(theta);
const a1=rollA(theta1),a2=rollA(theta2);
const t1=Math.sqrt(2*r1L/a1),t2=Math.sqrt(2*r2L/a2);
const v1=Math.sqrt(2*a1*r1L),v2=Math.sqrt(2*a2*r2L);
const energy1=ball1.m*g*(r1a.y-r1b.y);
const pulleyA=g*(counter.m-gateMass)/(counter.m+gateMass);
const gateTravel=.24;
const gateT=Math.sqrt(2*gateTravel/pulleyA);

function pointOn(a:Pt,b:Pt,s:number):Pt{const L=len(a,b),q=Math.max(0,Math.min(1,s/L));return{x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};}

export function installEngineeredLevel01():void{
  document.body.innerHTML=`<main class="eng01"><header><div><b>LEVEL 01 · ENGINEERING PROOF</b><span>Полностью собранная эталонная машина</span></div><nav><button id="eng-play">▶ ПУСК</button><button id="eng-stop">■ СТОП</button><button id="eng-reset">↺ СБРОС</button></nav></header><section class="eng-stage"><canvas id="eng-canvas"></canvas><aside><h2>Телеметрия</h2><dl><dt>Шар 1</dt><dd>${ball1.m.toFixed(2)} кг · r ${(ball1.r*1000).toFixed(0)} мм</dd><dt>Рампа 1</dt><dd>${(theta1*180/Math.PI).toFixed(1)}° · ${r1L.toFixed(2)} м</dd><dt>Энергия старта</dt><dd>${energy1.toFixed(2)} Дж</dd><dt>v₁ перед рычагом</dt><dd>${v1.toFixed(2)} м/с</dd><dt>Противовес</dt><dd>${counter.m.toFixed(2)} кг</dd><dt>Ускорение троса</dt><dd>${pulleyA.toFixed(2)} м/с²</dd><dt>Ход заслонки</dt><dd>${(gateTravel*1000).toFixed(0)} мм</dd><dt>Шар 2</dt><dd>${ball2.m.toFixed(2)} кг · v≈${v2.toFixed(2)} м/с</dd></dl><p id="eng-status">Готово к запуску.</p></aside></section><footer><span>ЦЕПЬ:</span> шар 1 → рычаг → фиксатор → противовес → шкив → заслонка → шар 2 → корзина</footer></main>`;
  const canvas=document.querySelector<HTMLCanvasElement>('#eng-canvas')!;
  const ctx=canvas.getContext('2d')!;const status=document.querySelector<HTMLElement>('#eng-status')!;
  let phase:Phase='idle',phaseTime=0,last=performance.now(),running=false;
  let b1:Pt={...r1a},b2:Pt={...r2a},lever=-2*Math.PI/180,weightY=weightTop,gateY=gateBottom;
  const labels=['1. Гравитация','2. Удар','3. Освобождение','4. Натяжение','5. Открытие','6. Финальное движение'];
  function reset(){phase='idle';phaseTime=0;running=false;b1={...r1a};b2={...r2a};lever=-2*Math.PI/180;weightY=weightTop;gateY=gateBottom;status.textContent='Готово к запуску.';draw();}
  function start(){reset();running=true;phase='ball1';status.textContent='1/6 · Шар 1 катится под действием гравитации.';}
  function stop(){running=false;status.textContent='Остановлено.';}
  document.querySelector('#eng-play')!.addEventListener('click',start);document.querySelector('#eng-stop')!.addEventListener('click',stop);document.querySelector('#eng-reset')!.addEventListener('click',reset);
  function next(p:Phase,msg:string){phase=p;phaseTime=0;status.textContent=msg;}
  function step(dt:number){if(!running)return;phaseTime+=dt;
    if(phase==='ball1'){const s=.5*a1*phaseTime*phaseTime;b1=pointOn(r1a,r1b,s);if(s>=r1L)next('lever','2/6 · Импульс шара поворачивает рычаг и вытягивает фиксатор.');}
    else if(phase==='lever'){const q=Math.min(1,phaseTime/.18);lever=(-2-11*q)*Math.PI/180;if(q>=1)next('weight','3–5/6 · Противовес падает, через шкив поднимая заслонку.');}
    else if(phase==='weight'){const s=Math.min(gateTravel,.5*pulleyA*phaseTime*phaseTime);weightY=weightTop-s;gateY=gateBottom+s;if(s>=gateTravel)next('ball2','6/6 · Проход открыт: шар 2 катится к корзине.');}
    else if(phase==='ball2'){const s=.5*a2*phaseTime*phaseTime;b2=pointOn(r2a,r2b,s);if(s>=r2L){next('won','✓ УРОВЕНЬ ПРОЙДЕН · физическая цепочка замкнулась.');running=false;}}
  }
  function resize(){const r=canvas.getBoundingClientRect();const d=Math.min(devicePixelRatio,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  const sx=(x:number)=>x/W*canvas.clientWidth,sy=(y:number)=>(H-y)/H*canvas.clientHeight;
  function line(a:Pt,b:Pt,w=10,color='#767b7e'){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(sx(a.x),sy(a.y));ctx.lineTo(sx(b.x),sy(b.y));ctx.stroke();}
  function circle(p:Pt,r:number,fill:string,stroke='#3c4244'){ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx(p.x),sy(p.y),r/W*canvas.clientWidth,0,Math.PI*2);ctx.fill();ctx.stroke();}
  function box(x:number,y:number,w:number,h:number,fill:string){ctx.fillStyle=fill;ctx.strokeStyle='#3f4547';ctx.lineWidth=2;ctx.fillRect(sx(x-w/2),sy(y+h/2),w/W*canvas.clientWidth,h/H*canvas.clientHeight);ctx.strokeRect(sx(x-w/2),sy(y+h/2),w/W*canvas.clientWidth,h/H*canvas.clientHeight);}
  function draw(){const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!ch)return;ctx.clearRect(0,0,cw,ch);ctx.fillStyle='#f0f1ef';ctx.fillRect(0,0,cw,ch);ctx.strokeStyle='#d7d9d7';ctx.lineWidth=1;for(let x=.25;x<W;x+=.25){ctx.beginPath();ctx.moveTo(sx(x),0);ctx.lineTo(sx(x),ch);ctx.stroke();}for(let y=.25;y<H;y+=.25){ctx.beginPath();ctx.moveTo(0,sy(y));ctx.lineTo(cw,sy(y));ctx.stroke();}
    line(r1a,r1b,14,'#777d80');circle(b1,ball1.r,'#50575a');
    ctx.save();ctx.translate(sx(leverPivot.x),sy(leverPivot.y));ctx.rotate(-lever);ctx.fillStyle='#b8bdbe';ctx.strokeStyle='#42484a';ctx.lineWidth=2;ctx.fillRect(-80,-8,160,16);ctx.strokeRect(-80,-8,160,16);ctx.restore();circle(leverPivot,.025,'#303638');
    box(1.90,1.12,.055,.24,'#d25b4c');ctx.fillStyle='#575d5f';ctx.fillRect(sx(1.88),sy(1.25),sx(.20)-sx(0),6);
    circle(pulley,.10,'#d5d8d7');circle(pulley,.032,'#555b5d');
    const wx=2.05,gx=2.57;ctx.strokeStyle='#9d8a68';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(sx(wx),sy(weightY+.09));ctx.lineTo(sx(wx),sy(pulley.y));ctx.arc(sx(pulley.x),sy(pulley.y),.10/W*cw,Math.PI,0);ctx.lineTo(sx(gx),sy(gateY+.14));ctx.stroke();box(wx,weightY,.16,.18,'#596064');box(gx,gateY,.07,.28,'#8d9496');
    line(r2a,r2b,13,'#8d9395');circle(b2,ball2.r,'#9aa0a1');
    ctx.strokeStyle='#505658';ctx.lineWidth=5;ctx.strokeRect(sx(3.55),sy(.38),sx(.32)-sx(0),sy(.08)-sy(0));for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(sx(3.58+i*.06),sy(.38));ctx.lineTo(sx(3.58+i*.06),sy(.08));ctx.stroke();}
    ctx.fillStyle='#2f3537';ctx.font='600 13px system-ui';ctx.fillText('START',sx(.20),sy(1.86));ctx.fillText('LEVER',sx(1.45),sy(.79));ctx.fillText('COUNTERWEIGHT + GATE',sx(1.92),sy(1.95));ctx.fillText('BALL 2',sx(2.78),sy(.98));ctx.fillText('GOAL',sx(3.56),sy(.50));
    if(phase==='won'){ctx.fillStyle='rgba(255,255,255,.88)';ctx.fillRect(cw*.33,ch*.38,cw*.34,ch*.18);ctx.strokeStyle='#6f7777';ctx.strokeRect(cw*.33,ch*.38,cw*.34,ch*.18);ctx.fillStyle='#303637';ctx.font='700 26px system-ui';ctx.textAlign='center';ctx.fillText('✓ PHYSICS CHAIN COMPLETE',cw*.5,ch*.48);ctx.textAlign='left';}
  }
  function frame(now:number){const dt=Math.min(.033,(now-last)/1000);last=now;step(dt);draw();requestAnimationFrame(frame);}window.addEventListener('resize',resize);resize();requestAnimationFrame(frame);
}
