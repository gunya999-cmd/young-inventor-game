import Phaser from 'phaser';
import './style.css';

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 780;
const BRIDGE_WIDTH = 250;
const BRIDGE_HEIGHT = 38;
const SNAP_TARGET = { x: 785, y: 394, rotation: Phaser.Math.DegToRad(12) };

type GameMode = 'build' | 'running' | 'success';

interface GameApi {
  run: () => void;
  reset: () => void;
  toggleHint: () => void;
}

declare global {
  interface Window {
    youngInventorGame?: GameApi;
  }
}

class WorkshopScene extends Phaser.Scene {
  private bridge!: Phaser.GameObjects.Image;
  private bridgeShadow!: Phaser.GameObjects.Ellipse;
  private bridgeHandle!: Phaser.GameObjects.Arc;
  private bridgeHandleLine!: Phaser.GameObjects.Line;
  private ball?: Phaser.Physics.Matter.Image;
  private bridgeBody?: MatterJS.BodyType;
  private receiverGlow!: Phaser.GameObjects.Arc;
  private robotEyes: Phaser.GameObjects.Arc[] = [];
  private hintGroup!: Phaser.GameObjects.Container;
  private snapZone!: Phaser.GameObjects.Arc;
  private mode: GameMode = 'build';
  private dragging = false;
  private rotating = false;
  private dragOffset = new Phaser.Math.Vector2();
  private runTimeout?: number;
  private startBall = { x: 285, y: 244 };

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.createTextures();
    this.createRoom();
    this.createMachine();
    this.createInteraction();
    this.createCollisions();
    this.createKeyboard();
    this.updateHandle();
    this.runDevGeometryChecks();

