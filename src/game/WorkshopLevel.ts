// @ts-nocheck
import Phaser from 'phaser';
import { WORLD_WIDTH, WORLD_HEIGHT, resetHud, setActiveScene } from './ui';
import { textureMethods } from './texture';
import { backgroundMethods } from './background';
import { mechanismMethods } from './mechanism';
import { gameplayMethods } from './gameplay';

export class WorkshopLevel extends Phaser.Scene {
  constructor() {
    super('WorkshopLevel');
    this.running = false;
    this.failed = false;
    this.completed = false;
    this.guidePlaced = false;
    this.ropeConnected = false;
    this.weightAdded = false;
    this.ballCaught = false;
    this.ball2OnLever = false;
    this.secondReleased = false;
    this.hammerReleased = false;
    this.selectedPart = null;
    this.elapsed = 0;
    this.weightOffset = 70;
    this.guideAngle = 18;
    this.bucketX = 575;
    this.gateX = 760;
    this.bucketStartY = 535;
    this.gateStartY = 505;
    this.ropeLength = this.bucketStartY + this.gateStartY;
    this.autoplay = new URLSearchParams(window.location.search).has('autoplay');
  }

  create() {
    setActiveScene(this);
    this.matter.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 64, true, true, true, true);
    this.createTextures();
    this.createWorkshopBackground();
    this.createMechanism();
    this.createBuildInput();

    this.collisionHandler = (event) => this.handleCollision(event);
    this.matter.world.on('collisionstart', this.collisionHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.matter.world.off('collisionstart', this.collisionHandler);
      setActiveScene(null);
    });

    resetHud();
    window.__TIM_AUTOPLAY_RESULT__ = 'idle';
    if (this.autoplay) {
      this.time.delayedCall(450, () => {
        this.applyHint();
        this.time.delayedCall(350, () => this.startSimulation());
      });
    }
  }
}

Object.assign(
  WorkshopLevel.prototype,
  textureMethods,
  backgroundMethods,
  mechanismMethods,
  gameplayMethods
);
