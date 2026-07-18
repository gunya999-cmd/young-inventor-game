// @ts-nocheck
import Phaser from 'phaser';
import { app, partButtons, clamp, completeHud, ringBell, setObjective, setPartState, setStatus, setTimer, startSimulationHud } from './ui';
export const gameplayMethods = {
  createBuildInput() {
    this.input.on('drag', (_pointer, gameObject, dragX, dragY) => {
      if (this.running || this.completed) return;
      if (gameObject === this.guide) {
        const x = clamp(dragX, 420, 620);
        const y = clamp(dragY, 360, 520);
        gameObject.setPosition(x, y);
        Phaser.Physics.Matter.Matter.Body.setPosition(gameObject.body, { x, y });
        this.selectPart('guide');
      }
      if (gameObject === this.weightSprite) {
        this.weightOffset = clamp(dragX - this.lever.x, -155, 165);
        this.updateWeightVisual();
        this.selectPart('weight');
      }
    });
  }
,
  selectPart(part) {
    this.selectedPart = part;
    partButtons.forEach((button) => button.classList.toggle('selected', button.dataset.part === part));
  }
,
  addGuide() {
    if (this.running || this.guidePlaced) return;
    this.guidePlaced = true;
    this.guideGhost.setVisible(false);
    this.guide = this.matter.add.image(505, 435, 'wood-plank');
    this.guide.setDisplaySize(250, 36).setRectangle(250, 28).setStatic(true).setAngle(this.guideAngle).setFriction(.72).setDepth(5);
    this.guide.body.label = 'player-guide';
    this.guide.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.guide);
    setPartState('guide', true, true);
    this.selectPart('guide');
    this.updateBuildObjective();
    setStatus('Перетащи направляющую и подбери угол, чтобы шар попал в ведро.');
  }
,
  connectRope() {
    if (this.running || this.ropeConnected) return;
    this.ropeConnected = true;
    setPartState('rope', true, true);
    this.selectPart('rope');
    this.updateBuildObjective();
    this.drawRope();
    setStatus('Верёвка соединяет ведро и заслонку через два неподвижных блока.');
  }
,
  addWeight() {
    if (this.running || this.weightAdded) return;
    this.weightAdded = true;
    this.weightGhost.setVisible(false);
    this.weightSprite = this.add.image(0, 0, 'counterweight').setScale(.82).setDepth(8);
    this.weightSprite.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(this.weightSprite);
    this.updateWeightVisual();
    setPartState('weight', true, true);
    this.selectPart('weight');
    this.updateBuildObjective();
    setStatus('Перемести груз на левое плечо, чтобы усилить момент падающего шара.');
  }
,
  updateBuildObjective() {
    const installed = Number(this.guidePlaced) + Number(this.ropeConnected) + Number(this.weightAdded);
    setObjective(installed === 3 ? 'Можно запускать механизм' : `Установлено ${installed} из 3 деталей`);
  }
,
  rotateGuide(direction) {
    if (this.running || !this.guidePlaced || this.selectedPart !== 'guide') return;
    this.guideAngle = clamp(this.guideAngle + direction * 3, 5, 38);
    this.guide.setAngle(this.guideAngle);
    Phaser.Physics.Matter.Matter.Body.setAngle(this.guide.body, Phaser.Math.DegToRad(this.guideAngle));
  }
,
  applyHint() {
    if (this.running) return;
    if (!this.guidePlaced) this.addGuide();
    if (!this.ropeConnected) this.connectRope();
    if (!this.weightAdded) this.addWeight();
    this.guideAngle = 23;
    this.guide.setPosition(510, 430).setAngle(this.guideAngle);
    Phaser.Physics.Matter.Matter.Body.setPosition(this.guide.body, { x: 510, y: 430 });
    Phaser.Physics.Matter.Matter.Body.setAngle(this.guide.body, Phaser.Math.DegToRad(this.guideAngle));
    this.weightOffset = -95;
    this.updateWeightVisual();
    this.selectPart('guide');
    setStatus('Подсказка установила рабочую конфигурацию. Нажми «Пуск».');
  }
