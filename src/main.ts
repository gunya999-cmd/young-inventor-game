import Phaser from 'phaser';
import './style.css';

const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 800;
const BRIDGE_WIDTH = 274;
const BRIDGE_HEIGHT = 46;
const TARGET = { x: 790, y: 392, rotation: Phaser.Math.DegToRad(12) };
const START_BRIDGE = { x: 790, y: 688, rotation: Phaser.Math.DegToRad(-6) };
const START_BALL = { x: 286, y: 250 };

type GameMode = 'build' | 'running' | 'success';

type GameApi = {
  run: () => void;
  reset: () => void;
  toggleHint: () => void;
};

declare global {
  interface Window {
    youngInventorGame?: GameApi;
  }
}

class WorkshopScene extends Phaser.Scene {
  private bridge!: any;
  private bridgeShadow!: any;
  private handle!: any;
  private handleLine!: any;
  private ballPreview!: any;
  private ball?: any;
  private bridgeBody?: any;
  private receiverGlow!: any;
  private receiverCore!: any;
  private robotHead!: any;
  private robotEyes: any[] = [];
  private hintGroup!: any;
  private targetGhost!: any;
  private connectorGlows: any[] = [];
  private mode: GameMode = 'build';
  private dragging = false;
  private rotating = false;
  private dragOffset = new Phaser.Math.Vector2();
  private runTimer?: number;

  constructor() {
    super('Workshop');
  }

  create(): void {
    this.createTextures();
    this.createRoom();
    this.createWorkBoard();
    this.createMachine();
    this.createInteraction();
    this.createCollisions();
    this.createKeyboard();
    this.updateBridgeUi();

    window.youngInventorGame = {
      run: () => this.runSimulation(),
      reset: () => this.fullReset(),
      toggleHint: () => this.toggleHint()
    };
  }

  update(): void {
    if (!this.ball || this.mode !== 'running') return;
    if (this.ball.y > WORLD_HEIGHT + 100 || this.ball.x < -100 || this.ball.x > WORLD_WIDTH + 100) {
      this.failAttempt('Шар ушёл с дорожки. Чуть поправь положение пластины.');
    }
  }

  private createTextures(): void {
    this.makeBeamTexture('beam-blue', 402, 54, '#58a6ff', '#1867c7', '#0f4b99');
    this.makeBeamTexture('beam-red', BRIDGE_WIDTH, 58, '#ff726a', '#df2f35', '#a91f28');
    this.makeBallTexture();
    this.makeReceiverTexture();
    this.makeRobotTexture();
  }

