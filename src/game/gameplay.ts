// @ts-nocheck
import Phaser from 'phaser';
import {
  app,
  partButtons,
  clamp,
  completeHud,
  failHud,
  ringBell,
  setObjective,
  setPartState,
  setStatus,
  setTimer,
  startSimulationHud
} from './ui';

export const gameplayMethods = {
  createBuildInput() {
    this.input.on('drag', (_pointer, gameObject, dragX, dragY) => {
      if (this.running || this.failed || this.completed) return;

      if (gameObject === this.guide) {
        const x = clamp(dragX, 445, 565);
        const y = clamp(dragY, 375, 455);
        gameObject.setPosition(x, y);
        Phaser.Physics.Matter.Matter.Body.setPosition(gameObject.body, { x, y });
        this.selectPart('guide');
      }

      if (gameObject === this.weightSprite) {
        this.weightOffset = clamp(dragX - this.lever.x, 35, 150);
        this.updateWeightVisual();
        this.selectPart('weight');
      }
    });
  },

  selectPart(part) {
    this.selectedPart = part;
    partButtons.forEach((button) => button.classList.toggle('selected', button.dataset.part === part));
  },

  addGuide() {
    if (this.running || this.guidePlaced) return;
    this.guidePlaced = true;
    this.guideGhost.setVisible(false);
    this.guide = this.matter.add.image(500, 410, 'wood-plank-v2');
    this.guide.setDisplaySize(235, 38).setRectangle(235, 27).setStatic(true).setAngle(this.guideAngle).setFriction(.75).setDepth(6);
    this.guide.body.label = 'player-guide';
    this.guide.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.guide);
    setPartState('guide', true, true);
    this.selectPart('guide');
    this.updateBuildObjective();
    setStatus('Поставь направляющую между первой рампой и ведром.');
  },

  connectRope() {
    if (this.running || this.ropeConnected) return;
    this.ropeConnected = true;
    setPartState('rope', true, true);
    this.selectPart('rope');
    this.updateBuildObjective();
    this.drawRope();
    setStatus('Верёвка передаст движение ведра вертикальной заслонке.');
  },

  addWeight() {
    if (this.running || this.weightAdded) return;
    this.weightAdded = true;
    this.weightGhost.setVisible(false);
    this.weightSprite = this.add.image(0, 0, 'counterweight-v2').setScale(.76).setDepth(9);
    this.weightSprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.weightSprite);
    this.updateWeightVisual();
    setPartState('weight', true, true);
    this.selectPart('weight');
    this.updateBuildObjective();
    setStatus('Сдвигай противовес по правому плечу: слишком далеко — шар не перевесит рычаг.');
  },

  updateBuildObjective() {
    const installed = Number(this.guidePlaced) + Number(this.ropeConnected) + Number(this.weightAdded);
    setObjective(installed === 3 ? 'Конструкция готова к запуску' : `Установлено ${installed} из 3 деталей`);
  },

  rotateGuide(direction) {
    if (this.running || !this.guidePlaced || this.selectedPart !== 'guide') return;
    this.guideAngle = clamp(this.guideAngle + direction * 2, 8, 29);
    this.guide.setAngle(this.guideAngle);
    Phaser.Physics.Matter.Matter.Body.setAngle(this.guide.body, Phaser.Math.DegToRad(this.guideAngle));
  },

  applyHint() {
    if (this.running) return;
    if (!this.guidePlaced) this.addGuide();
    if (!this.ropeConnected) this.connectRope();
    if (!this.weightAdded) this.addWeight();

    this.guideAngle = 18;
    this.guide.setPosition(500, 410).setAngle(this.guideAngle);
    Phaser.Physics.Matter.Matter.Body.setPosition(this.guide.body, { x: 500, y: 410 });
    Phaser.Physics.Matter.Matter.Body.setAngle(this.guide.body, Phaser.Math.DegToRad(this.guideAngle));
    this.weightOffset = 58;
    this.updateWeightVisual();
    this.selectPart('guide');
    setStatus('Рабочая конфигурация установлена. Нажми «Пуск».');
  },

  startSimulation() {
    if (this.running || this.failed || this.completed) return;
    this.running = true;
    this.elapsed = 0;
    startSimulationHud();
    this.selectPart(null);

    Phaser.Physics.Matter.Matter.Body.setStatic(this.ball1.body, false);
    Phaser.Physics.Matter.Matter.Body.setVelocity(this.ball1.body, { x: .4, y: 0 });
    Phaser.Physics.Matter.Matter.Body.setStatic(this.lever.body, false);
    Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.lever.body, 0);

    setStatus('Симуляция запущена. Теперь работают только гравитация и механические связи.');
    window.__TIM_AUTOPLAY_RESULT__ = 'running';
  },

  update(_time, delta) {
    this.syncVisuals();
    if (!this.running || this.completed || this.failed) return;

    this.elapsed += Math.min(delta, 34) / 1000;
    setTimer(this.elapsed);

    this.enforceVerticalGuide(this.bucketBody, this.bucketX, 470, 655);
    this.enforceVerticalGuide(this.gate.body, this.gateX, 390, 545);

    if (this.ballCaught && this.ropeConnected) this.solvePulleyConstraint();
    this.stabilizeLever();
    this.applyCounterweightForce();
    this.limitLever();

    if (!this.ballCaught) this.checkBucketCapture();
    if (!this.secondReleased && this.gate.body.position.y < 420) this.releaseSecondBall();
    if (!this.ball2OnLever) this.checkBall2OnLever();
    if (!this.hammerReleased && this.ball2OnLever && this.lever.body.angle < -.105) this.releaseHammer();
    if (this.hammerReleased) this.checkBellStrike();

    if (this.elapsed > 16.5 && !this.completed) this.failLevel();
  },

  syncVisuals() {
    if (this.bucketBody && this.bucketSprite) this.syncBucketRig();
    if (this.ropeConnected) this.drawRope();
    if (this.weightAdded) this.updateWeightVisual();
    this.drawLeverLink();
  },

  syncBucketRig() {
    const Body = Phaser.Physics.Matter.Matter.Body;
    const x = this.bucketBody.position.x;
    const y = this.bucketBody.position.y;
    this.bucketSprite.setPosition(x, y - 60);
    Body.setPosition(this.bucketLeftWall, { x: x - 45, y: y - 43 });
    Body.setPosition(this.bucketRightWall, { x: x + 45, y: y - 43 });
    Body.setPosition(this.bucketSensor, { x, y: y - 48 });
  },

  enforceVerticalGuide(body, x, minY, maxY) {
    if (body.isStatic) return;
    const Body = Phaser.Physics.Matter.Matter.Body;
    const y = clamp(body.position.y, minY, maxY);
    Body.setPosition(body, { x, y });
    Body.setVelocity(body, { x: 0, y: clamp(body.velocity.y, -7, 7) });
    Body.setAngle(body, 0);
    Body.setAngularVelocity(body, 0);
  },

  solvePulleyConstraint() {
    const Body = Phaser.Physics.Matter.Matter.Body;
    const bucket = this.bucketBody;
    const gate = this.gate.body;
    if (bucket.isStatic || gate.isStatic) return;

    const inverseBucket = 1 / Math.max(bucket.mass + (this.ballCaught ? this.ball1.body.mass : 0), .001);
    const inverseGate = 1 / Math.max(gate.mass, .001);
    const inverseSum = inverseBucket + inverseGate;

    const velocityError = bucket.velocity.y + gate.velocity.y;
    const velocityImpulse = -velocityError / inverseSum;
    Body.setVelocity(bucket, { x: 0, y: bucket.velocity.y + velocityImpulse * inverseBucket * .72 });
    Body.setVelocity(gate, { x: 0, y: gate.velocity.y + velocityImpulse * inverseGate * .72 });

    const positionError = bucket.position.y + gate.position.y - this.ropeLength;
    const positionImpulse = (-positionError / inverseSum) * .48;
    Body.setPosition(bucket, { x: this.bucketX, y: bucket.position.y + positionImpulse * inverseBucket });
    Body.setPosition(gate, { x: this.gateX, y: gate.position.y + positionImpulse * inverseGate });
  },

  stabilizeLever() {
    if (this.lever.body.isStatic) return;
    const body = this.lever.body;
    body.torque += -body.angle * .016 - body.angularVelocity * .032;
  },

  limitLever() {
    if (this.lever.body.isStatic) return;
    const Body = Phaser.Physics.Matter.Matter.Body;
    const minimum = -.29;
    const maximum = .12;
    if (this.lever.body.angle < minimum) {
      Body.setAngle(this.lever.body, minimum);
      Body.setAngularVelocity(this.lever.body, Math.max(0, this.lever.body.angularVelocity));
    }
    if (this.lever.body.angle > maximum) {
      Body.setAngle(this.lever.body, maximum);
      Body.setAngularVelocity(this.lever.body, Math.min(0, this.lever.body.angularVelocity));
    }
  },

  applyCounterweightForce() {
    if (!this.running || !this.weightAdded || this.lever.body.isStatic) return;
    const point = this.getLeverPoint(this.weightOffset, -22);
    Phaser.Physics.Matter.Matter.Body.applyForce(this.lever.body, point, { x: 0, y: .00075 });
  },

  getLeverPoint(localX, localY = 0) {
    const angle = this.lever.body.angle;
    return {
      x: this.lever.body.position.x + Math.cos(angle) * localX - Math.sin(angle) * localY,
      y: this.lever.body.position.y + Math.sin(angle) * localX + Math.cos(angle) * localY
    };
  },

  updateWeightVisual() {
    if (!this.weightSprite) return;
    const point = this.getLeverPoint(this.weightOffset, -49);
    this.weightSprite.setPosition(point.x, point.y).setRotation(this.lever.body.angle);
  },

  drawLeverLink() {
    if (!this.linkGraphics || !this.lever) return;
    const point = this.getLeverPoint(182, -5);
    const pinY = clamp(520 + (point.y - 615) * .62, 486, 548);
    this.latchPin?.setPosition(1215, pinY);
    this.linkGraphics.clear();
    this.linkGraphics.lineStyle(7, 0x3c2b20, 1);
    this.linkGraphics.beginPath();
    this.linkGraphics.moveTo(point.x, point.y);
    this.linkGraphics.lineTo(1215, pinY + 8);
    this.linkGraphics.strokePath();
    this.linkGraphics.lineStyle(2, 0xc39255, .8);
    this.linkGraphics.beginPath();
    this.linkGraphics.moveTo(point.x, point.y - 1);
    this.linkGraphics.lineTo(1215, pinY + 7);
    this.linkGraphics.strokePath();
  },

  drawRope() {
    if (!this.ropeGraphics) return;
    const bucketTop = this.bucketBody.position.y - 112;
    const gateTop = this.gate.body.position.y - 99;
    this.ropeGraphics.clear();
    this.ropeGraphics.lineStyle(8, 0x68431f, 1);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(this.bucketX, bucketTop);
    this.ropeGraphics.lineTo(555, 168);
    this.ropeGraphics.lineTo(710, 168);
    this.ropeGraphics.lineTo(this.gateX, gateTop);
    this.ropeGraphics.strokePath();
    this.ropeGraphics.lineStyle(3, 0xe0ad65, .9);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(this.bucketX + 2, bucketTop);
    this.ropeGraphics.lineTo(557, 168);
    this.ropeGraphics.lineTo(708, 168);
    this.ropeGraphics.lineTo(this.gateX - 2, gateTop);
    this.ropeGraphics.strokePath();
    const travel = this.bucketBody.position.y - this.bucketStartY;
    this.pulleyLeft.setAngle(travel * 1.7);
    this.pulleyRight.setAngle(-travel * 1.7);
  },

  handleCollision(event) {
    if (!this.running) return;
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!this.ballCaught && labels.includes('ball1') && labels.includes('bucket-sensor')) this.captureBall();
      if (!this.ball2OnLever && labels.includes('ball2') && labels.includes('lever')) {
        this.ball2OnLever = true;
        setStatus('Второй шар давит на левое плечо рычага. Правое плечо поднимает стопор.');
      }
    }
  },

  checkBucketCapture() {
    const p = this.ball1.body.position;
    const b = this.bucketBody.position;
    if (Math.abs(p.x - b.x) < 40 && p.y > b.y - 92 && p.y < b.y - 6) this.captureBall();
  },

  captureBall() {
    if (this.ballCaught) return;
    this.ballCaught = true;
    const Body = Phaser.Physics.Matter.Matter.Body;
    Body.setPosition(this.ball1.body, { x: this.bucketX, y: this.bucketBody.position.y - 54 });
    Body.setVelocity(this.ball1.body, { x: 0, y: 0 });
    this.ballCatchConstraint = this.matter.add.constraint(this.bucketBody, this.ball1.body, 34, .9, {
      pointA: { x: 0, y: -18 },
      pointB: { x: 0, y: 0 },
      damping: .32
    });

    if (this.ropeConnected) {
      Body.setStatic(this.bucketBody, false);
      Body.setStatic(this.gate.body, false);
      Body.setVelocity(this.bucketBody, { x: 0, y: .3 });
      Body.setVelocity(this.gate.body, { x: 0, y: -.3 });
    }
    setStatus(this.ropeConnected
      ? 'Шар попал в ведро. Общий вес опускает ведро и поднимает заслонку.'
      : 'Шар в ведре, но без верёвки движение не передаётся заслонке.');
  },

  releaseSecondBall() {
    this.secondReleased = true;
    const Body = Phaser.Physics.Matter.Matter.Body;
    Body.setStatic(this.ball2.body, false);
    Body.setVelocity(this.ball2.body, { x: 1.35, y: 0 });
    setStatus('Заслонка поднята. Второй шар скатывается по лотку к рычагу.');
  },

  checkBall2OnLever() {
    if (!this.secondReleased) return;
    const p = this.ball2.body.position;
    if (p.x > 845 && p.x < 1015 && p.y > 545 && p.y < 650) {
      this.ball2OnLever = true;
      setStatus('Шар оказался на левом плече рычага и создаёт вращающий момент.');
    }
  },

  releaseHammer() {
    if (this.hammerReleased) return;
    this.hammerReleased = true;
    const Body = Phaser.Physics.Matter.Matter.Body;
    Body.setStatic(this.hammer.body, false);
    Body.setAngularVelocity(this.hammer.body, -.016);
    setStatus('Рычаг поднял стопор. Молоток свободно падает как маятник.');
  },

  checkBellStrike() {
    const angle = this.hammer.body.angle;
    const headDistance = 264;
    const head = {
      x: this.hammerPivot.x - Math.sin(angle) * headDistance,
      y: this.hammerPivot.y + Math.cos(angle) * headDistance
    };
    const distance = Phaser.Math.Distance.Between(head.x, head.y, this.bellPoint.x, this.bellPoint.y);
    if (distance < 58 && Math.abs(this.hammer.body.angularVelocity) > .025) this.finishLevel();
  },

  finishLevel() {
    if (this.completed) return;
    this.completed = true;
    this.running = false;
    window.__TIM_AUTOPLAY_RESULT__ = 'passed';
    ringBell();
    completeHud(this.elapsed);
    this.tweens.add({ targets: this.bell, angle: { from: -3, to: 3 }, duration: 85, yoyo: true, repeat: 7, ease: 'Sine.easeInOut' });
    this.time.delayedCall(900, () => this.matter.world.pause());
  },

  failLevel() {
    if (this.failed || this.completed) return;
    this.failed = true;
    this.running = false;
    window.__TIM_AUTOPLAY_RESULT__ = 'failed';
    failHud();
    this.matter.world.pause();
  },

  resetLevel() {
    this.matter.world.resume();
    app?.classList.remove('simulating', 'completed', 'failed');
    this.scene.restart();
  }
};
