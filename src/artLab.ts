import './artLab.css';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const canvas=document.querySelector<HTMLCanvasElement>('#art-canvas');
const fatal=document.querySelector<HTMLElement>('#art-fatal');
if(!canvas)throw new Error('Art Lab canvas not found');

function fail(error:unknown):void{
  const message=error instanceof Error?error.message:String(error);
  if(fatal){fatal.hidden=false;fatal.textContent=`WebGL Art Lab: ${message}`;}
  console.error(error);
}

try{
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.15;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#e8edf3');
  scene.fog=new THREE.Fog('#e8edf3',18,32);

  const camera=new THREE.OrthographicCamera(-8,8,5,-5,.1,80);
  camera.position.set(0,-10.8,13.8);
  camera.lookAt(0,0,0);

  const hemi=new THREE.HemisphereLight('#f7fbff','#8393a3',2.35);
  scene.add(hemi);

  const key=new THREE.DirectionalLight('#fff5e8',5.1);
  key.position.set(-5,-7,13);
  key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);
  key.shadow.camera.left=-11;key.shadow.camera.right=11;key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
  key.shadow.bias=-.00025;
  scene.add(key);

  const rim=new THREE.DirectionalLight('#8ea9ff',2.7);
  rim.position.set(8,4,8);
  scene.add(rim);

  const mint=new THREE.PointLight('#5dffc0',14,7,2);
  mint.position.set(5.5,2.6,4.5);
  scene.add(mint);

  const boardMaterial=new THREE.MeshPhysicalMaterial({color:'#cfd8e1',metalness:.22,roughness:.54,clearcoat:.42,clearcoatRoughness:.36});
  const board=new THREE.Mesh(new RoundedBoxGeometry(15.6,9.1,.46,7,.32),boardMaterial);
  board.position.z=-.36;
  board.receiveShadow=true;
  scene.add(board);

  const inset=new THREE.Mesh(new RoundedBoxGeometry(14.8,8.35,.08,5,.22),new THREE.MeshStandardMaterial({color:'#e7edf2',metalness:.05,roughness:.78}));
  inset.position.z=-.08;
  inset.receiveShadow=true;
  scene.add(inset);

  const grid=new THREE.GridHelper(13.8,18,'#a9b5c2','#c6d0d9');
  grid.rotation.x=Math.PI/2;
  grid.position.z=.005;
  (grid.material as THREE.Material).transparent=true;
  (grid.material as THREE.Material).opacity=.16;
  scene.add(grid);

  const aluminium=new THREE.MeshPhysicalMaterial({color:'#7c8c9b',metalness:.86,roughness:.26,clearcoat:.25,clearcoatRoughness:.21});
  const aluminiumDark=new THREE.MeshPhysicalMaterial({color:'#263443',metalness:.78,roughness:.25,clearcoat:.35,clearcoatRoughness:.18});
  const rubber=new THREE.MeshStandardMaterial({color:'#111820',metalness:.05,roughness:.78});
  const bluePolymer=new THREE.MeshPhysicalMaterial({color:'#365fd3',metalness:.08,roughness:.33,clearcoat:.62,clearcoatRoughness:.18});
  const greenPolymer=new THREE.MeshPhysicalMaterial({color:'#28b884',metalness:.05,roughness:.31,clearcoat:.58,clearcoatRoughness:.16});
  const softPad=new THREE.MeshPhysicalMaterial({color:'#66e4b1',metalness:.02,roughness:.58,clearcoat:.15,emissive:'#126a4d',emissiveIntensity:.18});
  const steel=new THREE.MeshPhysicalMaterial({color:'#aeb9c3',metalness:.96,roughness:.13,clearcoat:.42,clearcoatRoughness:.08});
  const blackMetal=new THREE.MeshStandardMaterial({color:'#18222c',metalness:.72,roughness:.32});
  const ledMaterial=new THREE.MeshStandardMaterial({color:'#67ffc0',emissive:'#2cf2a1',emissiveIntensity:4.8,metalness:.05,roughness:.25});
  const bonusMaterial=new THREE.MeshStandardMaterial({color:'#7186ff',emissive:'#4866ff',emissiveIntensity:2.4,metalness:.15,roughness:.26});

  function cast(mesh:THREE.Object3D):THREE.Object3D{mesh.traverse(child=>{if(child instanceof THREE.Mesh){child.castShadow=true;child.receiveShadow=true;}});return mesh;}

  function ring(radius=.19,tube=.055,material:THREE.Material=steel):THREE.Mesh{
    const mesh=new THREE.Mesh(new THREE.TorusGeometry(radius,tube,12,32),material);
    mesh.rotation.x=Math.PI/2;
    return mesh;
  }

  function bolt(radius=.075,height=.07):THREE.Mesh{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,24),steel);
    mesh.rotation.x=Math.PI/2;
    return mesh;
  }

  function createRail():THREE.Group{
    const group=new THREE.Group();
    const chassis=new THREE.Mesh(new RoundedBoxGeometry(5.85,.82,.48,6,.15),aluminiumDark);
    chassis.position.z=.25;group.add(chassis);

    const top=new THREE.Mesh(new RoundedBoxGeometry(5.2,.48,.16,5,.10),aluminium);
    top.position.z=.55;group.add(top);
    const lane=new THREE.Mesh(new RoundedBoxGeometry(4.72,.22,.075,4,.08),rubber);
    lane.position.z=.66;group.add(lane);

    for(const x of [-2.55,2.55]){
      const cap=new THREE.Mesh(new RoundedBoxGeometry(.54,.88,.58,4,.12),bluePolymer);
      cap.position.set(x,0,.27);group.add(cap);
      const socket=ring(.18,.055,steel);socket.position.set(x,0,.61);group.add(socket);
      const inner=new THREE.Mesh(new THREE.CylinderGeometry(.09,.09,.08,24),blackMetal);inner.rotation.x=Math.PI/2;inner.position.set(x,0,.61);group.add(inner);
    }

    for(const x of [-1.7,1.7]){
      const foot=new THREE.Mesh(new RoundedBoxGeometry(.58,.30,.23,4,.08),blackMetal);
      foot.position.set(x,.33,.02);group.add(foot);
      const fastener=bolt(.065,.08);fastener.position.set(x,.33,.15);group.add(fastener);
    }

    for(const x of [-2.05,0,2.05]){
      const detail=bolt(.055,.055);detail.position.set(x,-.30,.58);group.add(detail);
    }
    return cast(group) as THREE.Group;
  }

  function createBallDock():THREE.Group{
    const group=new THREE.Group();
    const base=new THREE.Mesh(new RoundedBoxGeometry(1.55,1.45,.38,6,.22),bluePolymer);base.position.z=.18;group.add(base);
    const cradle=new THREE.Mesh(new THREE.TorusGeometry(.56,.12,18,40,Math.PI*1.5),blackMetal);cradle.rotation.set(Math.PI/2,0,Math.PI*.25);cradle.position.z=.46;group.add(cradle);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(.58,64,48),steel);ball.position.z=1.05;group.add(ball);
    const highlight=new THREE.PointLight('#d7e7ff',3.8,4,2);highlight.position.set(-.35,-.45,1.7);group.add(highlight);
    return cast(group) as THREE.Group;
  }

  function createReceiver():THREE.Group{
    const group=new THREE.Group();
    const base=new THREE.Mesh(new RoundedBoxGeometry(3.15,2.72,.62,7,.30),aluminiumDark);base.position.z=.28;group.add(base);
    const deck=new THREE.Mesh(new RoundedBoxGeometry(2.72,2.28,.28,6,.25),aluminium);deck.position.z=.63;group.add(deck);
    const pad=new THREE.Mesh(new RoundedBoxGeometry(2.05,1.55,.18,7,.24),softPad);pad.position.z=.82;group.add(pad);

    const wallGeo=new RoundedBoxGeometry(.30,2.12,.84,5,.12);
    for(const x of [-1.25,1.25]){const wall=new THREE.Mesh(wallGeo,bluePolymer);wall.position.set(x,0,.88);group.add(wall);}
    const back=new THREE.Mesh(new RoundedBoxGeometry(2.25,.30,.84,5,.12),bluePolymer);back.position.set(0,.96,.88);group.add(back);

    const ledBase=new THREE.Mesh(new RoundedBoxGeometry(1.6,.16,.10,3,.05),blackMetal);ledBase.position.set(0,-1.22,.64);group.add(ledBase);
    const led=new THREE.Mesh(new RoundedBoxGeometry(1.28,.07,.07,3,.03),ledMaterial);led.position.set(0,-1.31,.69);group.add(led);
    for(const x of [-.72,.72]){const screw=bolt(.065,.07);screw.position.set(x,-1.15,.68);group.add(screw);}
    return cast(group) as THREE.Group;
  }

  function createBonus():THREE.Group{
    const group=new THREE.Group();
    const base=new THREE.Mesh(new THREE.CylinderGeometry(.33,.38,.18,6),blackMetal);base.rotation.x=Math.PI/2;group.add(base);
    const gem=new THREE.Mesh(new THREE.CylinderGeometry(.23,.29,.16,6),bonusMaterial);gem.rotation.x=Math.PI/2;gem.position.z=.16;group.add(gem);
    const core=new THREE.Mesh(new THREE.OctahedronGeometry(.12,0),new THREE.MeshStandardMaterial({color:'#edf1ff',emissive:'#b9c5ff',emissiveIntensity:2.7,metalness:.05,roughness:.18}));core.position.z=.34;group.add(core);
    const light=new THREE.PointLight('#7389ff',5,2.5,2);light.position.z=.55;group.add(light);
    return cast(group) as THREE.Group;
  }

  const start=createBallDock();start.position.set(-5.3,-2.25,.10);scene.add(start);
  const startRail=createRail();startRail.scale.setScalar(.72);startRail.position.set(-3.75,-1.35,.18);startRail.rotation.z=-.17;scene.add(startRail);

  const heroRail=createRail();heroRail.position.set(-.55,.65,.35);heroRail.rotation.z=THREE.MathUtils.degToRad(-12);scene.add(heroRail);
  const heroUnderlight=new THREE.PointLight('#6480ff',5,4,2);heroUnderlight.position.set(-.55,.65,.55);scene.add(heroUnderlight);

  const finishRail=createRail();finishRail.scale.setScalar(.72);finishRail.position.set(3.45,1.05,.16);finishRail.rotation.z=-.10;scene.add(finishRail);
  const receiver=createReceiver();receiver.scale.setScalar(.88);receiver.position.set(5.2,2.2,.12);scene.add(receiver);

  const bonusPositions:[number,number][]=[[-2.25,.20],[.85,1.28],[2.35,1.70]];
  bonusPositions.forEach(([x,y],index)=>{const item=createBonus();item.position.set(x,y,.32);item.scale.setScalar(index===1?1:.9);scene.add(item);});

  const ambientPlate=new THREE.Mesh(new RoundedBoxGeometry(7.2,2.1,.05,6,.32),new THREE.MeshBasicMaterial({color:'#6b82ff',transparent:true,opacity:.035,depthWrite:false}));
  ambientPlate.position.set(-.25,.7,.04);ambientPlate.rotation.z=-.10;scene.add(ambientPlate);

  const angle=document.querySelector<HTMLInputElement>('#art-angle');
  const output=document.querySelector<HTMLOutputElement>('#art-angle-output');
  const syncAngle=()=>{
    const value=Number(angle?.value??-12);
    heroRail.rotation.z=THREE.MathUtils.degToRad(value);
    if(output)output.value=`${value>0?'+':''}${value}°`;
  };
  angle?.addEventListener('input',syncAngle);syncAngle();

  function resize():void{
    const rect=canvas.getBoundingClientRect();
    const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    renderer.setSize(width,height,false);
    const aspect=width/height;
    const span=height<600?7.8:7.2;
    camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;
    camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

  const clock=new THREE.Clock();
  function frame():void{
    const t=clock.getElapsedTime();
    bonusPositions.forEach((_,index)=>{
      const object=scene.children.find(item=>item.userData.bonusIndex===index);
      if(object)object.position.z=.34+Math.sin(t*2+index)*.04;
    });
    heroUnderlight.intensity=4.4+Math.sin(t*1.6)*.55;
    renderer.render(scene,camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.documentElement.dataset.artLabReady='true';
}catch(error){fail(error);}