  private makeBeamTexture(key: string, width: number, height: number, top: string, middle: string, side: string): void {
    const texture = this.textures.createCanvas(key, width, height);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.shadowColor = 'rgba(20, 31, 48, .32)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 9;

    const body = ctx.createLinearGradient(0, 5, 0, height - 6);
    body.addColorStop(0, top);
    body.addColorStop(.42, middle);
    body.addColorStop(1, side);
    this.roundedRect(ctx, 9, 5, width - 18, height - 16, 13);
    ctx.fillStyle = body;
    ctx.fill();
    ctx.restore();

    const edge = ctx.createLinearGradient(0, height - 24, 0, height - 8);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(1, 'rgba(0,0,0,.28)');
    this.roundedRect(ctx, 12, 11, width - 24, height - 24, 11);
    ctx.fillStyle = edge;
    ctx.fill();

    const gloss = ctx.createLinearGradient(0, 7, 0, 29);
    gloss.addColorStop(0, 'rgba(255,255,255,.78)');
    gloss.addColorStop(.55, 'rgba(255,255,255,.18)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    this.roundedRect(ctx, 15, 9, width - 30, 18, 9);
    ctx.fillStyle = gloss;
    ctx.fill();

    const holeCount = Math.max(4, Math.round(width / 52));
    for (let i = 0; i < holeCount; i += 1) {
      const x = 31 + i * ((width - 62) / Math.max(1, holeCount - 1));
      const ring = ctx.createRadialGradient(x - 2, 22, 1, x, 24, 9);
      ring.addColorStop(0, 'rgba(255,255,255,.92)');
      ring.addColorStop(.32, 'rgba(255,255,255,.45)');
      ring.addColorStop(.54, 'rgba(20,35,52,.45)');
      ring.addColorStop(1, 'rgba(6,18,33,.72)');
      ctx.beginPath();
      ctx.arc(x, 24, 8.2, 0, Math.PI * 2);
      ctx.fillStyle = ring;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, 24, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(228,245,255,.7)';
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,.34)';
    ctx.lineWidth = 1.5;
    this.roundedRect(ctx, 10, 6, width - 20, height - 18, 12);
    ctx.stroke();
    texture.refresh();
  }

  private makeBallTexture(): void {
    const size = 88;
    const texture = this.textures.createCanvas('energy-ball', size, size);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return;

    ctx.clearRect(0, 0, size, size);
    ctx.shadowColor = 'rgba(38, 160, 255, .55)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 7;
    const orb = ctx.createRadialGradient(27, 20, 3, 44, 43, 38);
    orb.addColorStop(0, '#ffffff');
    orb.addColorStop(.12, '#bdf2ff');
    orb.addColorStop(.38, '#42b8ff');
    orb.addColorStop(.72, '#146fc8');
    orb.addColorStop(1, '#07366f');
    ctx.beginPath();
    ctx.arc(44, 40, 34, 0, Math.PI * 2);
    ctx.fillStyle = orb;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(230,250,255,.86)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(34, 28, 9, Math.PI * 1.05, Math.PI * 1.8);
    ctx.strokeStyle = 'rgba(255,255,255,.82)';
    ctx.lineWidth = 4;
    ctx.stroke();
    texture.refresh();
  }

  private makeReceiverTexture(): void {
    const texture = this.textures.createCanvas('receiver', 214, 214);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return;

    ctx.clearRect(0, 0, 214, 214);
    ctx.shadowColor = 'rgba(25,38,58,.34)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 11;
    const shell = ctx.createLinearGradient(20, 10, 190, 205);
    shell.addColorStop(0, '#ffffff');
    shell.addColorStop(.5, '#d8e3ef');
    shell.addColorStop(1, '#91a6ba');
    this.roundedRect(ctx, 22, 24, 170, 164, 48);
    ctx.fillStyle = shell;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#263c58';
    ctx.lineWidth = 8;
    ctx.stroke();

    const bezel = ctx.createRadialGradient(107, 103, 34, 107, 103, 78);
    bezel.addColorStop(0, '#071b33');
    bezel.addColorStop(.53, '#0c294b');
    bezel.addColorStop(.67, '#1c87ca');
    bezel.addColorStop(.78, '#9feaff');
    bezel.addColorStop(.86, '#e6fbff');
    bezel.addColorStop(1, '#536d86');
    ctx.beginPath();
    ctx.arc(107, 102, 75, 0, Math.PI * 2);
    ctx.fillStyle = bezel;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(107, 102, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#07182d';
    ctx.fill();

    ctx.fillStyle = '#70879c';
    this.roundedRect(ctx, 70, 171, 74, 11, 6);
    ctx.fill();
    texture.refresh();
  }

  private makeRobotTexture(): void {
    const texture = this.textures.createCanvas('robot', 210, 250);
    const ctx = texture?.getContext();
    if (!texture || !ctx) return;

    ctx.clearRect(0, 0, 210, 250);
    ctx.shadowColor = 'rgba(24,36,55,.28)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 10;
    const metal = ctx.createLinearGradient(22, 18, 185, 230);
    metal.addColorStop(0, '#ffffff');
    metal.addColorStop(.46, '#dbe5ef');
    metal.addColorStop(1, '#93a7ba');

    this.roundedRect(ctx, 40, 25, 130, 95, 34);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#2a3e59';
    ctx.lineWidth = 7;
    ctx.stroke();

    ctx.fillStyle = '#203651';
    this.roundedRect(ctx, 60, 49, 90, 46, 18);
    ctx.fill();

    this.roundedRect(ctx, 52, 132, 106, 77, 25);
    ctx.fillStyle = metal;
    ctx.fill();
    ctx.strokeStyle = '#2a3e59';
    ctx.lineWidth = 7;
    ctx.stroke();

    const chest = ctx.createLinearGradient(0, 142, 0, 188);
    chest.addColorStop(0, '#7388ec');
    chest.addColorStop(1, '#435ab6');
    this.roundedRect(ctx, 69, 151, 72, 37, 13);
    ctx.fillStyle = chest;
    ctx.fill();
    ctx.fillStyle = '#2a3e59';
    ctx.fillRect(25, 151, 34, 19);
    ctx.fillRect(151, 151, 34, 19);
    ctx.fillRect(61, 205, 29, 31);
    ctx.fillRect(120, 205, 29, 31);

    ctx.strokeStyle = '#2a3e59';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(105, 25);
    ctx.lineTo(105, 8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(105, 7, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#f1b83f';
    ctx.fill();
    texture.refresh();
  }

  private roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  private createRoom(): void {
    const wall = this.add.graphics();
    wall.fillGradientStyle(0xfff9ed, 0xf5e6cb, 0xe9d1ac, 0xd8b987, 1);
    wall.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    this.add.rectangle(800, 744, WORLD_WIDTH, 112, 0xb97b42);
    const floor = this.add.graphics();
    floor.fillGradientStyle(0xd59b5f, 0xc68a50, 0xb8753e, 0xa96533, 1);
    floor.fillRect(0, 690, WORLD_WIDTH, 110);
    for (let x = -80; x < WORLD_WIDTH + 100; x += 170) {
      this.add.line(0, 0, x, 690, x + 44, 800, 0x75401f, .22).setOrigin(0);
    }

    this.createWindow();
    this.createShelves();
    this.createRoomProps();

    const light = this.add.graphics();
    light.fillStyle(0xfff4c7, .11);
    light.fillTriangle(82, 78, 485, 690, 180, 690);
  }

  private createWindow(): void {
    const x = 76;
    const y = 84;
    const w = 235;
    const h = 220;

    const sky = this.add.graphics();
    sky.fillGradientStyle(0xbfeaff, 0xe9f9ff, 0x92c98d, 0x6fa665, 1);
    sky.fillRoundedRect(x, y, w, h, 10);
    this.add.ellipse(x + 54, y + 177, 155, 85, 0x6f9f62, .95);
    this.add.ellipse(x + 174, y + 183, 180, 95, 0x588e55, .95);
    this.add.rectangle(x + w / 2, y + h / 2, 10, h, 0xf9f1df);
    this.add.rectangle(x + w / 2, y + h / 2, w, 10, 0xf9f1df);

    const frame = this.add.graphics();
    frame.lineStyle(14, 0xc49a68, 1);
    frame.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, 16);
    frame.lineStyle(4, 0x8d6139, .45);
    frame.strokeRoundedRect(x - 7, y - 7, w + 14, h + 14, 16);
    this.add.rectangle(x + w / 2, y + h + 16, w + 44, 24, 0x9f6738).setStrokeStyle(3, 0x75451f);
  }

  private createShelves(): void {
    const shelf = (x: number, y: number, width: number): void => {
      this.add.rectangle(x, y, width, 18, 0x9a6033).setStrokeStyle(3, 0x693b1c);
      this.add.rectangle(x - width / 2 + 20, y + 23, 9, 40, 0x68401f);
      this.add.rectangle(x + width / 2 - 20, y + 23, 9, 40, 0x68401f);
    };

    shelf(1410, 140, 275);
    shelf(1410, 260, 275);
    const colors = [0xe74b45, 0xf1bd3c, 0x3989d8, 0x4ca86c];
    colors.forEach((color, i) => {
      const x = 1332 + i * 55;
      this.add.rectangle(x, 108, 44, 36, color).setStrokeStyle(3, 0x30415a, .36);
      this.add.circle(x - 11, 85, 5.5, 0xffffff, .55);
      this.add.circle(x + 11, 85, 5.5, 0xffffff, .55);
    });
    this.add.rectangle(1358, 225, 95, 56, 0x6075ce).setStrokeStyle(4, 0x344665);
    this.add.circle(1335, 195, 7, 0xd8f6ff);
    this.add.circle(1381, 195, 7, 0xd8f6ff);
    this.add.rectangle(1468, 226, 72, 55, 0xe3aa38).setStrokeStyle(4, 0x7e5522);
    this.add.circle(1451, 196, 7, 0xfff1b0);
    this.add.circle(1485, 196, 7, 0xfff1b0);
  }

  private createRoomProps(): void {
    this.add.rectangle(110, 622, 142, 30, 0x4b9b69).setStrokeStyle(4, 0x2e6e49);
    this.add.circle(110, 582, 42, 0xf2bb43).setStrokeStyle(5, 0xb87922);
    this.add.rectangle(1490, 612, 165, 118, 0xc85a43).setStrokeStyle(7, 0x71382e);
    for (let i = 0; i < 3; i += 1) {
      this.add.rectangle(1490, 578 + i * 36, 137, 23, 0xe4765b).setStrokeStyle(2, 0x914839);
      this.add.rectangle(1490, 578 + i * 36, 26, 5, 0xf4bd96);
    }
  }

  private createWorkBoard(): void {
    this.add.rectangle(800, 395, 1180, 548, 0xede6d6, .92)
      .setStrokeStyle(12, 0x9c754a, .95);
    this.add.rectangle(800, 395, 1150, 518, 0xf7f2e8, .93)
      .setStrokeStyle(2, 0xffffff, .8);

    for (let x = 260; x <= 1340; x += 58) {
      for (let y = 160; y <= 620; y += 58) {
        this.add.circle(x, y, 2.1, 0x9d8d73, .18);
      }
    }

    this.add.rectangle(800, 663, 1135, 26, 0x9a6033).setStrokeStyle(4, 0x673a1d);
  }

  private createMachine(): void {
    const left = { x: 476, y: 326, rotation: Phaser.Math.DegToRad(12), width: 402 };
    const right = { x: 1104, y: 458, rotation: Phaser.Math.DegToRad(12), width: 402 };

    this.addBeamWithBody(left.x, left.y, left.rotation, left.width);
    this.addBeamWithBody(right.x, right.y, right.rotation, right.width);
    this.addSupport(350, 385, 0x4c79b5);
    this.addSupport(1198, 533, 0x4c79b5);

    this.add.rectangle(255, 260, 126, 46, 0x3da85f).setStrokeStyle(5, 0x1e7040).setRotation(left.rotation);
    this.add.circle(START_BALL.x, START_BALL.y, 45, 0x4bc4ff, .12);
    this.ballPreview = this.add.image(START_BALL.x, START_BALL.y, 'energy-ball');

    this.targetGhost = this.add.image(TARGET.x, TARGET.y, 'beam-red')
      .setRotation(TARGET.rotation)
      .setAlpha(.11)
      .setTint(0x7ddcff);
    this.targetGhost.setVisible(false);

    const leftConnector = this.add.circle(656, 364, 17, 0x6bd5ff, .12).setStrokeStyle(4, 0x64cfff, .42);
    const rightConnector = this.add.circle(923, 421, 17, 0x6bd5ff, .12).setStrokeStyle(4, 0x64cfff, .42);
    this.connectorGlows = [leftConnector, rightConnector];

    this.bridgeShadow = this.add.ellipse(START_BRIDGE.x, START_BRIDGE.y + 30, 250, 31, 0x26344a, .2);
    this.bridge = this.add.image(START_BRIDGE.x, START_BRIDGE.y, 'beam-red')
      .setRotation(START_BRIDGE.rotation)
      .setInteractive({ useHandCursor: true });

    this.handleLine = this.add.line(0, 0, 0, 0, 0, 0, 0x41536c, .7).setLineWidth(3).setOrigin(0);
    this.handle = this.add.circle(0, 0, 20, 0xffffff, 1)
      .setStrokeStyle(5, 0x53657c)
      .setInteractive({ useHandCursor: true });

    this.receiverGlow = this.add.circle(1360, 526, 92, 0x5ddaff, .08)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(.18);
    this.add.image(1360, 526, 'receiver').setScale(.84);
    this.receiverCore = this.add.circle(1360, 523, 39, 0x07182d, .35);
    this.matter.add.circle(1360, 523, 62, { isStatic: true, isSensor: true, label: 'receiver' });

    this.robotHead = this.add.image(1490, 548, 'robot').setScale(.68);
    this.robotEyes = [
      this.add.circle(1476, 514, 7, 0x66778f),
      this.add.circle(1504, 514, 7, 0x66778f)
    ];

    this.add.text(1360, 635, 'ЭНЕРГОПОРТ', {
      fontFamily: 'Inter, Arial',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#596880',
      letterSpacing: 2
    }).setOrigin(.5);

    this.hintGroup = this.add.container(0, 0).setVisible(false);
    const ghost = this.add.image(TARGET.x, TARGET.y, 'beam-red')
      .setRotation(TARGET.rotation)
      .setAlpha(.34)
      .setTint(0xaeefff);
    const path = this.add.graphics();
    path.lineStyle(4, 0x4fc6f2, .72);
    const points = [
      { x: 292, y: 260 }, { x: 470, y: 320 }, { x: 650, y: 360 },
      { x: 790, y: 392 }, { x: 930, y: 424 }, { x: 1100, y: 458 }, { x: 1352, y: 520 }
    ];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const steps = 5;
      for (let s = 0; s < steps; s += 2) {
        const t1 = s / steps;
        const t2 = Math.min(1, (s + 1) / steps);
        path.lineBetween(
          Phaser.Math.Linear(a.x, b.x, t1), Phaser.Math.Linear(a.y, b.y, t1),
          Phaser.Math.Linear(a.x, b.x, t2), Phaser.Math.Linear(a.y, b.y, t2)
        );
      }
    }
    this.hintGroup.add([ghost, path]);

    this.matter.add.rectangle(800, 674, 1160, 26, { isStatic: true, friction: .6, label: 'bench' });
  }

  private addBeamWithBody(x: number, y: number, rotation: number, width: number): void {
    this.add.ellipse(x, y + 28, width - 40, 28, 0x24334b, .14).setRotation(rotation);
    this.add.image(x, y, 'beam-blue').setRotation(rotation);
    this.matter.add.rectangle(x, y + 5, width - 20, 28, {
      isStatic: true,
      angle: rotation,
      friction: .004,
      restitution: .015,
      label: 'rail'
    });
  }

  private addSupport(x: number, y: number, color: number): void {
    this.add.rectangle(x, y, 58, 20, color).setStrokeStyle(3, 0x2c4361);
    this.add.rectangle(x, y + 35, 16, 62, 0x3e526e);
    this.add.rectangle(x, y + 65, 82, 15, 0x2d3f57);
    this.add.circle(x, y, 8, 0xd8e7f2).setStrokeStyle(3, 0x2c4361);
  }

  private createInteraction(): void {
    this.bridge.on('pointerdown', (pointer: any) => {
      if (this.mode !== 'build') return;
      this.dragging = true;
      this.dragOffset.set(this.bridge.x - pointer.worldX, this.bridge.y - pointer.worldY);
      this.bridge.setDepth(30);
      this.bridgeShadow.setDepth(29);
      this.setMessage('Поставь пластину между двумя синими дорожками.');
    });

    this.handle.on('pointerdown', () => {
      if (this.mode !== 'build') return;
      this.rotating = true;
    });

    this.input.on('pointermove', (pointer: any) => {
      if (this.mode !== 'build') return;
      if (this.dragging) {
        this.bridge.x = Phaser.Math.Clamp(pointer.worldX + this.dragOffset.x, 255, 1320);
        this.bridge.y = Phaser.Math.Clamp(pointer.worldY + this.dragOffset.y, 210, 690);
        this.applySoftSnap();
        this.updateBridgeUi();
      } else if (this.rotating) {
        this.bridge.rotation = Phaser.Math.Clamp(
          Phaser.Math.Angle.Between(this.bridge.x, this.bridge.y, pointer.worldX, pointer.worldY) + Math.PI / 2,
          Phaser.Math.DegToRad(-24),
          Phaser.Math.DegToRad(30)
        );
        this.updateBridgeUi();
      }
    });

    this.input.on('pointerup', () => {
      if (this.mode !== 'build') return;
      this.dragging = false;
      this.rotating = false;
      this.bridge.setDepth(8);
      this.bridgeShadow.setDepth(7);
      this.applyReleaseSnap();
      this.updateBridgeUi();
    });

    this.input.on('wheel', (_pointer: any, _objects: any[], _dx: number, dy: number) => {
      if (this.mode !== 'build') return;
      this.rotateBridge(dy > 0 ? 3 : -3);
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
      Phaser.Math.DegToRad(-24),
      Phaser.Math.DegToRad(30)
    );
    this.updateBridgeUi();
  }

  private bridgeDistance(): number {
    return Phaser.Math.Distance.Between(this.bridge.x, this.bridge.y, TARGET.x, TARGET.y);
  }

  private applySoftSnap(): void {
    const distance = this.bridgeDistance();
    const strength = Phaser.Math.Clamp(1 - distance / 190, 0, 1);
    this.connectorGlows.forEach((glow) => glow.setAlpha(.1 + strength * .5).setScale(1 + strength * .18));
    if (distance < 130) {
      this.bridge.x = Phaser.Math.Linear(this.bridge.x, TARGET.x, .12);
      this.bridge.y = Phaser.Math.Linear(this.bridge.y, TARGET.y, .12);
      this.bridge.rotation = Phaser.Math.Linear(this.bridge.rotation, TARGET.rotation, .055);
    }
  }

  private applyReleaseSnap(): void {
    if (this.bridgeDistance() > 145) return;
    this.tweens.add({
      targets: this.bridge,
      x: TARGET.x,
      y: TARGET.y,
      rotation: TARGET.rotation,
      duration: 230,
      ease: 'Back.Out',
      onUpdate: () => this.updateBridgeUi(),
      onComplete: () => {
        this.updateBridgeUi();
        this.connectorGlows.forEach((glow) => glow.setAlpha(.72));
        this.setMessage('Готово! Нажми «Запуск».');
        this.setModeCopy('Пластина установлена', 'Запусти механизм и посмотри, что произойдёт');
      }
    });
  }

  private updateBridgeUi(): void {
    const distance = 74;
    const angle = this.bridge.rotation - Math.PI / 2;
    const hx = this.bridge.x + Math.cos(angle) * distance;
    const hy = this.bridge.y + Math.sin(angle) * distance;
    this.handle.setPosition(hx, hy);
    this.handleLine.setTo(this.bridge.x, this.bridge.y, hx, hy);
    this.bridgeShadow.setPosition(this.bridge.x, this.bridge.y + 30).setRotation(this.bridge.rotation);
  }

  private createCollisions(): void {
    this.matter.world.on('collisionstart', (event: any) => {
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

    if (this.bridgeDistance() < 165) {
      this.bridge.setPosition(TARGET.x, TARGET.y).setRotation(TARGET.rotation);
      this.updateBridgeUi();
    }

    this.mode = 'running';
    this.setButtons(true);
    this.setModeCopy('Симуляция', 'Наблюдай, как энергия проходит по собранной дорожке');
    this.setMessage('Энергия пошла!');
    this.bridge.disableInteractive();
    this.handle.setVisible(false);
    this.handleLine.setVisible(false);
    this.hintGroup.setVisible(false);
    this.ballPreview.setVisible(false);

    this.bridgeBody = this.matter.add.rectangle(this.bridge.x, this.bridge.y + 4, BRIDGE_WIDTH - 20, BRIDGE_HEIGHT - 12, {
      isStatic: true,
      angle: this.bridge.rotation,
      friction: .004,
      restitution: .015,
      label: 'bridge'
    });

    this.ball = this.matter.add.image(START_BALL.x, START_BALL.y - 12, 'energy-ball', undefined, {
      friction: .002,
      frictionAir: .0008,
      restitution: .025,
      density: .0026,
      label: 'energy-ball'
    });
    this.ball.setCircle(32);
    this.ball.setBounce(.025);
    this.ball.setAngularVelocity(.025);

    this.runTimer = window.setTimeout(() => {
      if (this.mode === 'running') {
        const distance = this.bridgeDistance();
        const message = distance > 190
          ? 'Пластина не соединяет дорожки. Перетащи её в светящийся разрыв.'
          : 'Почти получилось. Чуть измени угол пластины.';
        this.failAttempt(message);
      }
    }, 8500);
  }

  private failAttempt(message: string): void {
    if (this.mode !== 'running') return;
    this.mode = 'build';
    this.clearSimulation();
    this.ballPreview.setVisible(true);
    this.bridge.setInteractive({ useHandCursor: true });
    this.handle.setVisible(true);
    this.handleLine.setVisible(true);
    this.setButtons(false);
    this.setModeCopy('Режим сборки', 'Положение детали сохранено — поправь её и попробуй снова');
    this.setMessage(message);
    this.updateBridgeUi();
  }

  private winLevel(): void {
    if (this.mode !== 'running') return;
    this.mode = 'success';
    if (this.runTimer) window.clearTimeout(this.runTimer);
    this.setButtons(true);
    this.setModeCopy('Квест выполнен', 'Ты замкнул дорожку и доставил энергию Луми');
    this.setMessage('Луми снова в сети!');

    if (this.ball) {
      this.ball.setVelocity(0, 0);
      this.ball.setAngularVelocity(0);
      this.ball.setStatic(true);
      this.ball.setVisible(false);
    }

    this.tweens.add({
      targets: [this.receiverGlow, this.receiverCore],
      alpha: { from: .22, to: .98 },
      scale: { from: 1, to: 1.26 },
      duration: 470,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.InOut'
    });
    this.robotEyes.forEach((eye, index) => {
      eye.setFillStyle(0x66e8ff);
      this.tweens.add({ targets: eye, alpha: { from: .25, to: 1 }, duration: 230, delay: index * 90, yoyo: true, repeat: 4 });
    });
    this.tweens.add({ targets: this.robotHead, y: this.robotHead.y - 8, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.InOut' });

    const card = document.querySelector<HTMLElement>('#result-card');
    if (card) card.hidden = false;
  }

  private fullReset(): void {
    this.mode = 'build';
    this.clearSimulation();
    this.bridge.setPosition(START_BRIDGE.x, START_BRIDGE.y).setRotation(START_BRIDGE.rotation);
    this.bridge.setInteractive({ useHandCursor: true });
    this.ballPreview.setVisible(true);
    this.handle.setVisible(true);
    this.handleLine.setVisible(true);
    this.receiverGlow.setAlpha(.18).setScale(1);
    this.receiverCore.setAlpha(.35).setScale(1);
    this.robotEyes.forEach((eye) => eye.setFillStyle(0x66778f));
    this.hintGroup.setVisible(false);
    this.targetGhost.setVisible(false);
    this.connectorGlows.forEach((glow) => glow.setAlpha(.12).setScale(1));
    const card = document.querySelector<HTMLElement>('#result-card');
    if (card) card.hidden = true;
    this.setButtons(false);
    this.setModeCopy('Режим сборки', 'Перетащи красную пластину в разрыв между дорожками');
    this.setMessage('Луми: «Мне не хватает одной детали…»');
    this.updateBridgeUi();
  }

  private clearSimulation(): void {
    if (this.runTimer) window.clearTimeout(this.runTimer);
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
    this.targetGhost.setVisible(false);
    this.setMessage(visible ? 'Совмести красную пластину с голубым силуэтом.' : 'Луми: «Мне не хватает одной детали…»');
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

  private setButtons(locked: boolean): void {
    const run = document.querySelector<HTMLButtonElement>('#run-button');
    const hint = document.querySelector<HTMLButtonElement>('#hint-button');
    if (run) run.disabled = locked;
    if (hint) hint.disabled = locked;
  }
}

const config: any = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#ead5b2',
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
      gravity: { x: 0, y: 1.02 },
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
