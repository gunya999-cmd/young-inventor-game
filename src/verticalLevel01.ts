import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Box, Circle, Vec2, World, type Body } from 'planck';

const ASSET_ROOT = '/assets/level01-v3';
const FIXED_STEP = 1 / 120;
const BALL_R = .45;

type BuildItem = 'ramp' | 'fan';
interface BuildState { ramp:{x:number;y:number;angle:number}; fan:{x:number;y:number}; }

const initialBuild = ():BuildState => ({ ramp:{x:-2.0,y:1.18,angle:-.19}, fan:{x:3.35,y:.75} });

function normalize(root:THREE.Object3D){
  const box=new THREE.Box3().setFromObject(root), size=new THREE.Vector3(), center=new THREE.Vector3();
  box.getSize(size); box.getCenter(center); root.position.sub(center);
  root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});
  return Math.max(size.x,size.y,size.z)||1;
}

function rootFor(object:THREE.Object3D|null):THREE.Object3D|null{
  let node=object; while(node && !node.userData.pick) node=node.parent; return node;
}

export async function installVerticalLevel01():Promise<void>{
  document.body.innerHTML=`<main class="vertical01">
    <canvas id="vertical01-canvas"></canvas>
    <header class="vertical01-hud"><div class="vertical01-left"><button class="v01-menu">☰</button><span>01</span></div><div class="v01-goal"><b>ЗАДАЧА</b><span>Запусти цепочку и доставь шар в корзину</span></div><div class="v01-controls"><button id="v01-reset" title="Сбросить">↺</button><button id="v01-stop" title="Стоп">■</button><button id="v01-play" class="primary" title="Запустить">▶</button></div></header>
    <aside class="v01-tip" id="v01-tip"><b>СОБЕРИ МАШИНУ</b><span>Перетащи рампу или вентилятор. Выбранную рампу можно повернуть.</span></aside>
    <div class="v01-select" id="v01-select" hidden><button id="v01-rot-left">↶</button><button id="v01-rot-right">↷</button></div>
    <div class="v01-chain"><span class="done">ШАР</span><i>→</i><span>РАМПА</span><i>→</i><span id="v01-chain-button">КНОПКА</span><i>→</i><span id="v01-chain-fan">ВЕНТИЛЯТОР</span><i>→</i><span id="v01-chain-goal">ЦЕЛЬ</span></div>
    <div class="v01-shelf"><div class="v01-part"><span class="ball-mini"></span></div><div class="v01-part selected"><span class="ramp-mini"></span></div><div class="v01-part"><span class="button-mini"></span></div><div class="v01-part"><span class="fan-mini"></span></div><div class="v01-part"><span class="basket-mini">▦</span></div></div>
    <section class="v01-win" id="v01-win" hidden><span>✓</span><b>МАШИНА СРАБОТАЛА</b><p>Шар дошёл до цели.</p><button id="v01-again">Попробовать ещё</button></section>
    <div class="v01-loading" id="v01-loading">Собираем машину…</div>
  </main>`;

  const canvas=document.querySelector<HTMLCanvasElement>('#vertical01-canvas')!;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
  renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene(); scene.background=new THREE.Color(0xf2f1ed);
  const camera=new THREE.PerspectiveCamera(24,4/3,.1,100); camera.position.set(0,.6,25); camera.lookAt(0,.1,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0xc7c5bd,2.0));
  const key=new THREE.DirectionalLight(0xfff9ed,2.3); key.position.set(-6,9,12); key.castShadow=true; key.shadow.mapSize.set(2048,2048); scene.add(key);
  const fill=new THREE.DirectionalLight(0xeaf2ff,1.0); fill.position.set(8,4,10); scene.add(fill);
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(30,18),new THREE.MeshStandardMaterial({color:0xf3f2ee,roughness:.96})); wall.position.z=-2.6; scene.add(wall);
  const deckMat=new THREE.MeshStandardMaterial({color:0xc9c7c0,roughness:.66,metalness:.14});
  const accentMat=new THREE.MeshStandardMaterial({color:0xcf4b3f,roughness:.43,metalness:.08});
  const darkMat=new THREE.MeshStandardMaterial({color:0x555957,roughness:.48,metalness:.42});
  const deck=new THREE.Mesh(new THREE.BoxGeometry(13.2,.28,.9),deckMat); deck.position.set(3.0,-.18,0); deck.castShadow=true; deck.receiveShadow=true; scene.add(deck);
  const startPost=new THREE.Mesh(new THREE.BoxGeometry(.28,3.1,.55),deckMat);startPost.position.set(-5.55,.45,0);scene.add(startPost);
  const startCap=new THREE.Mesh(new THREE.BoxGeometry(1.7,.22,.72),deckMat);startCap.position.set(-5.55,2.0,0);scene.add(startCap);

  const loader=new GLTFLoader();
  const load=async(file:string,scale:number)=>new Promise<THREE.Object3D>((resolve,reject)=>loader.load(`${ASSET_ROOT}/${file}`,g=>{const r=g.scene;const m=normalize(r);r.scale.setScalar(scale/m);resolve(r);},undefined,reject));
  const [ballMesh,rampMesh,fanMesh]=await Promise.all([load('ball-premium-v3.glb',.92),load('ramp-premium-v3.glb',6.85),load('fan-premium-v3.glb',3.9)]);
  ballMesh.name='BALL'; rampMesh.name='RAMP'; fanMesh.name='FAN';
  rampMesh.userData.pick='ramp'; fanMesh.userData.pick='fan';
  scene.add(ballMesh,rampMesh,fanMesh);

  const buttonGroup=new THREE.Group();
  const buttonBase=new THREE.Mesh(new THREE.CylinderGeometry(.62,.68,.25,64),darkMat);buttonBase.rotation.x=Math.PI/2;buttonGroup.add(buttonBase);
  const buttonTop=new THREE.Mesh(new THREE.CylinderGeometry(.40,.40,.24,64),accentMat);buttonTop.rotation.x=Math.PI/2;buttonTop.position.z=.12;buttonGroup.add(buttonTop);buttonGroup.position.set(1.75,.28,0);scene.add(buttonGroup);
  const basket=new THREE.Group(); const railMat=darkMat;
  for(const x of [-.72,.72]){const p=new THREE.Mesh(new THREE.BoxGeometry(.12,1.45,.35),railMat);p.position.set(x,.55,0);basket.add(p);} 
  const floor=new THREE.Mesh(new THREE.BoxGeometry(1.55,.12,.38),railMat);floor.position.set(0,-.12,0);basket.add(floor);
  for(let i=-2;i<=2;i++){const v=new THREE.Mesh(new THREE.BoxGeometry(.08,1.25,.26),railMat);v.position.set(i*.28,.55,.04);basket.add(v);}
  basket.position.set(7.35,.05,0);scene.add(basket);

  const airflow=new THREE.Group();
  for(let i=0;i<4;i++){const l=new THREE.Mesh(new THREE.BoxGeometry(1.1-i*.08,.035,.02),new THREE.MeshBasicMaterial({color:0xb6c7c6,transparent:true,opacity:.0}));l.position.set(4.45+i*.62,.72,0);airflow.add(l);}scene.add(airflow);

  let build=initialBuild(), selected:BuildItem|null='ramp', running=false, fanOn=false, won=false, world:World|null=null, ballBody:Body|null=null, accumulator=0, last=performance.now();
  const selectUi=document.querySelector<HTMLElement>('#v01-select')!, tip=document.querySelector<HTMLElement>('#v01-tip')!, win=document.querySelector<HTMLElement>('#v01-win')!;
  const chainButton=document.querySelector<HTMLElement>('#v01-chain-button')!,chainFan=document.querySelector<HTMLElement>('#v01-chain-fan')!,chainGoal=document.querySelector<HTMLElement>('#v01-chain-goal')!;

  function syncBuild(){
    rampMesh.position.set(build.ramp.x,build.ramp.y,0); rampMesh.rotation.set(0,0,build.ramp.angle);
    fanMesh.position.set(build.fan.x,build.fan.y,0); fanMesh.rotation.set(0,0,0);
    if(!running) ballMesh.position.set(-5.08,2.48,0);
    selectUi.hidden=selected!=='ramp'||running;
  }
  syncBuild();

  function createPhysics(){
    world=new World({gravity:Vec2(0,-9.81)});
    const ground=world.createBody({type:'static'}); ground.createFixture({shape:Box(6.6,.14,Vec2(3.0,-.18),0),friction:.7});
    const start=world.createBody({type:'static'}); start.createFixture({shape:Box(.85,.11,Vec2(-5.55,2.0),0),friction:.75});
    const ramp=world.createBody({type:'static',position:Vec2(build.ramp.x,build.ramp.y),angle:build.ramp.angle});ramp.createFixture({shape:Box(3.42,.12),friction:.48,restitution:.03});
    const goal=world.createBody({type:'static'});goal.createFixture({shape:Box(.08,.72,Vec2(6.63,.60),0)});goal.createFixture({shape:Box(.08,.72,Vec2(8.07,.60),0)});goal.createFixture({shape:Box(.76,.06,Vec2(7.35,-.07),0)});
    ballBody=world.createBody({type:'dynamic',position:Vec2(-5.08,2.48),linearVelocity:Vec2(.35,0),bullet:true}); ballBody.createFixture({shape:Circle(BALL_R),density:1.55,friction:.34,restitution:.12});
  }

  function start(){ if(running)return; running=true;fanOn=false;won=false;win.hidden=true;selected=null;selectUi.hidden=true;chainButton.classList.remove('done');chainFan.classList.remove('done');chainGoal.classList.remove('done');createPhysics();tip.innerHTML='<b>МАШИНА ЗАПУЩЕНА</b><span>Следи за цепочкой событий.</span>'; }
  function stop(){running=false;world=null;ballBody=null;fanOn=false;won=false;selected='ramp';tip.innerHTML='<b>СОБЕРИ МАШИНУ</b><span>Перетащи рампу или вентилятор. Выбранную рампу можно повернуть.</span>';syncBuild();chainButton.classList.remove('done');chainFan.classList.remove('done');chainGoal.classList.remove('done');}
  function reset(){build=initialBuild();stop();}
  document.querySelector('#v01-play')!.addEventListener('click',start);document.querySelector('#v01-stop')!.addEventListener('click',stop);document.querySelector('#v01-reset')!.addEventListener('click',reset);document.querySelector('#v01-again')!.addEventListener('click',reset);
  document.querySelector('#v01-rot-left')!.addEventListener('click',()=>{if(!running){build.ramp.angle+=.055;syncBuild();}});document.querySelector('#v01-rot-right')!.addEventListener('click',()=>{if(!running){build.ramp.angle-=.055;syncBuild();}});

  const ray=new THREE.Raycaster(), pointer=new THREE.Vector2(), plane=new THREE.Plane(new THREE.Vector3(0,0,1),0), hit=new THREE.Vector3();let dragging:BuildItem|null=null,dragOffset=new THREE.Vector3();
  function pointerNdc(e:PointerEvent){const r=canvas.getBoundingClientRect();pointer.x=((e.clientX-r.left)/r.width)*2-1;pointer.y=-((e.clientY-r.top)/r.height)*2+1;ray.setFromCamera(pointer,camera);}
  canvas.addEventListener('pointerdown',e=>{if(running)return;pointerNdc(e);const hits=ray.intersectObjects([rampMesh,fanMesh],true);const root=rootFor(hits[0]?.object??null);if(!root)return;dragging=root.userData.pick as BuildItem;selected=dragging;ray.ray.intersectPlane(plane,hit);const pos=dragging==='ramp'?rampMesh.position:fanMesh.position;dragOffset.copy(pos).sub(hit);canvas.setPointerCapture(e.pointerId);syncBuild();});
  canvas.addEventListener('pointermove',e=>{if(!dragging||running)return;pointerNdc(e);if(!ray.ray.intersectPlane(plane,hit))return;hit.add(dragOffset);if(dragging==='ramp'){build.ramp.x=Math.max(-4.0,Math.min(.3,hit.x));build.ramp.y=Math.max(.55,Math.min(2.45,hit.y));}else{build.fan.x=Math.max(2.5,Math.min(5.1,hit.x));build.fan.y=Math.max(.35,Math.min(1.75,hit.y));}syncBuild();});
  const endDrag=()=>dragging=null;canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);

  function updatePhysics(dt:number){
    if(!running||!world||!ballBody)return;
    const p=ballBody.getPosition(),v=ballBody.getLinearVelocity();
    const touchingButton=p.x>1.22&&p.x<2.25&&p.y<1.02&&p.y>-.05;
    if(touchingButton&&!fanOn){fanOn=true;chainButton.classList.add('done');chainFan.classList.add('done');tip.innerHTML='<b>КНОПКА НАЖАТА</b><span>Вентилятор включён — поток воздуха толкает шар к цели.</span>';}
    if(fanOn){const dx=p.x-build.fan.x,dy=p.y-build.fan.y;if(dx>-.25&&dx<4.5&&Math.abs(dy)<1.45){const force=Math.max(0,18*(1-dx/5));ballBody.applyForceToCenter(Vec2(force,Math.max(0,(.35-dy)*1.2)),true);}}
    if(p.x>6.72&&p.x<7.98&&p.y<1.25&&!won){won=true;chainGoal.classList.add('done');win.hidden=false;tip.innerHTML='<b>ЦЕПОЧКА ЗАВЕРШЕНА</b><span>Шар в корзине.</span>';}
    if(p.y<-4||p.x>9.5||Math.abs(v.x)>35) stop();
    world.step(dt,8,3);
    const q=ballBody?.getPosition();if(q){ballMesh.position.set(q.x,q.y,0);ballMesh.rotation.z-=ballBody!.getLinearVelocity().x*dt/BALL_R;}
    airflow.children.forEach((o,i)=>{const m=(o as THREE.Mesh).material as THREE.MeshBasicMaterial;m.opacity=fanOn?.16:0;o.position.x=4.3+((performance.now()/700+i*.62)%2.7);});
  }

  function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();}
  window.addEventListener('resize',resize);resize();document.querySelector('#v01-loading')?.remove();
  function frame(now:number){const frameDt=Math.min(.05,(now-last)/1000);last=now;if(running){accumulator+=frameDt;while(accumulator>=FIXED_STEP){updatePhysics(FIXED_STEP);accumulator-=FIXED_STEP;}}renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
  window.dispatchEvent(new CustomEvent('tim-ready'));
}
