// @ts-nocheck
import { WORLD_WIDTH, WORLD_HEIGHT, FLOOR_Y } from './ui';
export const backgroundMethods = {
  createWorkshopBackground() {
    const background = this.add.graphics().setDepth(-30);
    background.fillGradientStyle(0xe9dbc9, 0xd0bda7, 0xa89179, 0x8a725e, 1);
    background.fillRect(0, 0, WORLD_WIDTH, FLOOR_Y);

    background.lineStyle(2, 0x9a826d, .22);
    for (let y = 62; y < FLOOR_Y; y += 55) {
      background.beginPath();
      background.moveTo(0, y);
      background.lineTo(WORLD_WIDTH, y);
      background.strokePath();
      const offset = Math.floor(y / 55) % 2 === 0 ? 0 : 66;
      for (let x = offset; x < WORLD_WIDTH; x += 132) {
        background.beginPath();
        background.moveTo(x, y - 55);
        background.lineTo(x, y);
        background.strokePath();
      }
    }

    this.drawWindow(background);
    this.drawShelves(background);
    this.drawBlueprint(background);
    this.drawToolBoard(background);
    this.drawLamps(background);

    background.fillStyle(0x8f5c31, 1);
    background.fillRect(0, FLOOR_Y - 13, WORLD_WIDTH, 33);
    background.fillStyle(0x3b2b22, 1);
    background.fillRect(0, FLOOR_Y + 20, WORLD_WIDTH, 110);
    background.fillStyle(0x18191a, 1);
    background.fillRect(0, FLOOR_Y + 130, WORLD_WIDTH, 100);
    background.lineStyle(8, 0x0e1011, 1);
    for (let x = 20; x < WORLD_WIDTH; x += 280) {
      background.strokeRect(x, FLOOR_Y + 43, 230, 95);
      background.beginPath();
      background.moveTo(x + 14, FLOOR_Y + 52);
      background.lineTo(x + 216, FLOOR_Y + 130);
      background.moveTo(x + 216, FLOOR_Y + 52);
      background.lineTo(x + 14, FLOOR_Y + 130);
      background.strokePath();
    }

    const light = this.add.graphics().setDepth(-29);
    light.fillStyle(0xfff2c9, .11);
    light.fillTriangle(0, 80, 0, 690, 580, 690);
    light.fillStyle(0x392817, .08);
    light.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  }
,
  drawWindow(graphics) {
    graphics.fillStyle(0x80624e, 1);
    graphics.fillRoundedRect(25, 18, 275, 470, 105);
    graphics.fillGradientStyle(0xdaf1ff, 0xbddff1, 0x9cc9dc, 0x88b8ce, 1);
    graphics.fillRoundedRect(40, 35, 245, 435, 95);
    graphics.lineStyle(13, 0x6f5748, 1);
    graphics.strokeRoundedRect(40, 35, 245, 435, 95);
    graphics.lineStyle(8, 0x745b4b, 1);
    graphics.beginPath();
    graphics.moveTo(120, 45);
    graphics.lineTo(120, 468);
    graphics.moveTo(205, 45);
    graphics.lineTo(205, 468);
    graphics.moveTo(42, 210);
    graphics.lineTo(285, 210);
    graphics.strokePath();
    graphics.fillStyle(0x78a86d, .45);
    graphics.fillCircle(80, 420, 76);
    graphics.fillCircle(225, 430, 95);
  }
,
  drawShelves(graphics) {
    graphics.fillStyle(0x734926, 1);
    graphics.fillRect(315, 210, 310, 20);
    graphics.fillRect(315, 430, 310, 20);
    graphics.fillStyle(0x52634d, 1);
    graphics.fillRoundedRect(345, 155, 76, 52, 6);
    graphics.fillStyle(0xa15439, 1);
    graphics.fillRoundedRect(443, 172, 53, 35, 4);
    graphics.fillStyle(0xb98a53, 1);
    graphics.fillRect(520, 168, 70, 39);
    graphics.fillStyle(0xa8783d, 1);
    graphics.fillRect(355, 370, 86, 58);
    graphics.fillStyle(0x7c654d, 1);
    graphics.fillRect(474, 381, 70, 47);
  }
,
  drawBlueprint(graphics) {
    graphics.fillStyle(0x315f79, .78);
    graphics.fillRect(1120, 55, 270, 220);
    graphics.lineStyle(2, 0xaed0da, .22);
    for (let x = 1135; x < 1390; x += 20) {
      graphics.beginPath(); graphics.moveTo(x, 55); graphics.lineTo(x, 275); graphics.strokePath();
    }
    for (let y = 70; y < 275; y += 20) {
      graphics.beginPath(); graphics.moveTo(1120, y); graphics.lineTo(1390, y); graphics.strokePath();
    }
    graphics.lineStyle(4, 0xc6e7ee, .48);
    graphics.strokeCircle(1240, 160, 34);
    graphics.strokeCircle(1295, 188, 24);
    graphics.beginPath();
    graphics.moveTo(1180, 230); graphics.lineTo(1230, 100); graphics.lineTo(1345, 230); graphics.strokePath();
  }
,
  drawToolBoard(graphics) {
    graphics.fillStyle(0x8a5d39, .85);
    graphics.fillRoundedRect(1410, 70, 175, 330, 10);
    graphics.fillStyle(0x513521, .65);
    for (let y = 92; y < 390; y += 22) {
      for (let x = 1430; x < 1575; x += 22) graphics.fillCircle(x, y, 2);
    }
    graphics.lineStyle(12, 0x47494a, 1);
    graphics.beginPath();
    graphics.moveTo(1450, 130); graphics.lineTo(1450, 265);
    graphics.moveTo(1500, 120); graphics.lineTo(1500, 275);
    graphics.moveTo(1550, 140); graphics.lineTo(1550, 270);
    graphics.strokePath();
    graphics.lineStyle(5, 0x303233, 1);
    graphics.strokeCircle(1450, 120, 20);
    graphics.strokeCircle(1500, 110, 20);
  }
,
  drawLamps(graphics) {
    graphics.lineStyle(7, 0x4b3c31, 1);
    graphics.beginPath(); graphics.moveTo(420, 0); graphics.lineTo(420, 78); graphics.strokePath();
    graphics.beginPath(); graphics.moveTo(1160, 0); graphics.lineTo(1160, 84); graphics.strokePath();
    graphics.fillStyle(0x6b4b36, 1);
    graphics.fillTriangle(350, 115, 490, 115, 450, 72);
    graphics.fillStyle(0x3f474a, 1);
    graphics.fillTriangle(1080, 126, 1240, 126, 1190, 78);
    graphics.fillStyle(0xffdca0, .25);
    graphics.fillEllipse(420, 116, 105, 18);
    graphics.fillEllipse(1160, 126, 112, 18);
  }

};