,
  startSimulation() {
    if (this.running || this.completed) return;
    this.running = true;
    this.elapsed = 0;
    startSimulationHud();
    this.selectPart(null);

    Phaser.Physics.Matter.Matter.Body.setStatic(this.ball1.body, false);
    Phaser.Physics.Matter.Matter.Body.setVelocity(this.ball1.body, { x: .2, y: 0 });
    Phaser.Physics.Matter.Matter.Body.setStatic(this.lever.body, false);

    if (this.ropeConnected) {
      Phaser.Physics.Matter.Matter.Body.setStatic(this.bucketBody, false);
      Phaser.Physics.Matter.Matter.Body.setStatic(this.gate.body, false);
    }

    setStatus('Симуляция запущена. Детали больше нельзя перемещать.');
  }
,
  update(_time, delta) {
    this.syncVisuals();
    if (!this.running || this.completed) return;

    this.elapsed += Math.min(delta, 34) / 1000;
    setTimer(this.elapsed);

    this.enforceVerticalGuide(this.bucketBody, this.bucketX, 470, 645);
    this.enforceVerticalGuide(this.gate.body, this.gateX, 345, 545);

    if (this.ropeConnected) this.solvePulleyConstraint();
    this.limitLever();
    this.applyCounterweightForce();

    if (!this.secondReleased && this.gate.body.position.y < 403) this.releaseSecondBall();
    if (!this.hammerReleased && this.secondReleased && this.lever.body.angle < -.115) this.releaseHammer();
    if (this.hammerReleased) this.checkBellStrike();

    if (this.elapsed > 15 && !this.completed) {
      setStatus('Цепочка остановилась. Нажми сброс и измени положение деталей.');
    }
  }
,
  syncVisuals() {
    if (this.bucketBody && this.bucketSprite) {
      this.bucketSprite.setPosition(this.bucketBody.position.x, this.bucketBody.position.y - 55);
    }
    if (this.ropeConnected) this.drawRope();
    if (this.weightAdded) this.updateWeightVisual();
  }
,
  enforceVerticalGuide(body, x, minY, maxY) {
    if (body.isStatic) return;
    const y = clamp(body.position.y, minY, maxY);
    Phaser.Physics.Matter.Matter.Body.setPosition(body, { x, y });
    Phaser.Physics.Matter.Matter.Body.setVelocity(body, { x: 0, y: body.velocity.y });
    Phaser.Physics.Matter.Matter.Body.setAngle(body, 0);
    Phaser.Physics.Matter.Matter.Body.setAngularVelocity(body, 0);
  }
,
  solvePulleyConstraint() {
    const bucket = this.bucketBody;
    const gate = this.gate.body;
    if (bucket.isStatic || gate.isStatic) return;

    const inverseBucket = 1 / Math.max(bucket.mass, .001);
    const inverseGate = 1 / Math.max(gate.mass, .001);
    const inverseSum = inverseBucket + inverseGate;

    const velocityError = bucket.velocity.y + gate.velocity.y;
    const velocityImpulse = -velocityError / inverseSum;
    Phaser.Physics.Matter.Matter.Body.setVelocity(bucket, { x: 0, y: bucket.velocity.y + velocityImpulse * inverseBucket });
    Phaser.Physics.Matter.Matter.Body.setVelocity(gate, { x: 0, y: gate.velocity.y + velocityImpulse * inverseGate });

    const positionError = bucket.position.y + gate.position.y - this.ropeLength;
    const positionImpulse = (-positionError / inverseSum) * .42;
    Phaser.Physics.Matter.Matter.Body.setPosition(bucket, { x: this.bucketX, y: bucket.position.y + positionImpulse * inverseBucket });
    Phaser.Physics.Matter.Matter.Body.setPosition(gate, { x: this.gateX, y: gate.position.y + positionImpulse * inverseGate });
  }
,
  limitLever() {
    if (this.lever.body.isStatic) return;
    const minimum = -.34;
    const maximum = .12;
    if (this.lever.body.angle < minimum) {
      Phaser.Physics.Matter.Matter.Body.setAngle(this.lever.body, minimum);
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.lever.body, Math.max(0, this.lever.body.angularVelocity));
    }
    if (this.lever.body.angle > maximum) {
      Phaser.Physics.Matter.Matter.Body.setAngle(this.lever.body, maximum);
      Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.lever.body, Math.min(0, this.lever.body.angularVelocity));
    }
  }
