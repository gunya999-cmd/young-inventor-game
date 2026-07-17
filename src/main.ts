import Phaser from 'phaser';
import './style.css';
import { CHAPTER_ONE_LEVELS } from './game/levels/chapter1';
import { getPart } from './game/partRegistry';
import { completeLevel, loadProgress, recordAttempt, type SavedProgress } from './game/progress';
import type { LevelDefinition, PlacedPart, SnapTarget } from './game/types';

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 800;
const LEFT_RAIL = { x: 476, y: 326, rotation: Phaser.Math.DegToRad(12), width: 402 };
const RIGHT_RAIL = { x: 1104, y: 458, rotation: Phaser.Math.DegToRad(12), width: 402 };
const RECEIVER = { x: 1360, y: 526 };

type Mode = 'build' | 'running' | 'success';
type GameApi = { run(): void; reset(): void; toggleHint(): void; next(): void; selectPart(id: string): void };
declare global { interface Window { youngInventorGame?: GameApi } }

let progress: SavedProgress = loadProgress();
let requestedLevelIndex = Math.max(0, CHAPTER_ONE_LEVELS.findIndex((level) => level.id === progress.currentLevelId));

class WorkshopScene extends Phaser.Scene {
  private level!: LevelDefinition;
  private levelIndex = 0;
  private mode: Mode = 'build';
  private selectedPartId = '';
  private bridge?: Phaser.GameObjects.Image;
  private bridgeShadow?: Phaser.GameObjects.Ellipse;
  private handle?: Phaser.GameObjects.Arc;
  private handleLine?: Phaser.GameObjects.Line;
  private ballPreview?: Phaser.GameObjects.Image;
  private ball?: Phaser.Physics.Matter.Image;
  private bridgeBody?: MatterJS.BodyType;
  private receiverGlow!: Phaser.GameObjects.Arc;
  private robot!: Phaser.GameObjects.Image;
  private robotEyes: Phaser.GameObjects.Arc[] = [];
  private hintGroup!: Phaser.GameObjects.Container;
  private connectorGlows: Phaser.GameObjects.Arc[] = [];
  private dragging = false;
  private rotating = false;
  private dragOffset = new Phaser.Math.Vector2();
  private runTimer?: number;
  private activePointers = new Map<number, { x: number; y: number }>();
  private pinchStartAngle?: number;
  private pinchStartRotation?: number;

  constructor() { super('Workshop'); }

  init(data: { levelIndex?: number }): void {
    this.levelIndex = Phaser.Math.Clamp(data.levelIndex ?? requestedLevelIndex, 0, CHAPTER_ONE_LEVELS.length - 1);
    requestedLevelIndex = this.levelIndex;
    this.level = CHAPTER_ONE_LEVELS[this.levelIndex];
    this.mode = 'build';
  }

  create(): void {
    this.input.addPointer(2);
    this.createTextures();
    this.createRoom();
    this.createWorkBoard();
    this.createMachine();
    this.createInteraction();
    this.createCollisions();
    this.createKeyboard();
    this.updateDomForLevel();

    window.youngInventorGame = {
      run: () => this.runSimulation(),
      reset: () => this.restartLevel(),
      toggleHint: () => this.toggleHint(),
      next: () => this.goNext(),
      selectPart: (id) => this.selectPart(id)
    };
  }

  update(): void {
    if (!this.ball || this.mode !== 'running') return;
    if (this.ball.y > WORLD_HEIGHT + 100 || this.ball.x < -100 || this.ball.x > WORLD_WIDTH + 100) {
      this.failAttempt(this.pickFailureHint());
    }
  }

  private createTextures(): void {
    this.makeBeamTexture('beam-blue', 402, 54, '#58a6ff', '#1867c7', '#0f4b99');
    this.makeBeamTexture('beam-red-short', 200, 58, '#ff806f', '#df3237', '#a81e29');
    this.makeBeamTexture('beam-red', 274, 58, '#ff806f', '#df3237', '#a81e29');
    this.makeBeamTexture('beam-red-long', 380, 58, '#ff806f', '#df3237', '#a81e29');
    this.makeBallTexture();
    this.makeReceiverTexture();
    this.makeRobotTexture();
  }

