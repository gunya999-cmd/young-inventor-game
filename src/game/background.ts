// @ts-nocheck
import { WORLD_WIDTH, WORLD_HEIGHT, FLOOR_Y } from './ui';

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

export const backgroundMethods = {
  createWorkshopBackground() {
    if (!this.textures.exists('workshop-background-v2')) {
      this.makeCanvasTexture('workshop-background-v2', WORLD_WIDTH, WORLD_HEIGHT, (ctx) => {
        const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
        wall.addColorStop(0, '#e6d8c6');
        wall.addColorStop(.58, '#cbb69d');
        wall.addColorStop(1, '#a98d70');
        ctx.fillStyle = wall;
        ctx.fillRect(0, 0, WORLD_WIDTH, FLOOR_Y);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(106,78,56,.16)';
        for (let y = 56; y < FLOOR_Y; y += 52) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(WORLD_WIDTH, y);
          ctx.stroke();
          const offset = Math.floor(y / 52) % 2 ? 66 : 0;
          for (let x = offset; x < WORLD_WIDTH; x += 132) {
            ctx.beginPath();
            ctx.moveTo(x, y - 52);
            ctx.lineTo(x, y);
            ctx.stroke();
          }
        }

        ctx.save();
        ctx.shadowColor = 'rgba(28,18,11,.32)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 13;
        roundedRect(ctx, 34, 28, 250, 430, 94);
        ctx.fillStyle = '#715846';
        ctx.fill();
        ctx.restore();

        const sky = ctx.createLinearGradient(40, 40, 270, 445);
        sky.addColorStop(0, '#e7f6ff');
        sky.addColorStop(.48, '#b8d9e9');
        sky.addColorStop(1, '#8ab6c9');
        roundedRect(ctx, 48, 42, 222, 402, 82);
        ctx.fillStyle = sky;
        ctx.fill();
        ctx.strokeStyle = '#6f5746';
        ctx.lineWidth = 12;
        ctx.stroke();

        ctx.fillStyle = 'rgba(89,145,82,.38)';
        ctx.beginPath(); ctx.arc(78, 403, 76, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(225, 414, 92, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#755b49';
        ctx.lineWidth = 8;
        [120, 202].forEach((x) => { ctx.beginPath(); ctx.moveTo(x, 48); ctx.lineTo(x, 440); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(50, 210); ctx.lineTo(268, 210); ctx.stroke();

        const drawShelf = (x, y, width) => {
          ctx.save();
          ctx.shadowColor = 'rgba(42,25,13,.32)';
          ctx.shadowBlur = 14;
          ctx.shadowOffsetY = 9;
          const wood = ctx.createLinearGradient(0, y, 0, y + 22);
          wood.addColorStop(0, '#a8733e');
          wood.addColorStop(.55, '#7a4825');
          wood.addColorStop(1, '#4b2a16');
          ctx.fillStyle = wood;
          ctx.fillRect(x, y, width, 22);
          ctx.restore();
          ctx.fillStyle = '#4b382b';
          ctx.fillRect(x + 18, y + 22, 13, 30);
          ctx.fillRect(x + width - 31, y + 22, 13, 30);
        };
        drawShelf(320, 184, 305);
        drawShelf(325, 406, 275);

        const crate = (x, y, w, h, c1, c2) => {
          const g = ctx.createLinearGradient(x, y, x, y + h);
          g.addColorStop(0, c1); g.addColorStop(1, c2);
          ctx.fillStyle = g;
          roundedRect(ctx, x, y, w, h, 7); ctx.fill();
          ctx.strokeStyle = 'rgba(45,30,20,.35)'; ctx.lineWidth = 3; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.fillRect(x + 8, y + 8, w - 16, 5);
        };
        crate(348, 126, 75, 55, '#6d8265', '#455747');
        crate(447, 145, 58, 36, '#c36a47', '#8a3e2c');
        crate(525, 139, 68, 42, '#c79c63', '#93643a');
        crate(356, 350, 82, 53, '#ba8148', '#7b4c27');
        crate(470, 363, 68, 40, '#87715c', '#5e4b3b');

        ctx.save();
        ctx.shadowColor = 'rgba(23,18,14,.25)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 8;
        const blue = ctx.createLinearGradient(1115, 55, 1385, 276);
        blue.addColorStop(0, '#497f9b'); blue.addColorStop(1, '#28546e');
        ctx.fillStyle = blue; ctx.fillRect(1115, 55, 270, 220);
        ctx.restore();
        ctx.strokeStyle = 'rgba(211,236,242,.17)'; ctx.lineWidth = 1;
        for (let x = 1130; x < 1385; x += 20) { ctx.beginPath(); ctx.moveTo(x,55); ctx.lineTo(x,275); ctx.stroke(); }
        for (let y = 70; y < 275; y += 20) { ctx.beginPath(); ctx.moveTo(1115,y); ctx.lineTo(1385,y); ctx.stroke(); }
        ctx.strokeStyle = 'rgba(220,243,247,.55)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(1230,155,32,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.arc(1290,188,22,0,Math.PI*2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(1170,230); ctx.lineTo(1220,100); ctx.lineTo(1340,230); ctx.stroke();

        ctx.fillStyle = '#8a5a36'; roundedRect(ctx, 1415, 70, 165, 320, 10); ctx.fill();
        ctx.fillStyle = 'rgba(73,45,28,.55)';
        for (let y = 92; y < 378; y += 22) for (let x = 1435; x < 1568; x += 22) { ctx.beginPath(); ctx.arc(x,y,2,0,Math.PI*2); ctx.fill(); }
        ctx.strokeStyle = '#474b4d'; ctx.lineWidth = 11;
        [[1450,130,1450,260],[1500,120,1500,270],[1548,140,1548,265]].forEach((p) => { ctx.beginPath(); ctx.moveTo(p[0],p[1]); ctx.lineTo(p[2],p[3]); ctx.stroke(); });
        ctx.strokeStyle = '#2e3233'; ctx.lineWidth = 5;
        [1450,1500].forEach((x,i) => { ctx.beginPath(); ctx.arc(x,118-i*8,19,0,Math.PI*2); ctx.stroke(); });

        const lamp = (x, cable, shade, warm) => {
          ctx.strokeStyle = '#4b3d33'; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,cable); ctx.stroke();
          const g = ctx.createLinearGradient(x-shade, cable, x+shade, cable+48);
          g.addColorStop(0, warm ? '#8b5a38' : '#3d464a');
          g.addColorStop(.5, warm ? '#5b3927' : '#22292c');
          g.addColorStop(1, '#1d1c1b');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(x-shade,cable+47); ctx.lineTo(x+shade,cable+47); ctx.lineTo(x+shade*.48,cable+5); ctx.lineTo(x-shade*.48,cable+5); ctx.closePath(); ctx.fill();
          ctx.fillStyle = 'rgba(255,221,160,.3)'; ctx.beginPath(); ctx.ellipse(x,cable+47,shade*.75,10,0,0,Math.PI*2); ctx.fill();
        };
        lamp(420,68,72,true);
        lamp(1160,72,82,false);

        const floor = ctx.createLinearGradient(0, FLOOR_Y - 18, 0, WORLD_HEIGHT);
        floor.addColorStop(0, '#b07842');
        floor.addColorStop(.12, '#80502e');
        floor.addColorStop(.18, '#3a2b23');
        floor.addColorStop(1, '#111314');
        ctx.fillStyle = floor;
        ctx.fillRect(0, FLOOR_Y - 18, WORLD_WIDTH, WORLD_HEIGHT - FLOOR_Y + 18);
        ctx.fillStyle = '#17191a';
        ctx.fillRect(0, FLOOR_Y + 108, WORLD_WIDTH, 132);
        ctx.strokeStyle = '#0d0f10'; ctx.lineWidth = 8;
        for (let x = 18; x < WORLD_WIDTH; x += 278) {
          ctx.strokeRect(x, FLOOR_Y + 28, 230, 93);
          ctx.beginPath(); ctx.moveTo(x+14,FLOOR_Y+38); ctx.lineTo(x+216,FLOOR_Y+112); ctx.moveTo(x+216,FLOOR_Y+38); ctx.lineTo(x+14,FLOOR_Y+112); ctx.stroke();
        }

        const vignette = ctx.createRadialGradient(800,400,240,800,430,980);
        vignette.addColorStop(0,'rgba(255,255,255,0)');
        vignette.addColorStop(.75,'rgba(48,29,16,.06)');
        vignette.addColorStop(1,'rgba(20,13,9,.32)');
        ctx.fillStyle = vignette; ctx.fillRect(0,0,WORLD_WIDTH,WORLD_HEIGHT);

        const sunlight = ctx.createLinearGradient(0,120,610,680);
        sunlight.addColorStop(0,'rgba(255,245,207,.22)');
        sunlight.addColorStop(1,'rgba(255,245,207,0)');
        ctx.fillStyle = sunlight;
        ctx.beginPath(); ctx.moveTo(0,100); ctx.lineTo(0,690); ctx.lineTo(620,690); ctx.closePath(); ctx.fill();
      });
    }

    this.add.image(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, 'workshop-background-v2').setDepth(-40);
  }
};
