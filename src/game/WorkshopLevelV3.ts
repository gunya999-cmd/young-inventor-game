// @ts-nocheck
import Phaser from 'phaser';
import { VISUAL_ASSETS } from './visualAssets';
import {
  WORLD_HEIGHT,
  WORLD_WIDTH,
  completeHud,
  failHud,
  resetHud,
  ringBell,
  setActiveScene,
  setObjective,
  setPartState,
  setStatus,
  setTimer,
  startSimulationHud
} from './ui';

type Phase =
  | 'build'
  | 'ball-ramp'
  | 'ball-guide'
  | 'bucket'
  | 'ball2'
  | 'lever'
  | 'hammer'
  | 'complete'
  | 'failed';

const RAMP_A = new Phaser.Math.Vector2(135, 282);
const RAMP_B = new Phaser.Math.Vector2(455, 420);
const GUIDE_END = new Phaser.Math.Vector2(505, 520);
const PULLEY_LEFT = new Phaser.Math.Vector2(530, 226);
const PULLEY_RIGHT = new Phaser.Math.Vector2(675, 226);
const BUCKET_X = 505;
const BUCKET_START_Y = 605;
const GATE_X = 720;
const GATE_START_Y = 610;
const LEVER_PIVOT = new Phaser.Math.Vector2(945, 625);
const HAMMER_PIVOT = new Phaser.Math.Vector2(1260, 320);
const BELL_POINT = new Phaser.Math.Vector2(1425, 565);

export class WorkshopLevelV3 extends Phaser.Scene {
  phase: Phase = 'build';
  running = false;
  completed = false;
  elapsed = 0;

  guidePlaced = false;
  ropeConnected = false;
  weightAdded = false;
  selectedPart: 'guide' | 'weight' | 'rope' | null = null;

  guideAngle = 18;
  weightOffset = -82;

  ballDistance = 0;
  ballVelocity = 0;
  guideDistance = 0;
  bucketDrop = 0;
  bucketVelocity = 0;
  ball2Distance = 0;
  ball2Velocity = 0;
  leverAngle = 0;
  leverOmega = 0;
  hammerTheta = -0.78;
  hammerOmega = 0;

  ropeGraphics!: Phaser.GameObjects.Graphics;
  ball!: Phaser.GameObjects.Image;
  ball2!: Phaser.GameObjects.Image;
  bucket!: Phaser.GameObjects.Image;
  gatePanel!: Phaser.GameObjects.Image;
  gateFrame!: Phaser.GameObjects.Image;
  lever!: Phaser.GameObjects.Image;
  leverStand!: Phaser.GameObjects.Image;
  latch!: Phaser.GameObjects.Image;
  hammer!: Phaser.GameObjects.Image;
  bell!: Phaser.GameObjects.Image;
  guide!: Phaser.GameObjects.Image;
  guideGhost!: Phaser.GameObjects.Image;
  weight!: Phaser.GameObjects.Image;
  weightGhost!: Phaser.GameObjects.Image;
  pulleyLeft!: Phaser.GameObjects.Image;
  pulleyRight!: Phaser.GameObjects.Image;
  statusMarker!: Phaser.GameObjects.Graphics;

  constructor() {
    super('WorkshopLevelV3');
  }

  preload(): void {
    Object.entries(VISUAL_ASSETS).forEach(([key, uri]) => this.load.image(key, uri));
  }