,
  applyCounterweightForce() {
    if (!this.running || this.lever.body.isStatic) return;
    const latchPoint = this.getLeverPoint(180, -10);
    Phaser.Physics.Matter.Matter.Body.applyForce(this.lever.body, latchPoint, { x: 0, y: .0022 });
    if (this.weightAdded) {
      const weightPoint = this.getLeverPoint(this.weightOffset, -28);
      Phaser.Physics.Matter.Matter.Body.applyForce(this.lever.body, weightPoint, { x: 0, y: .0024 });
    }
  }
,
  getLeverPoint(localX, localY = 0) {
    const angle = this.lever.body.angle;
    return {
      x: this.lever.body.position.x + Math.cos(angle) * localX - Math.sin(angle) * localY,
      y: this.lever.body.position.y + Math.sin(angle) * localX + Math.cos(angle) * localY
    };
  }
,
  updateWeightVisual() {
    if (!this.weightSprite) return;
    const point = this.getLeverPoint(this.weightOffset, -48);
    this.weightSprite.setPosition(point.x, point.y).setRotation(this.lever.body.angle);
  }
,
  drawRope() {
    if (!this.ropeGraphics) return;
    this.ropeGraphics.clear();
    this.ropeGraphics.lineStyle(8, 0x6f4824, 1);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(this.bucketBody.position.x, this.bucketBody.position.y - 105);
    this.ropeGraphics.lineTo(535, 180);
    this.ropeGraphics.lineTo(665, 180);
    this.ropeGraphics.lineTo(this.gate.body.position.x, this.gate.body.position.y - 108);
    this.ropeGraphics.strokePath();
    this.ropeGraphics.lineStyle(3, 0xd6a763, .82);
    this.ropeGraphics.beginPath();
    this.ropeGraphics.moveTo(this.bucketBody.position.x + 2, this.bucketBody.position.y - 105);
    this.ropeGraphics.lineTo(537, 181);
    this.ropeGraphics.lineTo(663, 181);
    this.ropeGraphics.lineTo(this.gate.body.position.x - 2, this.gate.body.position.y - 108);
    this.ropeGraphics.strokePath();
    const travel = this.bucketBody.position.y - this.bucketStartY;
    this.pulleyLeft.setAngle(travel * 1.5);
    this.pulleyRight.setAngle(-travel * 1.5);
  }
,
  handleCollision(event) {
    if (!this.running || this.ballCaught) return;
    for (const pair of event.pairs) {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      if (!labels.includes('ball1') || !labels.includes('bucket-bottom')) continue;
      this.ballCaught = true;
      const combinedVelocity = (this.ball1.body.velocity.y + this.bucketBody.velocity.y) * .42;
      Phaser.Physics.Matter.Matter.Body.setVelocity(this.ball1.body, { x: 0, y: combinedVelocity });
      this.ballCatchConstraint = this.matter.add.constraint(this.bucketBody, this.ball1.body, 34, .82, {
        pointA: { x: 0, y: -14 },
        pointB: { x: 0, y: 0 },
        damping: .24
      });
      setStatus('Первый шар попал в ведро. Его вес опускает ведро и поднимает заслонку.');
      break;
    }
  }
,
  releaseSecondBall() {
    this.secondReleased = true;
    Phaser.Physics.Matter.Matter.Body.setStatic(this.ball2.body, false);
    Phaser.Physics.Matter.Matter.Body.setVelocity(this.ball2.body, { x: 1.8, y: 0 });
    setStatus('Заслонка поднялась: второй шар направляется к рычагу.');
  }
,
  releaseHammer() {
    this.hammerReleased = true;
    Phaser.Physics.Matter.Matter.Body.setStatic(this.hammer.body, false);
    Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.hammer.body, -.012);
    setStatus('Рычаг поднял стопор. Маятниковый молоток освобождён.');
  }
,
  checkBellStrike() {
    const angle = this.hammer.body.angle;
    const headDistance = 147;
    const head = {
      x: this.hammer.body.position.x - Math.sin(angle) * headDistance,
      y: this.hammer.body.position.y + Math.cos(angle) * headDistance
    };
    const distance = Phaser.Math.Distance.Between(head.x, head.y, this.bellPoint.x, this.bellPoint.y);
    if (distance < 64 && Math.abs(this.hammer.body.angularVelocity) > .055) this.finishLevel();
  }
,
  finishLevel() {
    if (this.completed) return;
    this.completed = true;
    this.running = false;
    Phaser.Physics.Matter.Matter.Body.setAngularVelocity(this.hammer.body, 0);
    ringBell();
    completeHud(this.elapsed);
  }

};
