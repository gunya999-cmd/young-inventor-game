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
    this.completed = false;
    this.guidePlaced = false;
    this.ropeConnected = false;
    this.weightAdded = false;
    this.ballCaught = false;
    this.secondReleased = false;
    this.hammerReleased = false;
    this.selectedPart = null;
    this.elapsed = 0;
    this.weightOffset = -70;
    this.guideAngle = 22;
    this.bucketX = 575;
    this.gateX = 730;
    this.bucketStartY = 520;
    this.gateStartY = 500;
    this.ropeLength = this.bucketStartY + this.gateStartY;
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
    if (new URLSearchParams(window.location.search).has('autoplay')) {
      this.time.delayedCall(650, () => {
        this.applyHint();
        this.startSimulation();
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