  create(): void {
    setActiveScene(this);
    this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'background').setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT).setDepth(-20);
    this.createStaticScene();
    this.createMechanism();
    this.createBuildInput();
    resetHud();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setActiveScene(null));

    if (new URLSearchParams(window.location.search).has('autoplay')) {
      window.__TIM_AUTOPLAY_RESULT__ = 'loading';
      this.time.delayedCall(450, () => {
        this.applyHint();
        this.time.delayedCall(250, () => this.startSimulation());
      });
    }
  }

  createStaticScene(): void {
    this.add.image(250, 512, 'ramp_support').setDisplaySize(500, 555).setDepth(1);
    this.bell = this.add.image(1505, 595, 'bell_assembly').setDisplaySize(240, 410).setDepth(4);

    const metal = this.add.graphics().setDepth(1);
    metal.fillStyle(0x22282b, 1);
    metal.fillRoundedRect(505, 138, 48, 90, 6);
    metal.fillRoundedRect(650, 138, 48, 90, 6);
    metal.fillRoundedRect(640, 205, 18, 360, 5);
    metal.fillRoundedRect(780, 205, 18, 360, 5);
    metal.fillRoundedRect(620, 704, 215, 28, 6);
    metal.fillRoundedRect(875, 703, 150, 26, 6);
    metal.fillRoundedRect(1088, 690, 120, 25, 5);

    this.pulleyLeft = this.add.image(PULLEY_LEFT.x, PULLEY_LEFT.y, 'pulley').setDisplaySize(95, 105).setDepth(7);
    this.pulleyRight = this.add.image(PULLEY_RIGHT.x, PULLEY_RIGHT.y, 'pulley2').setDisplaySize(95, 105).setDepth(7);
    this.leverStand = this.add.image(935, 665, 'lever_stand').setDisplaySize(220, 215).setDepth(3);
    this.latch = this.add.image(1160, 610, 'latch').setDisplaySize(140, 320).setDepth(5);
  }

  createMechanism(): void {
    this.ropeGraphics = this.add.graphics().setDepth(5);

    this.ball = this.add.image(RAMP_A.x, RAMP_A.y, 'ball').setDisplaySize(72, 72).setDepth(9);
    this.ball2 = this.add.image(728, 445, 'ball2').setDisplaySize(64, 64).setDepth(9);

    this.bucket = this.add.image(BUCKET_X, BUCKET_START_Y, 'bucket').setDisplaySize(150, 210).setDepth(7);
    this.gateFrame = this.add.image(715, 545, 'gate_frame').setDisplaySize(200, 365).setDepth(4);
    this.gatePanel = this.add.image(GATE_X, GATE_START_Y, 'gate_panel').setDisplaySize(125, 205).setDepth(6);

    this.lever = this.add.image(LEVER_PIVOT.x, LEVER_PIVOT.y, 'lever').setDisplaySize(395, 125).setDepth(6);
    this.lever.setOrigin(185 / 395, 85 / 125);

    this.hammer = this.add.image(HAMMER_PIVOT.x, HAMMER_PIVOT.y, 'hammer').setDisplaySize(205, 365).setDepth(8);
    this.hammer.setOrigin(65 / 205, 35 / 365);
    this.hammer.setRotation(this.hammerTheta - 0.14);

    this.guideGhost = this.add.image(500, 458, 'guide').setDisplaySize(185, 82).setAlpha(0.18).setTint(0xffd49b).setDepth(4);
    this.guideGhost.setAngle(this.guideAngle);

    this.weightGhost = this.add.image(0, 0, 'counterweight').setDisplaySize(92, 92).setAlpha(0.16).setDepth(8);
    this.updateWeightVisual(this.weightGhost);

    this.statusMarker = this.add.graphics().setDepth(3);
    this.statusMarker.lineStyle(3, 0xe8b565, 0.28);
    this.statusMarker.strokeCircle(505, 500, 56);
    this.statusMarker.strokeCircle(810, 570, 44);

    this.drawRope();
  }

  createBuildInput(): void {
    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Image, dragX: number, dragY: number) => {
      if (this.running || this.completed) return;
      if (gameObject === this.guide) {
        gameObject.setPosition(Phaser.Math.Clamp(dragX, 445, 555), Phaser.Math.Clamp(dragY, 415, 505));
        this.selectedPart = 'guide';
        setStatus('Настрой направляющую так, чтобы шар попал в ведро.');
      } else if (gameObject === this.weight) {
        this.weightOffset = Phaser.Math.Clamp(dragX - LEVER_PIVOT.x, -155, 145);
        this.selectedPart = 'weight';
        this.updateWeightVisual(this.weight);
        setStatus('Груз должен усиливать левое плечо рычага.');
      }
    });
  }

  addGuide(): void {
    if (this.running || this.guidePlaced) return;
    this.guidePlaced = true;
    this.guideGhost.setVisible(false);
    this.guide = this.add.image(500, 458, 'guide').setDisplaySize(185, 82).setDepth(8).setAngle(this.guideAngle);
    this.guide.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(this.guide);
    this.selectedPart = 'guide';
    setPartState('guide', true, true);
    this.updateBuildObjective();
  }

  connectRope(): void {
    if (this.running || this.ropeConnected) return;
    this.ropeConnected = true;
    this.selectedPart = 'rope';
    setPartState('rope', true, true);
    this.drawRope();
    this.updateBuildObjective();
    setStatus('Верёвка соединена: ведро будет поднимать заслонку через блоки.');
  }

  addWeight(): void {
    if (this.running || this.weightAdded) return;
    this.weightAdded = true;
    this.weightGhost.setVisible(false);
    this.weight = this.add.image(0, 0, 'counterweight').setDisplaySize(92, 92).setDepth(9);
    this.weight.setInteractive({ draggable: true, useHandCursor: true });
    this.input.setDraggable(this.weight);
    this.updateWeightVisual(this.weight);
    this.selectedPart = 'weight';
    setPartState('weight', true, true);
    this.updateBuildObjective();
  }

  rotateGuide(direction: number): void {
    if (this.running || !this.guidePlaced) return;
    this.guideAngle = Phaser.Math.Clamp(this.guideAngle + direction * 2, 5, 34);
    this.guide.setAngle(this.guideAngle);
    this.selectedPart = 'guide';
  }

  applyHint(): void {
    if (this.running) return;
    if (!this.guidePlaced) this.addGuide();
    if (!this.ropeConnected) this.connectRope();
    if (!this.weightAdded) this.addWeight();
    this.guideAngle = 18;
    this.guide.setPosition(500, 458).setAngle(this.guideAngle);
    this.weightOffset = -92;
    this.updateWeightVisual(this.weight);
    setObjective('Рабочая конфигурация установлена');
    setStatus('Подсказка выставила устойчивое решение. Нажми «Пуск».');
  }

  updateBuildObjective(): void {
    const count = Number(this.guidePlaced) + Number(this.ropeConnected) + Number(this.weightAdded);
    setObjective(count === 3 ? 'Механизм готов к запуску' : `Установлено ${count} из 3 деталей`);
  }

  isGuideValid(): boolean {
    if (!this.guidePlaced) return false;
    return Math.abs(this.guide.x - 500) < 55 && Math.abs(this.guide.y - 458) < 55 && this.guideAngle >= 9 && this.guideAngle <= 29;
  }

  isWeightValid(): boolean {
    return this.weightAdded && this.weightOffset < -35;
  }

  startSimulation(): void {
    if (this.running || this.completed) return;
    if (!this.guidePlaced || !this.ropeConnected || !this.weightAdded) {
      setStatus('Сначала установи направляющую, верёвку и груз рычага.');
      return;
    }
    this.running = true;
    this.phase = 'ball-ramp';
    this.elapsed = 0;
    this.ballDistance = 0;
    this.ballVelocity = 8;
    this.guideDistance = 0;
    this.bucketDrop = 0;
    this.bucketVelocity = 0;
    this.ball2Distance = 0;
    this.ball2Velocity = 20;
    this.leverAngle = 0;
    this.leverOmega = 0;
    this.hammerTheta = -0.78;
    this.hammerOmega = 0;
    window.__TIM_AUTOPLAY_RESULT__ = 'running';
    startSimulationHud();
    setStatus('Шар ускоряется по наклонной направляющей.');
  }

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 1 / 30);
    this.drawRope();
    if (!this.running || this.completed) return;

    this.elapsed += dt;
    setTimer(this.elapsed);

    if (this.phase === 'ball-ramp') this.updateBallRamp(dt);
    else if (this.phase === 'ball-guide') this.updateBallGuide(dt);
    else if (this.phase === 'bucket') this.updateBucket(dt);
    else if (this.phase === 'ball2') this.updateBall2(dt);
    else if (this.phase === 'lever') this.updateLever(dt);
    else if (this.phase === 'hammer') this.updateHammer(dt);

    if (this.elapsed > 13 && !this.completed && this.phase !== 'failed') this.failLevel('Механизм остановился до удара по колоколу.');
  }

  updateBallRamp(dt: number): void {
    const direction = RAMP_B.clone().subtract(RAMP_A);
    const length = direction.length();
    direction.normalize();
    const incline = Math.atan2(RAMP_B.y - RAMP_A.y, RAMP_B.x - RAMP_A.x);
    this.ballVelocity += 920 * Math.sin(incline) * dt * 0.62;
    this.ballDistance += this.ballVelocity * dt;
    const s = Math.min(this.ballDistance, length);
    this.ball.setPosition(RAMP_A.x + direction.x * s, RAMP_A.y + direction.y * s - 20);
    this.ball.rotation += (this.ballVelocity / 34) * dt;
    if (this.ballDistance >= length) {
      if (!this.isGuideValid()) {
        this.failLevel('Шар прошёл мимо ведра. Измени положение направляющей.');
        return;
      }
      this.phase = 'ball-guide';
      this.guideDistance = 0;
      setStatus('Направляющая переводит шар точно в ведро.');
    }
  }

  updateBallGuide(dt: number): void {
    const start = RAMP_B;
    const end = GUIDE_END;
    const dir = end.clone().subtract(start);
    const length = dir.length();
    dir.normalize();
    this.ballVelocity += 310 * dt;
    this.guideDistance += this.ballVelocity * dt;
    const s = Math.min(this.guideDistance, length);
    this.ball.setPosition(start.x + dir.x * s, start.y + dir.y * s - 10);
    this.ball.rotation += (this.ballVelocity / 34) * dt;
    if (this.guideDistance >= length) {
      this.phase = 'bucket';
      this.bucketVelocity = 0;
      this.ball.setPosition(BUCKET_X, BUCKET_START_Y - 35);
      setStatus('Шар попал в ведро. Его масса приводит в движение систему блоков.');
    }
  }

  updateBucket(dt: number): void {
    this.bucketVelocity += 98 * dt;
    this.bucketDrop = Math.min(142, this.bucketDrop + this.bucketVelocity * dt);
    const gateRise = this.bucketDrop * 0.92;
    this.bucket.setY(BUCKET_START_Y + this.bucketDrop);
    this.ball.setPosition(BUCKET_X, BUCKET_START_Y + this.bucketDrop - 35);
    this.gatePanel.setY(GATE_START_Y - gateRise);
    this.pulleyLeft.rotation = this.bucketDrop * 0.025;
    this.pulleyRight.rotation = -this.bucketDrop * 0.025;
    if (gateRise >= 105) {
      this.phase = 'ball2';
      this.ball2Distance = 0;
      this.ball2Velocity = 18;
      setStatus('Заслонка поднята. Второй шар освобождён и идёт к рычагу.');
    }
  }

  updateBall2(dt: number): void {
    const points = [
      new Phaser.Math.Vector2(728, 445),
      new Phaser.Math.Vector2(748, 488),
      new Phaser.Math.Vector2(785, 535),
      new Phaser.Math.Vector2(818, 575)
    ];
    const segments = points.slice(0, -1).map((p, i) => ({ p, q: points[i + 1], len: Phaser.Math.Distance.BetweenPoints(p, points[i + 1]) }));
    const total = segments.reduce((sum, seg) => sum + seg.len, 0);
    this.ball2Velocity += 430 * dt;
    this.ball2Distance = Math.min(total, this.ball2Distance + this.ball2Velocity * dt);
    let remaining = this.ball2Distance;
    let pos = points[0].clone();
    for (const seg of segments) {
      if (remaining <= seg.len) {
        const t = remaining / seg.len;
        pos = seg.p.clone().lerp(seg.q, t);
        break;
      }
      remaining -= seg.len;
      pos = seg.q.clone();
    }
    this.ball2.setPosition(pos.x, pos.y);
    this.ball2.rotation += (this.ball2Velocity / 30) * dt;
    if (this.ball2Distance >= total) {
      if (!this.isWeightValid()) {
        this.failLevel('Рычагу не хватило момента. Перемести груз на левое плечо.');
        return;
      }
      this.phase = 'lever';
      setStatus('Шар и противовес создают достаточный момент на левом плече рычага.');
    }
  }

  updateLever(dt: number): void {
    const ballTorque = 6.2;
    const weightAssist = Phaser.Math.Clamp((-this.weightOffset - 35) / 120, 0, 1) * 4.0;
    const damping = 4.8;
    const angularAcceleration = -(ballTorque + weightAssist) - damping * this.leverOmega;
    this.leverOmega += angularAcceleration * dt;
    this.leverAngle = Math.max(-0.18, this.leverAngle + this.leverOmega * dt);
    this.lever.setRotation(this.leverAngle);
    this.updateWeightVisual(this.weight);
    const left = this.leverPoint(-130, -24);
    this.ball2.setPosition(left.x, left.y);
    if (this.leverAngle <= -0.135) {
      this.phase = 'hammer';
      this.hammerOmega = 0;
      setStatus('Правое плечо подняло стопор. Маятниковый молоток освобождён.');
    }
  }

  updateHammer(dt: number): void {
    const gravityOverLength = 3.45;
    const damping = 0.035;
    const acceleration = -gravityOverLength * Math.sin(this.hammerTheta) - damping * this.hammerOmega;
    this.hammerOmega += acceleration * dt;
    this.hammerTheta += this.hammerOmega * dt;
    this.hammer.setRotation(this.hammerTheta - 0.14);

    const head = new Phaser.Math.Vector2(
      HAMMER_PIVOT.x + 290 * Math.sin(this.hammerTheta),
      HAMMER_PIVOT.y + 290 * Math.cos(this.hammerTheta)
    );
    if (Phaser.Math.Distance.BetweenPoints(head, BELL_POINT) < 48 && this.hammerOmega > 0.25) this.finishLevel();
  }

  leverPoint(localX: number, localY = 0): Phaser.Math.Vector2 {
    const c = Math.cos(this.leverAngle);
    const s = Math.sin(this.leverAngle);
    return new Phaser.Math.Vector2(LEVER_PIVOT.x + c * localX - s * localY, LEVER_PIVOT.y + s * localX + c * localY);
  }

  updateWeightVisual(sprite?: Phaser.GameObjects.Image): void {
    if (!sprite) return;
    const p = this.leverPoint(this.weightOffset, -50);
    sprite.setPosition(p.x, p.y).setRotation(this.leverAngle);
  }

  drawRope(): void {
    if (!this.ropeGraphics) return;
    this.ropeGraphics.clear();
    if (!this.ropeConnected) return;
    const bucketHook = new Phaser.Math.Vector2(BUCKET_X, this.bucket ? this.bucket.y - 98 : BUCKET_START_Y - 98);
    const gateHook = new Phaser.Math.Vector2(GATE_X, this.gatePanel ? this.gatePanel.y - 100 : GATE_START_Y - 100);
    this.ropeGraphics.lineStyle(9, 0x6a431f, 0.98);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(bucketHook.x, bucketHook.y);
    this.ropeGraphics.lineTo(PULLEY_LEFT.x, PULLEY_LEFT.y);
    this.ropeGraphics.lineTo(PULLEY_RIGHT.x, PULLEY_RIGHT.y);
    this.ropeGraphics.lineTo(gateHook.x, gateHook.y);
    this.ropeGraphics.strokePath();
    this.ropeGraphics.lineStyle(3, 0xe1b66e, 0.88);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(bucketHook.x + 2, bucketHook.y);
    this.ropeGraphics.lineTo(PULLEY_LEFT.x + 2, PULLEY_LEFT.y);
    this.ropeGraphics.lineTo(PULLEY_RIGHT.x - 2, PULLEY_RIGHT.y);
    this.ropeGraphics.lineTo(gateHook.x - 2, gateHook.y);
    this.ropeGraphics.strokePath();
  }

  finishLevel(): void {
    if (this.completed) return;
    this.completed = true;
    this.running = false;
    this.phase = 'complete';
    this.tweens.add({ targets: this.bell, angle: { from: -2, to: 2 }, yoyo: true, repeat: 5, duration: 75 });
    ringBell();
    completeHud(this.elapsed);
    window.__TIM_AUTOPLAY_RESULT__ = 'passed';
  }

  failLevel(message: string): void {
    if (this.completed || this.phase === 'failed') return;
    this.running = false;
    this.phase = 'failed';
    failHud(message);
    window.__TIM_AUTOPLAY_RESULT__ = 'failed';
  }

  resetLevel(): void {
    window.location.href = window.location.pathname + window.location.search;
  }
}