  private makeBeamTexture(key: string, width: number, height: number, top: string, middle: string, side: string): void {
    if (this.textures.exists(key)) return;
    const texture = this.textures.createCanvas(key, width, height);
    const ctx = texture?.getContext(); if (!texture || !ctx) return;
    ctx.shadowColor = 'rgba(20,31,48,.32)'; ctx.shadowBlur = 15; ctx.shadowOffsetY = 9;
    const body = ctx.createLinearGradient(0, 5, 0, height - 6); body.addColorStop(0, top); body.addColorStop(.42, middle); body.addColorStop(1, side);
    this.roundedRect(ctx, 9, 5, width - 18, height - 16, 13); ctx.fillStyle = body; ctx.fill();
    ctx.shadowColor = 'transparent';
    const gloss = ctx.createLinearGradient(0, 7, 0, 29); gloss.addColorStop(0, 'rgba(255,255,255,.78)'); gloss.addColorStop(.55, 'rgba(255,255,255,.18)'); gloss.addColorStop(1, 'rgba(255,255,255,0)');
    this.roundedRect(ctx, 15, 9, width - 30, 18, 9); ctx.fillStyle = gloss; ctx.fill();
    const holes = Math.max(4, Math.round(width / 52));
    for (let i = 0; i < holes; i += 1) {
      const x = 31 + i * ((width - 62) / Math.max(1, holes - 1));
      const ring = ctx.createRadialGradient(x - 2, 22, 1, x, 24, 9); ring.addColorStop(0, '#fff'); ring.addColorStop(.34, 'rgba(255,255,255,.45)'); ring.addColorStop(.58, 'rgba(20,35,52,.48)'); ring.addColorStop(1, 'rgba(6,18,33,.75)');
      ctx.beginPath(); ctx.arc(x, 24, 8.2, 0, Math.PI * 2); ctx.fillStyle = ring; ctx.fill();
      ctx.beginPath(); ctx.arc(x, 24, 3.4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(228,245,255,.72)'; ctx.fill();
    }
    texture.refresh();
  }

  private makeBallTexture(): void {
    if (this.textures.exists('energy-ball')) return;
    const texture = this.textures.createCanvas('energy-ball', 88, 88); const ctx = texture?.getContext(); if (!texture || !ctx) return;
    ctx.shadowColor = 'rgba(38,160,255,.55)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
    const orb = ctx.createRadialGradient(27, 20, 3, 44, 43, 38); orb.addColorStop(0, '#fff'); orb.addColorStop(.12, '#bdf2ff'); orb.addColorStop(.38, '#42b8ff'); orb.addColorStop(.72, '#146fc8'); orb.addColorStop(1, '#07366f');
    ctx.beginPath(); ctx.arc(44, 40, 34, 0, Math.PI * 2); ctx.fillStyle = orb; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = 'rgba(230,250,255,.86)'; ctx.lineWidth = 2.5; ctx.stroke(); texture.refresh();
  }

  private makeReceiverTexture(): void {
    if (this.textures.exists('receiver')) return;
    const texture = this.textures.createCanvas('receiver', 214, 214); const ctx = texture?.getContext(); if (!texture || !ctx) return;
    ctx.shadowColor = 'rgba(25,38,58,.34)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 11;
    const shell = ctx.createLinearGradient(20, 10, 190, 205); shell.addColorStop(0, '#fff'); shell.addColorStop(.5, '#d8e3ef'); shell.addColorStop(1, '#91a6ba');
    this.roundedRect(ctx, 22, 24, 170, 164, 48); ctx.fillStyle = shell; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#263c58'; ctx.lineWidth = 8; ctx.stroke();
    const bezel = ctx.createRadialGradient(107, 103, 34, 107, 103, 78); bezel.addColorStop(0, '#071b33'); bezel.addColorStop(.53, '#0c294b'); bezel.addColorStop(.67, '#1c87ca'); bezel.addColorStop(.78, '#9feaff'); bezel.addColorStop(.86, '#e6fbff'); bezel.addColorStop(1, '#536d86');
    ctx.beginPath(); ctx.arc(107, 102, 75, 0, Math.PI * 2); ctx.fillStyle = bezel; ctx.fill(); ctx.beginPath(); ctx.arc(107, 102, 48, 0, Math.PI * 2); ctx.fillStyle = '#07182d'; ctx.fill(); texture.refresh();
  }

  private makeRobotTexture(): void {
    if (this.textures.exists('robot')) return;
    const texture = this.textures.createCanvas('robot', 210, 250); const ctx = texture?.getContext(); if (!texture || !ctx) return;
    const metal = ctx.createLinearGradient(22, 18, 185, 230); metal.addColorStop(0, '#fff'); metal.addColorStop(.46, '#dbe5ef'); metal.addColorStop(1, '#93a7ba');
    ctx.shadowColor = 'rgba(24,36,55,.28)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 10; this.roundedRect(ctx, 40, 25, 130, 95, 34); ctx.fillStyle = metal; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.strokeStyle = '#2a3e59'; ctx.lineWidth = 7; ctx.stroke();
    ctx.fillStyle = '#203651'; this.roundedRect(ctx, 60, 49, 90, 46, 18); ctx.fill(); this.roundedRect(ctx, 52, 132, 106, 77, 25); ctx.fillStyle = metal; ctx.fill(); ctx.strokeStyle = '#2a3e59'; ctx.stroke();
    ctx.fillStyle = '#536bd1'; this.roundedRect(ctx, 69, 151, 72, 37, 13); ctx.fill(); ctx.fillStyle = '#2a3e59'; ctx.fillRect(25,151,34,19); ctx.fillRect(151,151,34,19); ctx.fillRect(61,205,29,31); ctx.fillRect(120,205,29,31); texture.refresh();
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+width,y,x+width,y+height,r); ctx.arcTo(x+width,y+height,x,y+height,r); ctx.arcTo(x,y+height,x,y,r); ctx.arcTo(x,y,x+width,y,r); ctx.closePath();
  }