    window.youngInventorGame = {
      run: () => this.runSimulation(),
      reset: () => this.fullReset(),
      toggleHint: () => this.toggleHint()
    };
  }

  update(): void {
    if (!this.ball || this.mode !== 'running') return;
    if (this.ball.y > WORLD_HEIGHT + 100 || this.ball.x > WORLD_WIDTH + 100 || this.ball.x < -100) {
      this.failAttempt('Пластина почти на месте. Попробуй немного изменить угол.');
    }
  }

  private createTextures(): void {
    this.makeRailTexture('rail-blue', 410, 44, '#3f8ce7', '#1f5fb6');
    this.makeRailTexture('bridge-red', BRIDGE_WIDTH, 48, '#ff6a61', '#d72f31');
    this.makeBallTexture();
    this.makeReceiverTexture();
    this.makeRobotTexture();
  }

  private makeRailTexture(key: string, width: number, height: number, top: string, bottom: string): void {
    const texture = this.textures.createCanvas(key, width, height);
    const context = texture?.getContext();
    if (!texture || !context) return;

    context.clearRect(0, 0, width, height);
    context.shadowColor = 'rgba(23, 35, 51, 0.28)';
    context.shadowBlur = 12;
    context.shadowOffsetY = 7;
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, top);
    gradient.addColorStop(0.5, top);
    gradient.addColorStop(1, bottom);
    this.roundedRect(context, 7, 4, width - 14, height - 13, 13);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = 'transparent';

    const gloss = context.createLinearGradient(0, 4, 0, 22);
    gloss.addColorStop(0, 'rgba(255,255,255,.66)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    this.roundedRect(context, 13, 8, width - 26, 14, 8);
    context.fillStyle = gloss;
    context.fill();

    const studCount = Math.max(3, Math.floor(width / 54));
    for (let index = 0; index < studCount; index += 1) {
      const x = 28 + index * ((width - 56) / Math.max(1, studCount - 1));
      const stud = context.createRadialGradient(x - 2, 16, 1, x, 18, 7);
      stud.addColorStop(0, 'rgba(255,255,255,.86)');
      stud.addColorStop(0.45, 'rgba(255,255,255,.38)');
      stud.addColorStop(1, 'rgba(0,0,0,.15)');
      context.beginPath();
      context.arc(x, 18, 6.2, 0, Math.PI * 2);
      context.fillStyle = stud;
      context.fill();
    }
    texture.refresh();
  }

  private makeBallTexture(): void {
    const size = 76;
    const texture = this.textures.createCanvas('energy-ball', size, size);
    const context = texture?.getContext();
    if (!texture || !context) return;
    context.shadowColor = 'rgba(20, 85, 162, .45)';
    context.shadowBlur = 13;
    context.shadowOffsetY = 7;
    const gradient = context.createRadialGradient(24, 18, 4, 38, 38, 34);
    gradient.addColorStop(0, '#d9f8ff');
    gradient.addColorStop(0.18, '#78d6ff');
    gradient.addColorStop(0.55, '#2489dc');
    gradient.addColorStop(1, '#0b438e');
    context.beginPath();
    context.arc(38, 34, 30, 0, Math.PI * 2);
    context.fillStyle = gradient;
    context.fill();
    context.shadowColor = 'transparent';
    context.strokeStyle = 'rgba(255,255,255,.78)';
    context.lineWidth = 2;
    context.stroke();
    texture.refresh();
  }

  private makeReceiverTexture(): void {
    const texture = this.textures.createCanvas('receiver', 184, 196);
    const context = texture?.getContext();
    if (!texture || !context) return;
    context.shadowColor = 'rgba(35,48,66,.28)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 10;
    const shell = context.createLinearGradient(0, 0, 0, 196);
    shell.addColorStop(0, '#f8fbff');
    shell.addColorStop(1, '#b8c6d5');
    this.roundedRect(context, 20, 22, 144, 154, 42);
    context.fillStyle = shell;
    context.fill();
    context.shadowColor = 'transparent';
    context.lineWidth = 7;
    context.strokeStyle = '#31445f';
    context.stroke();
    const ring = context.createRadialGradient(91, 91, 20, 91, 91, 61);
    ring.addColorStop(0, '#0d2540');
    ring.addColorStop(0.55, '#183b64');
    ring.addColorStop(0.71, '#58c9ff');
    ring.addColorStop(0.82, '#d9f7ff');
    ring.addColorStop(1, '#3b506a');
    context.beginPath();
    context.arc(92, 91, 61, 0, Math.PI * 2);
    context.fillStyle = ring;
    context.fill();
    context.fillStyle = '#10243f';
    context.beginPath();
    context.arc(92, 91, 41, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8ba0b4';
    this.roundedRect(context, 62, 151, 60, 14, 7);
    context.fill();
    texture.refresh();
  }

  private makeRobotTexture(): void {
    const texture = this.textures.createCanvas('robot', 176, 226);
    const context = texture?.getContext();
    if (!texture || !context) return;
    context.shadowColor = 'rgba(37,47,65,.24)';
    context.shadowBlur = 16;
    context.shadowOffsetY = 10;
    const metal = context.createLinearGradient(0, 0, 176, 226);
    metal.addColorStop(0, '#ffffff');
    metal.addColorStop(.48, '#dde5ed');
    metal.addColorStop(1, '#aab9c8');
    this.roundedRect(context, 27, 28, 122, 92, 31);
    context.fillStyle = metal;
    context.fill();
    context.shadowColor = 'transparent';
    context.lineWidth = 7;
    context.strokeStyle = '#2d405c';
    context.stroke();
    context.fillStyle = '#263a58';
    this.roundedRect(context, 48, 50, 80, 47, 17);
    context.fill();
    this.roundedRect(context, 43, 130, 90, 69, 22);
    context.fillStyle = metal;
    context.fill();
    context.strokeStyle = '#2d405c';
    context.lineWidth = 7;
    context.stroke();
    context.fillStyle = '#6379d6';
    this.roundedRect(context, 57, 147, 62, 31, 12);
    context.fill();
    context.fillStyle = '#2d405c';
    context.fillRect(18, 143, 29, 18);
    context.fillRect(129, 143, 29, 18);
    context.fillRect(50, 193, 24, 25);
    context.fillRect(102, 193, 24, 25);
    texture.refresh();
  }

  private roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + width, y, x + width, y + height, r);
    context.arcTo(x + width, y + height, x, y + height, r);
    context.arcTo(x, y + height, x, y, r);
    context.arcTo(x, y, x + width, y, r);
    context.closePath();
  }

  private createRoom(): void {
    this.add.rectangle(800, 390, WORLD_WIDTH, WORLD_HEIGHT, 0xf1e5cf);

    const wallShade = this.add.graphics();
    wallShade.fillGradientStyle(0xfffbf2, 0xf4ead8, 0xe3cfad, 0xd5bb91, 1);
    wallShade.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT - 95);

    for (let x = 0; x <= WORLD_WIDTH; x += 64) {
      this.add.line(0, 0, x, 84, x, WORLD_HEIGHT - 98, 0xbda984, 0.12).setOrigin(0);
    }
    for (let y = 84; y <= WORLD_HEIGHT - 96; y += 64) {
      this.add.line(0, 0, 0, y, WORLD_WIDTH, y, 0xbda984, 0.12).setOrigin(0);
    }

    this.createWindow();
    this.createShelves();
    this.createDeskAndFloor();
    this.createDecor();
  }

  private createWindow(): void {
    const frame = this.add.rectangle(177, 199, 244, 265, 0xf8f3e8).setStrokeStyle(13, 0xd7b788);
    const sky = this.add.graphics();
    sky.fillGradientStyle(0xc8efff, 0xdff7ff, 0xa8d69c, 0x7aae70, 1);
    sky.fillRect(69, 75, 216, 238);
    this.add.rectangle(177, 194, 10, 238, 0xf9f4e9);
    this.add.rectangle(177, 194, 216, 10, 0xf9f4e9);
    this.add.ellipse(118, 256, 145, 86, 0x76a768, 0.85);
    this.add.ellipse(238, 266, 160, 94, 0x60925a, 0.84);
    this.add.rectangle(177, 325, 286, 24, 0xb7824f).setStrokeStyle(4, 0x8d5b32);
    frame.setDepth(1);
  }

  private createShelves(): void {
    const shelf = (x: number, y: number, width: number): void => {
      this.add.rectangle(x, y, width, 18, 0x9e6739).setStrokeStyle(3, 0x744524);
      this.add.rectangle(x - width / 2 + 22, y + 25, 10, 45, 0x70442a);
      this.add.rectangle(x + width / 2 - 22, y + 25, 10, 45, 0x70442a);
    };
    shelf(1400, 145, 285);
    shelf(1400, 275, 285);
    const colors = [0xe74b3c, 0xf1bd37, 0x3e88d5, 0x49a86b];
    colors.forEach((color, index) => {
      this.add.rectangle(1322 + index * 57, 112, 45, 39, color).setStrokeStyle(3, 0x25364e, .4);
      this.add.circle(1310 + index * 57, 91, 6, 0xffffff, .42);
      this.add.circle(1332 + index * 57, 91, 6, 0xffffff, .42);
    });
    this.add.rectangle(1327, 237, 94, 58, 0x6075cf).setStrokeStyle(4, 0x2f4265);
    this.add.circle(1303, 207, 8, 0xc4f4ff);
    this.add.circle(1351, 207, 8, 0xc4f4ff);
    this.add.rectangle(1440, 236, 70, 57, 0xe6aa3d).setStrokeStyle(4, 0x7e5525);
    this.add.circle(1419, 207, 7, 0xffffff, .45);
    this.add.circle(1461, 207, 7, 0xffffff, .45);
  }

  private createDeskAndFloor(): void {
    this.add.rectangle(800, 720, WORLD_WIDTH, 120, 0xc59057).setStrokeStyle(4, 0x9a6735);
    for (let x = 0; x < WORLD_WIDTH; x += 160) {
      this.add.line(0, 0, x, 662, x + 42, 780, 0x7c512e, .23).setOrigin(0);
    }
    this.add.rectangle(800, 666, WORLD_WIDTH, 22, 0x8e5b31).setStrokeStyle(3, 0x69401f);
  }

  private createDecor(): void {
    this.add.circle(92, 600, 42, 0xf1b83f).setStrokeStyle(5, 0xb77722);
    this.add.rectangle(92, 648, 118, 30, 0x4b9a68).setStrokeStyle(4, 0x2a6a45);
    this.add.rectangle(1490, 570, 150, 110, 0xd45f46).setStrokeStyle(7, 0x713b2f);
    for (let index = 0; index < 3; index += 1) {
      this.add.rectangle(1490, 541 + index * 34, 125, 22, 0xe4775e).setStrokeStyle(2, 0x8d4939);
      this.add.rectangle(1490, 541 + index * 34, 24, 5, 0xf1bc94);
    }
  }

  private createMachine(): void {
    const railOne = { x: 420, y: 309, rotation: Phaser.Math.DegToRad(8), width: 410 };
    const railTwo = { x: 1052, y: 500, rotation: Phaser.Math.DegToRad(15), width: 410 };

    this.add.image(railOne.x, railOne.y, 'rail-blue').setRotation(railOne.rotation);
    this.add.image(railTwo.x, railTwo.y, 'rail-blue').setRotation(railTwo.rotation);
    this.matter.add.rectangle(railOne.x, railOne.y + 4, railOne.width - 18, 28, { isStatic: true, angle: railOne.rotation, friction: 0.006, restitution: 0.02, label: 'rail' });
    this.matter.add.rectangle(railTwo.x, railTwo.y + 4, railTwo.width - 18, 28, { isStatic: true, angle: railTwo.rotation, friction: 0.006, restitution: 0.02, label: 'rail' });

    const launchBlock = this.add.rectangle(224, 227, 130, 46, 0x36a35d).setStrokeStyle(5, 0x1f7040);
    launchBlock.setRotation(railOne.rotation);
    this.add.circle(this.startBall.x, this.startBall.y, 41, 0x1670c6, .13);
    this.add.image(this.startBall.x, this.startBall.y, 'energy-ball');

    this.snapZone = this.add.circle(SNAP_TARGET.x, SNAP_TARGET.y, 105, 0x76d7ff, 0.1).setStrokeStyle(4, 0x63cfff, .42);
    this.add.circle(SNAP_TARGET.x, SNAP_TARGET.y, 65, 0xffffff, .04).setStrokeStyle(2, 0xffffff, .32);

    this.bridgeShadow = this.add.ellipse(785, 426, 230, 35, 0x27344b, .18);
    this.bridge = this.add.image(780, 630, 'bridge-red').setInteractive({ useHandCursor: true });
    this.bridge.setRotation(Phaser.Math.DegToRad(-7));

    this.bridgeHandleLine = this.add.line(0, 0, 0, 0, 0, 0, 0x45566d, .8).setLineWidth(3).setOrigin(0);
    this.bridgeHandle = this.add.circle(0, 0, 18, 0xffffff, 1).setStrokeStyle(5, 0x596a82).setInteractive({ useHandCursor: true });

    this.add.image(1372, 532, 'receiver').setScale(.92);
    this.receiverGlow = this.add.circle(1372, 518, 65, 0x5ed6ff, .12).setBlendMode(Phaser.BlendModes.ADD);
    this.receiverGlow.setAlpha(.18);
    this.matter.add.rectangle(1372, 515, 93, 90, { isStatic: true, isSensor: true, label: 'receiver' });

    this.add.image(1510, 548, 'robot').setScale(.76);
    this.robotEyes = [
      this.add.circle(1493, 503, 7, 0x64738b),
      this.add.circle(1527, 503, 7, 0x64738b)
    ];

    this.add.text(1265, 650, 'ЭНЕРГОПРИЁМНИК', { fontFamily: 'Arial', fontSize: '15px', fontStyle: 'bold', color: '#526078' }).setOrigin(.5);

    this.hintGroup = this.add.container(0, 0).setVisible(false);
    const ghost = this.add.image(SNAP_TARGET.x, SNAP_TARGET.y, 'bridge-red').setRotation(SNAP_TARGET.rotation).setAlpha(.3).setTint(0xbcecff);
    const path = this.add.graphics();
    path.lineStyle(4, 0x59c5f0, .7);
    for (let x = 270; x < 1330; x += 30) {
      const t = (x - 270) / 1060;
      const y = 250 + 355 * t + Math.sin(t * Math.PI) * 26;
      path.lineBetween(x, y, x + 13, y + 4);
    }
    this.hintGroup.add([ghost, path]);
  }

  private createInteraction(): void {
    this.bridge.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.mode !== 'build') return;
      this.dragging = true;
      this.dragOffset.set(this.bridge.x - pointer.worldX, this.bridge.y - pointer.worldY);
      this.bridge.setDepth(20);
      this.bridgeShadow.setDepth(19);
    });

    this.bridgeHandle.on('pointerdown', () => {
      if (this.mode !== 'build') return;
      this.rotating = true;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.mode !== 'build') return;
      if (this.dragging) {
        this.bridge.x = Phaser.Math.Clamp(pointer.worldX + this.dragOffset.x, 260, 1290);
        this.bridge.y = Phaser.Math.Clamp(pointer.worldY + this.dragOffset.y, 210, 635);
        this.applySoftSnap();
        this.updateHandle();
      } else if (this.rotating) {
        this.bridge.rotation = Phaser.Math.Clamp(
          Phaser.Math.Angle.Between(this.bridge.x, this.bridge.y, pointer.worldX, pointer.worldY) + Math.PI / 2,
          Phaser.Math.DegToRad(-28),
          Phaser.Math.DegToRad(34)
        );
        this.updateHandle();
      }
    });

    this.input.on('pointerup', () => {
      if (this.mode !== 'build') return;
      this.dragging = false;
      this.rotating = false;
      this.bridge.setDepth(5);
      this.bridgeShadow.setDepth(4);
      this.applyReleaseSnap();
      this.updateHandle();
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      if (this.mode !== 'build') return;
      this.rotateBridge(deltaY > 0 ? 3 : -3);
    });
  }

  private createKeyboard(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    keyboard.on('keydown-Q', () => this.rotateBridge(-3));
    keyboard.on('keydown-E', () => this.rotateBridge(3));
    keyboard.on('keydown-SPACE', () => this.runSimulation());
    keyboard.on('keydown-R', () => this.fullReset());
    keyboard.on('keydown-H', () => this.toggleHint());
  }

  private rotateBridge(degrees: number): void {
    if (this.mode !== 'build') return;
    this.bridge.rotation = Phaser.Math.Clamp(
      this.bridge.rotation + Phaser.Math.DegToRad(degrees),
      Phaser.Math.DegToRad(-28),
      Phaser.Math.DegToRad(34)
    );
    this.updateHandle();
  }

  private applySoftSnap(): void {
    const distance = Phaser.Math.Distance.Between(this.bridge.x, this.bridge.y, SNAP_TARGET.x, SNAP_TARGET.y);
    this.snapZone.setAlpha(Phaser.Math.Clamp(0.1 + (1 - distance / 250) * 0.2, 0.08, 0.3));
    if (distance < 105) {
      this.bridge.x = Phaser.Math.Linear(this.bridge.x, SNAP_TARGET.x, 0.09);
      this.bridge.y = Phaser.Math.Linear(this.bridge.y, SNAP_TARGET.y, 0.09);
    }
  }

  private applyReleaseSnap(): void {
    const distance = Phaser.Math.Distance.Between(this.bridge.x, this.bridge.y, SNAP_TARGET.x, SNAP_TARGET.y);
    if (distance < 115) {
      this.tweens.add({
        targets: this.bridge,
        x: SNAP_TARGET.x,
        y: SNAP_TARGET.y,
        rotation: Phaser.Math.Linear(this.bridge.rotation, SNAP_TARGET.rotation, 0.58),
        duration: 210,
        ease: 'Cubic.Out',
        onUpdate: () => this.updateHandle(),
        onComplete: () => this.updateHandle()
      });
      this.setMessage('Отлично. Теперь нажми «Запуск».');
    }
  }

  private updateHandle(): void {
    const handleDistance = 74;
    const angle = this.bridge.rotation - Math.PI / 2;
    const hx = this.bridge.x + Math.cos(angle) * handleDistance;
    const hy = this.bridge.y + Math.sin(angle) * handleDistance;
    this.bridgeHandle.setPosition(hx, hy);
    this.bridgeHandleLine.setTo(this.bridge.x, this.bridge.y, hx, hy);
    this.bridgeShadow.setPosition(this.bridge.x, this.bridge.y + 28);
    this.bridgeShadow.setRotation(this.bridge.rotation);
  }

  private createCollisions(): void {
    this.matter.world.on('collisionstart', (event: Phaser.Physics.Matter.Events.CollisionStartEvent) => {
      for (const pair of event.pairs) {
        const labels = [pair.bodyA.label, pair.bodyB.label];
        if (labels.includes('energy-ball') && labels.includes('receiver')) {
          this.winLevel();
          return;
        }
      }
    });
  }

  private runSimulation(): void {
    if (this.mode !== 'build') return;
    this.mode = 'running';
    this.setButtons(true);
    this.setModeCopy('Симуляция', 'Машина работает — наблюдай за цепочкой');
    this.setMessage('Энергия пошла!');
    this.bridge.disableInteractive();
    this.bridgeHandle.setVisible(false);
    this.bridgeHandleLine.setVisible(false);
    this.hintGroup.setVisible(false);

    this.bridgeBody = this.matter.add.rectangle(this.bridge.x, this.bridge.y + 3, BRIDGE_WIDTH - 16, BRIDGE_HEIGHT - 8, {
      isStatic: true,
      angle: this.bridge.rotation,
      friction: 0.006,
      restitution: 0.02,
      label: 'bridge'
    });

    this.ball = this.matter.add.image(this.startBall.x, this.startBall.y - 18, 'energy-ball', undefined, {
      friction: 0.004,
      frictionAir: 0.001,
      restitution: 0.04,
      density: 0.0028,
      label: 'energy-ball'
    });
    this.ball.setCircle(29);
    this.ball.setBounce(0.04);
    this.ball.setAngularVelocity(0.02);

    this.runTimeout = window.setTimeout(() => {
      if (this.mode === 'running') this.failAttempt('Не хватило наклона. Чуть поверни пластину по часовой стрелке.');
    }, 9000);
  }

  private failAttempt(message: string): void {
    if (this.mode !== 'running') return;
    this.mode = 'build';
    this.clearBallAndBodies();
    this.setButtons(false);
    this.setModeCopy('Режим сборки', 'Положение пластины сохранено — поправь её и попробуй снова');
    this.setMessage(message);
    this.bridge.setInteractive({ useHandCursor: true });
    this.bridgeHandle.setVisible(true);
    this.bridgeHandleLine.setVisible(true);
    this.updateHandle();
  }

  private winLevel(): void {
    if (this.mode !== 'running') return;
    this.mode = 'success';
    if (this.runTimeout) window.clearTimeout(this.runTimeout);
    this.setButtons(true);
    this.setModeCopy('Квест выполнен', 'Наклонная дорожка направила шар в приёмник');
    this.setMessage('Луми снова в сети!');

    if (this.ball) {
      this.ball.setVelocity(0, 0);
      this.ball.setAngularVelocity(0);
      this.ball.setStatic(true);
      this.ball.setVisible(false);
    }

    this.tweens.add({
      targets: this.receiverGlow,
      alpha: { from: .2, to: .95 },
      scale: { from: 1, to: 1.28 },
      duration: 520,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut'
    });
    this.robotEyes.forEach((eye, index) => {
      eye.setFillStyle(0x64e7ff);
      this.tweens.add({ targets: eye, alpha: { from: .25, to: 1 }, duration: 250, delay: index * 80, yoyo: true, repeat: 3 });
    });

    const card = document.querySelector<HTMLElement>('#result-card');
    if (card) card.hidden = false;
  }

  private fullReset(): void {
    this.mode = 'build';
    this.clearBallAndBodies();
    this.bridge.setPosition(780, 630).setRotation(Phaser.Math.DegToRad(-7));
    this.bridge.setInteractive({ useHandCursor: true });
    this.bridgeHandle.setVisible(true);
    this.bridgeHandleLine.setVisible(true);
    this.receiverGlow.setAlpha(.18).setScale(1);
    this.robotEyes.forEach((eye) => eye.setFillStyle(0x64738b));
    this.hintGroup.setVisible(false);
    const card = document.querySelector<HTMLElement>('#result-card');
    if (card) card.hidden = true;
    this.setButtons(false);
    this.setModeCopy('Режим сборки', 'Перетащи красную пластину в светящийся разрыв');
    this.setMessage('Мне не хватает одной детали…');
    this.updateHandle();
  }

  private clearBallAndBodies(): void {
    if (this.runTimeout) window.clearTimeout(this.runTimeout);
    if (this.ball) {
      this.ball.destroy();
      this.ball = undefined;
    }
    if (this.bridgeBody) {
      this.matter.world.remove(this.bridgeBody);
      this.bridgeBody = undefined;
    }
  }

  private toggleHint(): void {
    if (this.mode !== 'build') return;
    const visible = !this.hintGroup.visible;
    this.hintGroup.setVisible(visible);
    this.setMessage(visible ? 'Поставь пластину поверх голубого силуэта.' : 'Мне не хватает одной детали…');
  }

  private setMessage(message: string): void {
    const bubble = document.querySelector<HTMLElement>('#message-bubble');
    if (bubble) bubble.textContent = message;
  }

  private setModeCopy(title: string, copy: string): void {
    const titleNode = document.querySelector<HTMLElement>('#mode-title');
    const copyNode = document.querySelector<HTMLElement>('#mode-copy');
    if (titleNode) titleNode.textContent = title;
    if (copyNode) copyNode.textContent = copy;
  }

  private setButtons(running: boolean): void {
    const run = document.querySelector<HTMLButtonElement>('#run-button');
    const hint = document.querySelector<HTMLButtonElement>('#hint-button');
    if (run) run.disabled = running;
    if (hint) hint.disabled = running;
  }

  private runDevGeometryChecks(): void {
    const testPlacements = [
      { x: 765, y: 405, angle: 8 },
      { x: 785, y: 394, angle: 12 },
      { x: 805, y: 385, angle: 16 }
    ];
    const results = testPlacements.map((placement) => {
      const distance = Phaser.Math.Distance.Between(placement.x, placement.y, SNAP_TARGET.x, SNAP_TARGET.y);
      const angleDelta = Math.abs(placement.angle - Phaser.Math.RadToDeg(SNAP_TARGET.rotation));
      return { ...placement, accepted: distance <= 34 && angleDelta <= 7 };
    });
    console.groupCollapsed('[Young Inventor] Допуски первого квеста');
    console.table(results);
    console.groupEnd();
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#ead9bd',
  transparent: false,
  antialias: true,
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance'
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT
  },
  physics: {
    default: 'matter',
    matter: {
      gravity: { x: 0, y: 1.05 },
      enableSleeping: false,
      debug: false
    }
  },
  scene: [WorkshopScene]
};

new Phaser.Game(config);

document.querySelector<HTMLButtonElement>('#run-button')?.addEventListener('click', () => window.youngInventorGame?.run());
document.querySelector<HTMLButtonElement>('#reset-button')?.addEventListener('click', () => window.youngInventorGame?.reset());
document.querySelector<HTMLButtonElement>('#hint-button')?.addEventListener('click', () => window.youngInventorGame?.toggleHint());
