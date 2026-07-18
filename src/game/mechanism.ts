// @ts-nocheck
import Phaser from 'phaser';
import { FLOOR_Y, WORLD_WIDTH } from './ui';
export const mechanismMethods = {
  createMechanism() {
    const support = this.add.graphics().setDepth(1);
    support.fillStyle(0x272b2d, 1);
    support.fillRect(54, 420, 36, 370);
    support.fillRect(420, 420, 36, 370);
    support.fillRect(48, 762, 420, 28);
    support.lineStyle(16, 0x34393b, 1);
    support.beginPath();
    support.moveTo(80, 470); support.lineTo(425, 750);
    support.moveTo(425, 470); support.lineTo(80, 750);
    support.strokePath();

    this.addStaticPlank(265, 330, 450, 48, 20);
    this.matter.add.rectangle(800, FLOOR_Y + 10, WORLD_WIDTH, 42, { isStatic: true, label: 'floor', friction: .9 });

    this.ball1 = this.matter.add.image(122, 235, 'steel-ball');
    this.ball1.setCircle(32).setFriction(.008).setFrictionStatic(.25).setBounce(.04).setMass(4.4).setStatic(true);
    this.ball1.body.label = 'ball1';
    this.ball1.setDepth(8);

    this.pulleyLeft = this.add.image(535, 180, 'pulley').setDepth(7).setScale(.82);
    this.pulleyRight = this.add.image(665, 180, 'pulley').setDepth(7).setScale(.82);
    support.fillStyle(0x282d2f, 1);
    support.fillRect(510, 104, 50, 52);
    support.fillRect(640, 104, 50, 52);

    this.bucketBody = this.matter.add.rectangle(this.bucketX, this.bucketStartY, 98, 18, {
      label: 'bucket-bottom',
      friction: .95,
      frictionStatic: 1,
      restitution: 0
    });
    Phaser.Physics.Matter.Matter.Body.setMass(this.bucketBody, 2.6);
    Phaser.Physics.Matter.Matter.Body.setStatic(this.bucketBody, true);
    this.bucketSprite = this.add.image(this.bucketX, this.bucketStartY - 55, 'bucket').setDepth(6);

    this.drawGateFrame(support);
    this.gate = this.matter.add.image(this.gateX, this.gateStartY, 'gate');
    this.gate.setRectangle(82, 190).setFriction(.9).setMass(5.1).setStatic(true).setDepth(6);
    this.gate.body.label = 'gate';

    this.ball2 = this.matter.add.image(733, 392, 'steel-ball-small');
    this.ball2.setCircle(25).setFriction(.01).setBounce(.04).setMass(3.2).setStatic(true).setDepth(8);
    this.ball2.body.label = 'ball2';

    this.addStaticPlank(815, 520, 205, 34, 26);

    this.drawLeverStand(support);
    this.lever = this.matter.add.image(990, 620, 'lever');
    this.lever.setRectangle(490, 38).setFriction(.8).setMass(7.5).setStatic(true).setDepth(5);
    this.lever.body.label = 'lever';
    this.leverConstraint = this.matter.add.worldConstraint(this.lever.body, 0, 1, {
      pointA: { x: 990, y: 620 },
      pointB: { x: 0, y: 0 },
      damping: .18
    });

    this.drawLatch(support);
    this.createHammer();
    this.drawBell(support);

    this.ropeGraphics = this.add.graphics().setDepth(4);
    this.guideGhost = this.add.image(500, 433, 'wood-plank').setDisplaySize(250, 36).setAngle(22).setAlpha(.18).setDepth(2);
    this.guideGhost.setTint(0xffcf86);
    this.weightGhost = this.add.image(915, 578, 'counterweight').setScale(.75).setAlpha(.15).setDepth(7);
  }
,
  drawGateFrame(graphics) {
    graphics.fillStyle(0x24292b, 1);
    graphics.fillRect(670, 285, 26, 340);
    graphics.fillRect(766, 285, 26, 340);
    graphics.fillRect(650, 610, 162, 26);
    graphics.fillStyle(0x6e4829, 1);
    graphics.fillRect(660, 295, 142, 28);
    graphics.fillStyle(0x9ca2a4, 1);
    for (const x of [681, 779]) {
      for (const y of [310, 600]) graphics.fillCircle(x, y, 6);
    }
  }
,
  drawLeverStand(graphics) {
    graphics.fillStyle(0x262a2c, 1);
    graphics.fillTriangle(930, 740, 1050, 740, 990, 610);
    graphics.fillRect(900, 730, 180, 35);
    graphics.fillStyle(0x8b9294, 1);
    graphics.fillCircle(990, 620, 23);
    graphics.fillStyle(0x222729, 1);
    graphics.fillCircle(990, 620, 13);
  }
,
  drawLatch(graphics) {
    graphics.fillStyle(0x2a2f31, 1);
    graphics.fillRect(1168, 480, 32, 280);
    graphics.fillRect(1140, 735, 90, 28);
    graphics.fillStyle(0xa8432d, 1);
    graphics.fillRoundedRect(1161, 462, 46, 26, 8);
    graphics.fillStyle(0xb9bdbe, 1);
    graphics.fillCircle(1184, 620, 18);
  }
,
  createHammer() {
    this.hammerPivot = new Phaser.Math.Vector2(1290, 315);
    this.hammerInitialAngle = Phaser.Math.DegToRad(37);
    const armOffset = 150;
    const centerX = this.hammerPivot.x - Math.sin(this.hammerInitialAngle) * armOffset;
    const centerY = this.hammerPivot.y + Math.cos(this.hammerInitialAngle) * armOffset;
    this.hammer = this.matter.add.image(centerX, centerY, 'hammer');
    this.hammer.setRectangle(72, 300).setAngle(37).setMass(8.2).setFrictionAir(.004).setStatic(true).setDepth(7);
    this.hammer.body.label = 'hammer';
    this.hammerConstraint = this.matter.add.worldConstraint(this.hammer.body, 0, 1, {
      pointA: { x: this.hammerPivot.x, y: this.hammerPivot.y },
      pointB: { x: 0, y: -150 },
      damping: .003
    });
  }
,
  drawBell(graphics) {
    graphics.fillStyle(0x6e4324, 1);
    graphics.fillRect(1420, 405, 24, 365);
    graphics.fillRect(1550, 405, 24, 365);
    graphics.fillRect(1400, 395, 194, 28);
    graphics.fillRect(1385, 755, 225, 28);
    graphics.fillStyle(0x24292b, 1);
    graphics.fillRect(1410, 412, 22, 22);
    graphics.fillRect(1562, 412, 22, 22);
    const bell = this.add.graphics().setDepth(5);
    bell.fillStyle(0xc58a28, 1);
    bell.fillCircle(1497, 478, 19);
    bell.fillStyle(0xe1a93e, 1);
    bell.fillEllipse(1497, 530, 96, 100);
    bell.fillStyle(0x8b5a17, 1);
    bell.fillEllipse(1497, 568, 112, 28);
    bell.fillStyle(0xd7952d, 1);
    bell.fillCircle(1497, 587, 15);
    bell.lineStyle(5, 0x69400f, 1);
    bell.strokeEllipse(1497, 530, 96, 100);
    this.bellPoint = new Phaser.Math.Vector2(1457, 548);
  }
,
  addStaticPlank(x, y, width, height, angleDegrees) {
    this.add.image(x, y, 'wood-plank').setDisplaySize(width, height).setAngle(angleDegrees).setDepth(3);
    this.matter.add.rectangle(x, y, width, height - 8, {
      isStatic: true,
      angle: Phaser.Math.DegToRad(angleDegrees),
      friction: .7,
      frictionStatic: .9,
      restitution: .02,
      label: 'fixed-plank'
    });
  }

};