  private createRoom(): void {
    const wall = this.add.graphics(); wall.fillGradientStyle(0xfff9ed,0xf5e6cb,0xe9d1ac,0xd8b987,1); wall.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);
    const floor = this.add.graphics(); floor.fillGradientStyle(0xd59b5f,0xc68a50,0xb8753e,0xa96533,1); floor.fillRect(0,690,WORLD_WIDTH,110);
    for(let x=-80;x<WORLD_WIDTH+100;x+=170)this.add.line(0,0,x,690,x+44,800,0x75401f,.22).setOrigin(0);
    this.createWindow(); this.createShelves();
  }

  private createWindow(): void {
    const x=76,y=84,w=235,h=220; const sky=this.add.graphics(); sky.fillGradientStyle(0xbfeaff,0xe9f9ff,0x92c98d,0x6fa665,1); sky.fillRoundedRect(x,y,w,h,10); this.add.ellipse(x+54,y+177,155,85,0x6f9f62,.95); this.add.ellipse(x+174,y+183,180,95,0x588e55,.95); this.add.rectangle(x+w/2,y+h/2,10,h,0xf9f1df); this.add.rectangle(x+w/2,y+h/2,w,10,0xf9f1df); const frame=this.add.graphics(); frame.lineStyle(14,0xc49a68,1); frame.strokeRoundedRect(x-7,y-7,w+14,h+14,16); this.add.rectangle(x+w/2,y+h+16,w+44,24,0x9f6738).setStrokeStyle(3,0x75451f);
  }

  private createShelves(): void {
    const shelf=(x:number,y:number,width:number)=>{this.add.rectangle(x,y,width,18,0x9a6033).setStrokeStyle(3,0x693b1c);this.add.rectangle(x-width/2+20,y+23,9,40,0x68401f);this.add.rectangle(x+width/2-20,y+23,9,40,0x68401f)}; shelf(1410,140,275); shelf(1410,260,275);
    [0xe74b45,0xf1bd3c,0x3989d8,0x4ca86c].forEach((color,i)=>{const x=1332+i*55;this.add.rectangle(x,108,44,36,color).setStrokeStyle(3,0x30415a,.36);this.add.circle(x-11,85,5.5,0xffffff,.55);this.add.circle(x+11,85,5.5,0xffffff,.55)});
  }

  private createWorkBoard(): void {
    this.add.rectangle(800,395,1180,548,0xede6d6,.96).setStrokeStyle(12,0x9c754a,.95); this.add.rectangle(800,395,1150,518,0xf7f2e8,.96).setStrokeStyle(2,0xffffff,.8);
    for(let x=260;x<=1340;x+=58)for(let y=160;y<=620;y+=58)this.add.circle(x,y,2.1,0x9d8d73,.18); this.add.rectangle(800,663,1135,26,0x9a6033).setStrokeStyle(4,0x673a1d);
  }

  private createMachine(): void {
    this.addBeamWithBody(LEFT_RAIL.x,LEFT_RAIL.y,LEFT_RAIL.rotation,LEFT_RAIL.width); this.addBeamWithBody(RIGHT_RAIL.x,RIGHT_RAIL.y,RIGHT_RAIL.rotation,RIGHT_RAIL.width); this.addSupport(350,385); this.addSupport(1198,533);
    this.add.rectangle(255,260,126,46,0x3da85f).setStrokeStyle(5,0x1e7040).setRotation(LEFT_RAIL.rotation);
    const ballData=this.level.placedParts.find((p)=>p.partId==='ball') ?? {x:286,y:250}; this.ballPreview=this.add.image(ballData.x,ballData.y,'energy-ball');
    const target=this.level.snapTargets[0]; this.connectorGlows=[this.add.circle(656,364,17,0x6bd5ff,.12).setStrokeStyle(4,0x64cfff,.42),this.add.circle(923,421,17,0x6bd5ff,.12).setStrokeStyle(4,0x64cfff,.42)];
    this.hintGroup=this.add.container(0,0).setVisible(false); const ghost=this.add.image(target.x,target.y,'beam-red').setRotation(Phaser.Math.DegToRad(target.rotationDeg)).setAlpha(.3).setTint(0xaeefff); this.hintGroup.add(ghost);
    this.receiverGlow=this.add.circle(RECEIVER.x,RECEIVER.y,92,0x5ddaff,.08).setBlendMode(Phaser.BlendModes.ADD).setAlpha(.18); this.add.image(RECEIVER.x,RECEIVER.y,'receiver').setScale(.84); this.matter.add.circle(RECEIVER.x,RECEIVER.y-3,62,{isStatic:true,isSensor:true,label:'receiver'});
    this.robot=this.add.image(1490,548,'robot').setScale(.68); this.robotEyes=[this.add.circle(1476,514,7,0x66778f),this.add.circle(1504,514,7,0x66778f)];
    const bridgeData=this.level.placedParts.find((p)=>p.instanceId==='bridge'); if(bridgeData)this.spawnBridge(bridgeData.partId,bridgeData);
    this.matter.add.rectangle(800,674,1160,26,{isStatic:true,friction:.6,label:'bench'});
  }

  private addBeamWithBody(x:number,y:number,rotation:number,width:number):void { this.add.ellipse(x,y+28,width-40,28,0x24334b,.14).setRotation(rotation); this.add.image(x,y,'beam-blue').setRotation(rotation); this.matter.add.rectangle(x,y+5,width-20,28,{isStatic:true,angle:rotation,friction:.004,restitution:.015,label:'rail'}); }
  private addSupport(x:number,y:number):void { this.add.rectangle(x,y,58,20,0x4c79b5).setStrokeStyle(3,0x2c4361);this.add.rectangle(x,y+35,16,62,0x3e526e);this.add.rectangle(x,y+65,82,15,0x2d3f57);this.add.circle(x,y,8,0xd8e7f2).setStrokeStyle(3,0x2c4361); }

  private spawnBridge(partId:string,data?:Partial<PlacedPart>):void {
    this.destroyBridge(); this.selectedPartId=partId; const part=getPart(partId); const key=part.assetKey; const x=data?.x??790,y=data?.y??688,rotation=Phaser.Math.DegToRad(data?.rotationDeg??-6); const width=part.body.type==='rectangle'?part.body.width:254;
    this.bridgeShadow=this.add.ellipse(x,y+30,Math.max(150,width-25),31,0x26344a,.2); this.bridge=this.add.image(x,y,key).setRotation(rotation).setInteractive({useHandCursor:true}).setDepth(8); this.bridgeShadow.setDepth(7);
    this.handleLine=this.add.line(0,0,0,0,0,0,0x41536c,.7).setLineWidth(4).setOrigin(0).setDepth(10); this.handle=this.add.circle(0,0,24,0xffffff,1).setStrokeStyle(6,0x53657c).setInteractive({useHandCursor:true}).setDepth(11); this.bindBridgeInteraction(); this.updateBridgeUi(); this.renderInventory();
  }

  private destroyBridge():void { this.bridge?.destroy();this.bridgeShadow?.destroy();this.handle?.destroy();this.handleLine?.destroy();this.bridge=undefined;this.bridgeShadow=undefined;this.handle=undefined;this.handleLine=undefined; }

  private bindBridgeInteraction():void {
    this.bridge?.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{if(this.mode!=='build'||!this.bridge)return;this.dragging=true;this.dragOffset.set(this.bridge.x-pointer.worldX,this.bridge.y-pointer.worldY);this.setMessage('Соедини две синие дорожки.');});
    this.handle?.on('pointerdown',()=>{if(this.mode==='build')this.rotating=true});
  }

  private createInteraction():void {
    this.input.on('pointerdown',(pointer:Phaser.Input.Pointer)=>{this.activePointers.set(pointer.id,{x:pointer.worldX,y:pointer.worldY});if(this.activePointers.size===2&&this.bridge){const [a,b]=[...this.activePointers.values()];this.pinchStartAngle=Math.atan2(b.y-a.y,b.x-a.x);this.pinchStartRotation=this.bridge.rotation}});
    this.input.on('pointermove',(pointer:Phaser.Input.Pointer)=>{this.activePointers.set(pointer.id,{x:pointer.worldX,y:pointer.worldY});if(this.mode!=='build'||!this.bridge)return;
      if(this.activePointers.size>=2&&this.pinchStartAngle!==undefined&&this.pinchStartRotation!==undefined){const [a,b]=[...this.activePointers.values()];const angle=Math.atan2(b.y-a.y,b.x-a.x);this.bridge.rotation=Phaser.Math.Clamp(this.pinchStartRotation+(angle-this.pinchStartAngle),Phaser.Math.DegToRad(-35),Phaser.Math.DegToRad(35));this.updateBridgeUi();return}
      if(this.dragging){this.bridge.x=Phaser.Math.Clamp(pointer.worldX+this.dragOffset.x,255,1320);this.bridge.y=Phaser.Math.Clamp(pointer.worldY+this.dragOffset.y,190,690);this.applySoftSnap();this.updateBridgeUi()}else if(this.rotating){this.bridge.rotation=Phaser.Math.Clamp(Phaser.Math.Angle.Between(this.bridge.x,this.bridge.y,pointer.worldX,pointer.worldY)+Math.PI/2,Phaser.Math.DegToRad(-35),Phaser.Math.DegToRad(35));this.updateBridgeUi()}});
    this.input.on('pointerup',(pointer:Phaser.Input.Pointer)=>{this.activePointers.delete(pointer.id);if(this.activePointers.size<2){this.pinchStartAngle=undefined;this.pinchStartRotation=undefined}if(this.mode!=='build')return;this.dragging=false;this.rotating=false;this.applyReleaseSnap();this.updateBridgeUi()});
    this.input.on('wheel',(_p:unknown,_o:unknown,_dx:number,dy:number)=>this.rotateBridge(dy>0?3:-3));
  }

  private createKeyboard():void { const k=this.input.keyboard;if(!k)return;k.on('keydown-Q',()=>this.rotateBridge(-3));k.on('keydown-E',()=>this.rotateBridge(3));k.on('keydown-SPACE',()=>this.runSimulation());k.on('keydown-R',()=>this.restartLevel());k.on('keydown-H',()=>this.toggleHint()); }
  private rotateBridge(deg:number):void { if(this.mode!=='build'||!this.bridge)return;this.bridge.rotation=Phaser.Math.Clamp(this.bridge.rotation+Phaser.Math.DegToRad(deg),Phaser.Math.DegToRad(-35),Phaser.Math.DegToRad(35));this.updateBridgeUi(); }
  private target():SnapTarget{return this.level.snapTargets[0]}
  private distanceToTarget():number{return this.bridge?Phaser.Math.Distance.Between(this.bridge.x,this.bridge.y,this.target().x,this.target().y):Infinity}
  private angleError():number{return this.bridge?Math.abs(Phaser.Math.Angle.WrapDegrees(Phaser.Math.RadToDeg(this.bridge.rotation)-this.target().rotationDeg)):Infinity}
  private isCorrectPart():boolean{return !!this.bridge&&this.target().acceptsPartIds.includes(this.selectedPartId)}
  private canSnap():boolean{return this.isCorrectPart()&&this.distanceToTarget()<=this.target().radius}

  private applySoftSnap():void { if(!this.bridge)return;const strength=Phaser.Math.Clamp(1-this.distanceToTarget()/210,0,1);this.connectorGlows.forEach(g=>g.setAlpha(.1+strength*.55).setScale(1+strength*.18));if(this.canSnap()){this.bridge.x=Phaser.Math.Linear(this.bridge.x,this.target().x,.12);this.bridge.y=Phaser.Math.Linear(this.bridge.y,this.target().y,.12);this.bridge.rotation=Phaser.Math.Linear(this.bridge.rotation,Phaser.Math.DegToRad(this.target().rotationDeg),.045)} }
  private applyReleaseSnap():void { if(!this.bridge||!this.canSnap())return;this.tweens.add({targets:this.bridge,x:this.target().x,y:this.target().y,rotation:Phaser.Math.DegToRad(this.target().rotationDeg),duration:220,ease:'Back.Out',onUpdate:()=>this.updateBridgeUi(),onComplete:()=>{this.updateBridgeUi();this.setMessage('Готово! Нажми «Запуск».');this.setModeCopy('Деталь установлена','Запусти механизм и проверь решение')}}); }
  private updateBridgeUi():void { if(!this.bridge||!this.handle||!this.handleLine||!this.bridgeShadow)return;const d=82,a=this.bridge.rotation-Math.PI/2,hx=this.bridge.x+Math.cos(a)*d,hy=this.bridge.y+Math.sin(a)*d;this.handle.setPosition(hx,hy);this.handleLine.setTo(this.bridge.x,this.bridge.y,hx,hy);this.bridgeShadow.setPosition(this.bridge.x,this.bridge.y+30).setRotation(this.bridge.rotation); }

  private createCollisions():void { this.matter.world.on('collisionstart',(event:Phaser.Physics.Matter.Events.CollisionStartEvent)=>{for(const pair of event.pairs){const labels=[pair.bodyA.label,pair.bodyB.label];if(labels.includes('energy-ball')&&labels.includes('receiver')){this.winLevel();return}}}); }

  private runSimulation():void {
    if(this.mode!=='build'||!this.bridge)return;
    progress=recordAttempt(progress,this.level.id);
    if(this.canSnap()&&this.angleError()<=this.target().angleToleranceDeg){this.bridge.setPosition(this.target().x,this.target().y).setRotation(Phaser.Math.DegToRad(this.target().rotationDeg));this.updateBridgeUi()}
    this.mode='running';this.lockButtons(true);this.setModeCopy('Симуляция','Наблюдай за движением шара');this.setMessage('Энергия пошла!');this.bridge.disableInteractive();this.handle?.setVisible(false);this.handleLine?.setVisible(false);this.hintGroup.setVisible(false);this.ballPreview?.setVisible(false);
    const part=getPart(this.selectedPartId);if(part.body.type!=='rectangle')return;this.bridgeBody=this.matter.add.rectangle(this.bridge.x,this.bridge.y+4,part.body.width,part.body.height,{isStatic:true,angle:this.bridge.rotation,friction:part.friction??.004,restitution:part.restitution??.015,label:'bridge'});
    const ballData=this.level.placedParts.find(p=>p.partId==='ball')!;this.ball=this.matter.add.image(ballData.x,ballData.y-12,'energy-ball',undefined,{friction:.002,frictionAir:.0008,restitution:.025,density:.0026,label:'energy-ball'});this.ball.setCircle(32);this.ball.setAngularVelocity(.025);
    this.runTimer=window.setTimeout(()=>{if(this.mode==='running')this.failAttempt(this.pickFailureHint())},this.level.simulationTimeoutMs);
  }

  private failAttempt(message:string):void { if(this.mode!=='running')return;this.mode='build';this.clearSimulation();this.ballPreview?.setVisible(true);this.bridge?.setInteractive({useHandCursor:true});this.handle?.setVisible(true);this.handleLine?.setVisible(true);this.lockButtons(false);this.setModeCopy('Режим сборки','Положение детали сохранено — поправь и попробуй снова');this.setMessage(message);this.updateBridgeUi(); }
  private pickFailureHint():string { if(!this.isCorrectPart())return 'Эта пластина не подходит по длине. Выбери другую.';if(this.distanceToTarget()>this.target().positionTolerance+80)return this.level.failureHints[0];if(this.angleError()>this.target().angleToleranceDeg)return this.level.failureHints[1]??this.level.failureHints[0];return this.level.failureHints[Math.floor(Math.random()*this.level.failureHints.length)]; }

  private winLevel():void { if(this.mode!=='running')return;this.mode='success';if(this.runTimer)clearTimeout(this.runTimer);const next=CHAPTER_ONE_LEVELS[this.levelIndex+1];progress=completeLevel(progress,this.level.id,next?.id);this.lockButtons(true);this.setModeCopy('Квест выполнен',this.level.teachingPoint);this.setMessage(this.level.successLine);if(this.ball){this.ball.setVelocity(0,0);this.ball.setStatic(true);this.ball.setVisible(false)}this.tweens.add({targets:this.receiverGlow,alpha:{from:.2,to:.95},scale:{from:1,to:1.25},duration:450,yoyo:true,repeat:2});this.robotEyes.forEach(e=>e.setFillStyle(0x66e8ff));this.tweens.add({targets:this.robot,y:this.robot.y-8,duration:250,yoyo:true,repeat:2});const card=document.querySelector<HTMLElement>('#result-card');if(card)card.hidden=false;this.text('#result-title',this.level.successLine);this.text('#result-copy',next?'Открыт следующий учебный квест.':'Первые три квеста пройдены!');const nextButton=document.querySelector<HTMLButtonElement>('#next-button');if(nextButton)nextButton.textContent=next?'Следующий квест →':'Повторить главу'}

  private clearSimulation():void { if(this.runTimer)clearTimeout(this.runTimer);this.ball?.destroy();this.ball=undefined;if(this.bridgeBody){this.matter.world.remove(this.bridgeBody);this.bridgeBody=undefined} }
  private restartLevel():void { this.clearSimulation();this.scene.restart({levelIndex:this.levelIndex}); }
  private goNext():void { const next=this.levelIndex+1<CHAPTER_ONE_LEVELS.length?this.levelIndex+1:0;requestedLevelIndex=next;this.scene.restart({levelIndex:next}); }
  private toggleHint():void { if(this.mode!=='build')return;const visible=!this.hintGroup.visible;this.hintGroup.setVisible(visible);this.setMessage(visible?this.level.hint:this.level.introLine); }

  private selectPart(id:string):void { if(this.mode!=='build'||!this.level.availablePartIds.includes(id))return;this.spawnBridge(id);this.setMessage(`Выбрана деталь: ${getPart(id).displayName}. Перетащи её на поле.`);this.setModeCopy('Режим сборки','Перетащи выбранную деталь в разрыв'); }

  private updateDomForLevel():void { this.text('#quest-counter',`Квест ${this.level.quest} из 10`);this.text('#quest-title',this.level.title);this.text('#quest-objective',this.level.objective);this.setMessage(this.level.introLine);this.setModeCopy('Режим сборки',this.level.teachingPoint);const card=document.querySelector<HTMLElement>('#result-card');if(card)card.hidden=true;this.lockButtons(false);this.renderInventory(); }
  private renderInventory():void { const root=document.querySelector<HTMLElement>('#inventory');if(!root)return;root.innerHTML='';for(const id of this.level.availablePartIds){const part=getPart(id);const button=document.createElement('button');button.type='button';button.className=`part-option${id===this.selectedPartId?' is-selected':''}`;const size=id.includes('short')?'short':id.includes('long')?'long':'medium';button.innerHTML=`<span class="part-chip ${size}"></span><span><strong>${part.displayName}</strong><span>${id===this.selectedPartId?'На игровом поле':'Нажми, чтобы выбрать'}</span></span>`;button.addEventListener('click',()=>this.selectPart(id));root.append(button)} }
  private lockButtons(locked:boolean):void { const run=document.querySelector<HTMLButtonElement>('#run-button');const hint=document.querySelector<HTMLButtonElement>('#hint-button');if(run)run.disabled=locked;if(hint)hint.disabled=locked; }
  private setMessage(value:string):void{this.text('#message-bubble',value)}
  private setModeCopy(title:string,copy:string):void{this.text('#mode-title',title);this.text('#mode-copy',copy)}
  private text(selector:string,value:string):void{const node=document.querySelector<HTMLElement>(selector);if(node)node.textContent=value}
}

const config: Phaser.Types.Core.GameConfig={type:Phaser.AUTO,parent:'game-container',width:WORLD_WIDTH,height:WORLD_HEIGHT,backgroundColor:'#ead9bd',antialias:true,render:{antialias:true,pixelArt:false,powerPreference:'high-performance'},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH,width:WORLD_WIDTH,height:WORLD_HEIGHT},physics:{default:'matter',matter:{gravity:{x:0,y:1.05},enableSleeping:false,debug:false}},scene:[WorkshopScene]};
new Phaser.Game(config);
document.querySelector<HTMLButtonElement>('#run-button')?.addEventListener('click',()=>window.youngInventorGame?.run());
document.querySelector<HTMLButtonElement>('#reset-button')?.addEventListener('click',()=>window.youngInventorGame?.reset());
document.querySelector<HTMLButtonElement>('#hint-button')?.addEventListener('click',()=>window.youngInventorGame?.toggleHint());
document.querySelector<HTMLButtonElement>('#next-button')?.addEventListener('click',()=>window.youngInventorGame?.next());