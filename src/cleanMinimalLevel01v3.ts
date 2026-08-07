import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_ROOT='/assets/level01-v3';

type AssetSpec={name:string;file:string;position:[number,number,number];scale:number;rotation?:[number,number,number]};

const ASSETS:AssetSpec[]=[
 {name:'BALL',file:'ball-premium-v3.glb',position:[-6.2,2.2,0],scale:1.12},
 {name:'RAMP',file:'ramp-premium-v3.glb',position:[-1.8,2.15,0],scale:.86,rotation:[0,0,-.08]},
 {name:'PULLEY',file:'pulley-premium-v3.glb',position:[3.3,2.7,0],scale:1.0},
 {name:'FAN',file:'fan-premium-v3.glb',position:[6.4,-.5,0],scale:.92}
];

function fitCamera(camera:THREE.PerspectiveCamera,w:number,h:number){
 camera.aspect=w/h;camera.updateProjectionMatrix();
}

function normalizeModel(root:THREE.Object3D){
 const box=new THREE.Box3().setFromObject(root);const size=new THREE.Vector3();box.getSize(size);const center=new THREE.Vector3();box.getCenter(center);
 root.position.sub(center);
 root.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(m instanceof THREE.MeshStandardMaterial){m.envMapIntensity=.85;}}}});
 const max=Math.max(size.x,size.y,size.z);return max||1;
}

function addSoftStudio(scene:THREE.Scene){
 scene.background=new THREE.Color(0xf1f1ee);
 const hemi=new THREE.HemisphereLight(0xffffff,0xd9d9d4,1.65);scene.add(hemi);
 const key=new THREE.RectAreaLight(0xfffdf8,7.5,9,7);key.position.set(-5,-2,10);key.rotation.set(0,0,0);scene.add(key);
 const fill=new THREE.RectAreaLight(0xf4f6f6,4.0,7,6);fill.position.set(7,-1,7);scene.add(fill);
 const rim=new THREE.DirectionalLight(0xffffff,1.5);rim.position.set(0,8,10);scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(32,20),new THREE.MeshStandardMaterial({color:0xe8e8e4,roughness:.9,metalness:0}));floor.rotation.x=-Math.PI/2;floor.position.set(0,-4.05,0);floor.receiveShadow=true;scene.add(floor);
 const wall=new THREE.Mesh(new THREE.PlaneGeometry(32,20),new THREE.MeshStandardMaterial({color:0xf2f2ef,roughness:.96,metalness:0}));wall.position.set(0,2,-3);wall.receiveShadow=true;scene.add(wall);
}

export async function installCleanMinimalLevel01V3():Promise<void>{
 document.body.innerHTML=`<main class="clean01v3"><canvas id="clean01v3-canvas"></canvas><header class="clean01v3-top"><div class="clean01v3-left"><button class="clean01v3-menu" aria-label="Меню">☰</button><span class="clean01v3-level">01</span></div><span class="clean01v3-badge">Asset Quality Gate · V3</span></header><div class="clean01v3-note">Сейчас оцениваем только форму, материалы, масштаб и свет четырёх базовых деталей</div><div class="clean01v3-loading" id="clean01v3-loading">Загрузка production GLB…</div></main>`;
 const canvas=document.querySelector<HTMLCanvasElement>('#clean01v3-canvas')!;const loading=document.querySelector<HTMLElement>('#clean01v3-loading')!;
 const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const scene=new THREE.Scene();addSoftStudio(scene);
 const camera=new THREE.PerspectiveCamera(24,4/3,.1,100);camera.position.set(0,1.6,24);camera.lookAt(0,.2,0);
 const loader=new GLTFLoader();
 const load=(spec:AssetSpec)=>new Promise<void>((resolve,reject)=>loader.load(`${ASSET_ROOT}/${spec.file}`,(gltf)=>{
   const root=gltf.scene;const max=normalizeModel(root);const s=spec.scale*(3.05/max);root.scale.setScalar(s);root.position.set(...spec.position);if(spec.rotation)root.rotation.set(...spec.rotation);root.name=spec.name;scene.add(root);resolve();
 },undefined,reject));
 try{await Promise.all(ASSETS.map(load));loading.classList.add('hide');}catch(err){loading.textContent=`Ошибка загрузки GLB: ${err instanceof Error?err.message:String(err)}`;throw err;}
 function resize(){const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);fitCamera(camera,r.width,r.height);}
 window.addEventListener('resize',resize);resize();
 let last=performance.now();function frame(now:number){const dt=Math.min(.04,(now-last)/1000);last=now;const fan=scene.getObjectByName('FAN');if(fan)fan.rotation.y+=dt*.08;renderer.render(scene,camera);requestAnimationFrame(frame);}requestAnimationFrame(frame);
}
