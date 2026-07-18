// @ts-nocheck
import Phaser from 'phaser';
import { FLOOR_Y, WORLD_WIDTH } from './ui';

export const mechanismMethods = {
  createMechanism() {
    const support = this.add.graphics().setDepth(1);
    this.drawLeftSupport(support);

    this.addStaticPlank(255, 300, 370, 52, 20);
    this.matter.add.rectangle(WORLD_WIDTH / 2, FLOOR_Y + 11, WORLD_WIDTH, 44, {
      isStatic: true,
      label: 'floor',
      friction: .92,
      frictionStatic: 1
    });

    this.ball1 = this.matter.add.image(108, 211, 'steel-ball-v2');
    this.ball1.setCircle(33).setFriction(.008).setFrictionStatic(.3).setBounce(.025).setMass(4.6).setStatic(true);
    this.ball1.body.label = 'ball1';
    this.ball1.setDepth(9);

    this.pulleyLeft = this.add.image(555, 168, 'pulley-v2').setDepth(8).setScale(.78);
    this.pulleyRight = this.add.image(710, 168, 'pulley-v2').setDepth(8).setScale(.78);
    this.drawPulleyBrackets(support);

    this.createBucket();
    this.drawGateFrame(support);

    this.gate = this.matter.add.image(this.gateX, this.gateStartY, 'gate-v2');
    this.gate.setRectangle(68, 174).setFriction(.9).setMass(3.8).setStatic(true).setDepth(7);
    this.gate.body.label = 'gate';

    this.addStaticPlank(712, 370, 132, 30, 0);
    this.ball2 = this.matter.add.image(710, 329, 'steel-ball-small-v2');
    this.ball2.setCircle(27).setFriction(.008).setBounce(.02).setMass(3.4).setStatic(true).setDepth(9);
    this.ball2.body.label = 'ball2';

    this.addStaticPlank(850, 445, 215, 34, 24);
    this.addStaticPlank(948, 530, 150, 32, 22);

    this.drawLeverStand(support);
    this.lever = this.matter.add.image(1035, 615, 'lever-v2');
    this.lever.setRectangle(410, 36).setFriction(.82).setMass(7.6).setFrictionAir(.035).setStatic(true).setDepth(6);
    this.lever.body.label = 'lever';
    this.leverConstraint = this.matter.add.worldConstraint(this.lever.body, 0, 1, {
      pointA: { x: 1035, y: 615 },
      pointB: { x: 0, y: 0 },
      damping: .24
    });

    this.drawLatch(support);
    this.linkGraphics = this.add.graphics().setDepth(5);
    this.createHammer();
    this.drawBellStand(support);
    this.bell = this.add.image(1472, 555, 'bell-v2').setDepth(7);
    this.bellPoint = new Phaser.Math.Vector2(1417, 570);

    this.ropeGraphics = this.add.graphics().setDepth(5);
    this.guideGhost = this.add.image(500, 410, 'wood-plank-v2').setDisplaySize(235, 38).setAngle(18).setAlpha(.16).setDepth(3);
    this.guideGhost.setTint(0xffcf88);
    this.weightGhost = this.add.image(1105, 566, 'counterweight-v2').setScale(.76).setAlpha(.13).setDepth(8);

    this.guideTarget = this.add.graphics().setDepth(2);
    this.guideTarget.lineStyle(3, 0xf3b85f, .22);
    this.guideTarget.strokeRoundedRect(386, 355, 235, 118, 14);
  },

  drawLeftSupport(graphics) {
    graphics.fillStyle(0x24292b, 1);
    graphics.fillRect(48, 410, 34, 342);
    graphics.fillRect(392, 410, 34, 342);
    graphics.fillRect(42, 724, 410, 30);
    graphics.fillStyle(0x4f5557, 1);
    graphics.fillRect(54, 416, 8, 330);
    graphics.fillRect(398, 416, 8, 330);
    graphics.lineStyle(15, 0x343a3d, 1);
    graphics.beginPath();
    graphics.moveTo(72, 454); graphics.lineTo(398, 724);
    graphics.moveTo(398, 454); graphics.lineTo(72, 724);
    graphics.strokePath();
    graphics.lineStyle(4, 0x111517, 1);
    graphics.strokeRect(48, 410, 378, 344);
    graphics.fillStyle(0x9ca3a5, 1);
    for (const x of [65, 409]) for (const y of [430, 730]) graphics.fillCircle(x, y, 6);
  },

  drawPulleyBrackets(graphics) {
    graphics.fillStyle(0x262b2d, 1);
    graphics.fillRect(530, 92, 50, 50);
    graphics.fillRect(685, 92, 50, 50);
    graphics.fillStyle(0x5b6062, 1);
    graphics.fillRect(537, 97, 7, 40);
    graphics.fillRect(692, 97, 7, 40);
    graphics.fillStyle(0x9ca3a5, 1);
    graphics.fillCircle(555, 112, 5);
    graphics.fillCircle(710, 112, 5);
  },

  createBucket() {
    this.bucketBody = this.matter.add.rectangle(this.bucketX, this.bucketStartY, 92, 18, {
      label: 'bucket-bottom',
      friction: .95,
      frictionStatic: 1,
      restitution: 0
    });
    Phaser.Physics.Matter.Matter.Body.setMass(this.bucketBody, 2.45);
    Phaser.Physics.Matter.Matter.Body.setStatic(this.bucketBody, true);

    this.bucketLeftWall = this.matter.add.rectangle(this.bucketX - 45, this.bucketStartY - 43, 14, 88, {
      isStatic: true,
      angle: -.11,
      label: 'bucket-wall'
    });
    this.bucketRightWall = this.matter.add.rectangle(this.bucketX + 45, this.bucketStartY - 43, 14, 88, {
      isStatic: true,
      angle: .11,
      label: 'bucket-wall'
    });
    this.bucketSensor = this.matter.add.rectangle(this.bucketX, this.bucketStartY - 48, 74, 62, {
      isStatic: true,
      isSensor: true,
      label: 'bucket-sensor'
    });
    this.bucketSprite = this.add.image(this.bucketX, this.bucketStartY - 60, 'bucket-v2').setDepth(7);
  },

  drawGateFrame(graphics) {
    graphics.fillStyle(0x24292b, 1);
    graphics.fillRect(700, 285, 25, 340);
    graphics.fillRect(798, 285, 25, 340);
    graphics.fillRect(680, 608, 163, 27);
    graphics.fillStyle(0x555b5d, 1);
    graphics.fillRect(706, 292, 6, 327);
    graphics.fillRect(804, 292, 6, 327);
    graphics.fillStyle(0x754a29, 1);
    graphics.fillRect(690, 294, 143, 28);
    graphics.fillStyle(0x9ca2a4, 1);
    for (const x of [712, 811]) for (const y of [307, 612]) graphics.fillCircle(x, y, 6);
  },

  drawLeverStand(graphics) {
    graphics.fillStyle(0x252a2c, 1);
    graphics.fillTriangle(974, 732, 1096, 732, 1035, 606);
    graphics.fillRect(944, 723, 182, 34);
    graphics.fillStyle(0x555c5e, 1);
    graphics.fillTriangle(995, 711, 1075, 711, 1035, 626);
    this.add.image(1035, 615, 'bearing-v2').setDepth(8).setScale(.82);
  },

  drawLatch(graphics) {
    graphics.fillStyle(0x252a2c, 1);
    graphics.fillRect(1215, 440, 31, 315);
    graphics.fillRect(1184, 728, 92, 29);
    graphics.fillStyle(0x555b5d, 1);
    graphics.fillRect(1221, 447, 7, 296);
    graphics.fillStyle(0xb04431, 1);
    graphics.fillRoundedRect(1197, 508, 54, 28, 8);
    graphics.fillStyle(0xf07358, 1);
    graphics.fillRoundedRect(1202, 512, 44, 7, 4);
    graphics.fillStyle(0xadb3b4, 1);
    graphics.fillCircle(1230, 614, 17);
    graphics.fillStyle(0x292f31, 1);
    graphics.fillCircle(1230, 614, 9);
    this.latchPin = this.add.image(1215, 520, 'counterweight-v2').setDisplaySize(26, 52).setDepth(7).setAngle(90);
  },

  createHammer() {
    this.hammerPivot = new Phaser.Math.Vector2(1325, 300);
    this.hammerInitialAngle = Phaser.Math.DegToRad(43);
    const centerDistance = 150;
    const centerX = this.hammerPivot.x - Math.sin(this.hammerInitialAngle) * centerDistance;
    const centerY = this.hammerPivot.y + Math.cos(this.hammerInitialAngle) * centerDistance;
    this.hammer = this.matter.add.image(centerX, centerY, 'hammer-v2');
    this.hammer.setRectangle(82, 300).setAngle(43).setMass(8.5).setFrictionAir(.004).setStatic(true).setDepth(8);
    this.hammer.body.label = 'hammer';
    this.hammerConstraint = this.matter.add.worldConstraint(this.hammer.body, 0, 1, {
      pointA: { x: this.hammerPivot.x, y: this.hammerPivot.y },
      pointB: { x: 0, y: -150 },
      damping: .004
    });
    this.add.image(this.hammerPivot.x, this.hammerPivot.y, 'bearing-v2').setDepth(9).setScale(.72);
  },

  drawBellStand(graphics) {
    graphics.fillStyle(0x684020, 1);
    graphics.fillRect(1385, 386, 24, 371);
    graphics.fillRect(1552, 386, 24, 371);
    graphics.fillRect(1370, 375, 220, 29);
    graphics.fillRect(1358, 735, 245, 31);
    graphics.fillStyle(0x9a6537, 1);
    graphics.fillRect(1391, 392, 7, 353);
    graphics.fillRect(1558, 392, 7, 353);
    graphics.fillStyle(0x292e30, 1);
    graphics.fillRect(1380, 385, 30, 25);
    graphics.fillRect(1552, 385, 30, 25);
    graphics.fillStyle(0xaeb4b5, 1);
    graphics.fillCircle(1395, 397, 5);
    graphics.fillCircle(1567, 397, 5);
  },

  addStaticPlank(x, y, width, height, angleDegrees) {
    this.add.image(x, y, 'wood-plank-v2').setDisplaySize(width, height).setAngle(angleDegrees).setDepth(4);
    this.matter.add.rectangle(x, y, width, Math.max(18, height - 12), {
      isStatic: true,
      angle: Phaser.Math.DegToRad(angleDegrees),
      friction: .74,
      frictionStatic: .94,
      restitution: .01,
      label: 'fixed-plank'
    });
  }
};
