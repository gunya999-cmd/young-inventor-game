// @ts-nocheck

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

function bolt(ctx, x, y, radius = 6) {
  const g = ctx.createRadialGradient(x - radius * .35, y - radius * .35, 1, x, y, radius);
  g.addColorStop(0, '#f1f3f2');
  g.addColorStop(.35, '#aeb5b6');
  g.addColorStop(.72, '#596164');
  g.addColorStop(1, '#202426');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111516'; ctx.lineWidth = 2; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x-radius*.55,y); ctx.lineTo(x+radius*.55,y); ctx.stroke();
}

function woodFill(ctx, x, y, width, height) {
  const wood = ctx.createLinearGradient(0, y, 0, y + height);
  wood.addColorStop(0, '#e2aa68');
  wood.addColorStop(.18, '#c47a3e');
  wood.addColorStop(.55, '#a45d2c');
  wood.addColorStop(.82, '#7b3f1f');
  wood.addColorStop(1, '#542913');
  ctx.fillStyle = wood;
  roundedRect(ctx, x, y, width, height, Math.min(8, height * .22));
  ctx.fill();
  ctx.strokeStyle = '#3e2112'; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = 'rgba(84,38,15,.45)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const yy = y + height * (.25 + i * .22);
    ctx.beginPath();
    ctx.moveTo(x + 18, yy);
    ctx.bezierCurveTo(x + width * .28, yy - 7 + i * 2, x + width * .64, yy + 8 - i * 2, x + width - 18, yy - 1);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x + 10, y + 7); ctx.lineTo(x + width - 10, y + 7); ctx.stroke();
}

export const textureMethods = {
  createTextures() {
    if (this.textures.exists('steel-ball-v2')) return;

    const drawBall = (ctx, size, radius) => {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
      const gradient = ctx.createRadialGradient(size * .29, size * .23, 1, size / 2, size / 2, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.12, '#dce2e3');
      gradient.addColorStop(.35, '#8e999d');
      gradient.addColorStop(.58, '#444d51');
      gradient.addColorStop(.82, '#171c1f');
      gradient.addColorStop(1, '#07090a');
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#111517'; ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(size/2,size/2,radius-5,Math.PI*1.05,Math.PI*1.7); ctx.stroke();
    };
    this.makeCanvasTexture('steel-ball-v2', 76, 76, (ctx) => drawBall(ctx, 76, 34));
    this.makeCanvasTexture('steel-ball-small-v2', 62, 62, (ctx) => drawBall(ctx, 62, 27));

    this.makeCanvasTexture('wood-plank-v2', 380, 62, (ctx, width, height) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
      ctx.fillStyle = '#22272a'; roundedRect(ctx, 2, 7, width - 4, height - 14, 8); ctx.fill();
      ctx.restore();
      woodFill(ctx, 12, 10, width - 24, height - 20);
      ctx.fillStyle = '#343a3d';
      roundedRect(ctx, 3, 14, 34, height - 28, 5); ctx.fill();
      roundedRect(ctx, width - 37, 14, 34, height - 28, 5); ctx.fill();
      ctx.strokeStyle = '#111516'; ctx.lineWidth = 3;
      roundedRect(ctx, 3, 14, 34, height - 28, 5); ctx.stroke();
      roundedRect(ctx, width - 37, 14, 34, height - 28, 5); ctx.stroke();
      bolt(ctx, 20, height / 2, 6);
      bolt(ctx, width - 20, height / 2, 6);
    });

    this.makeCanvasTexture('bucket-v2', 150, 150, (ctx) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 8;
      const metal = ctx.createLinearGradient(22, 30, 130, 120);
      metal.addColorStop(0, '#343a3c'); metal.addColorStop(.18, '#e5e7e5'); metal.addColorStop(.38, '#7f888b');
      metal.addColorStop(.58, '#3d4447'); metal.addColorStop(.78, '#d5d8d6'); metal.addColorStop(1, '#252b2d');
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(22,45); ctx.lineTo(128,45); ctx.lineTo(112,132); ctx.quadraticCurveTo(75,143,38,132); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = '#22282a'; ctx.lineWidth = 6; ctx.stroke();
      ctx.strokeStyle = '#22282a'; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(75,45,52,Math.PI,0); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(38,58); ctx.lineTo(112,58); ctx.stroke();
      ctx.fillStyle = '#22282a'; ctx.fillRect(18,39,114,11);
      ctx.fillStyle = '#858e91'; ctx.fillRect(24,42,102,4);
    });

    this.makeCanvasTexture('gate-v2', 100, 188, (ctx, width, height) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
      const frame = ctx.createLinearGradient(0, 0, width, 0);
      frame.addColorStop(0, '#161b1e'); frame.addColorStop(.24, '#7b8588'); frame.addColorStop(.48, '#292f32'); frame.addColorStop(.75, '#899194'); frame.addColorStop(1, '#111517');
      ctx.fillStyle = frame; roundedRect(ctx, 3, 3, width - 6, height - 6, 7); ctx.fill();
      ctx.restore();
      woodFill(ctx, 17, 29, width - 34, height - 48);
      ctx.fillStyle = '#242a2d'; ctx.fillRect(7, 10, width - 14, 19); ctx.fillRect(7, height - 28, width - 14, 19);
      for (const x of [18, width - 18]) for (const y of [19, height - 19]) bolt(ctx, x, y, 5);
    });

    this.makeCanvasTexture('lever-v2', 440, 64, (ctx, width, height) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.38)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
      ctx.fillStyle = '#22282b'; roundedRect(ctx, 2, 8, width - 4, height - 16, 8); ctx.fill();
      ctx.restore();
      woodFill(ctx, 12, 12, width - 24, height - 24);
      ctx.fillStyle = '#343a3d'; roundedRect(ctx, 3, 14, 35, height - 28, 5); ctx.fill(); roundedRect(ctx, width - 38, 14, 35, height - 28, 5); ctx.fill();
      bolt(ctx, 20, height / 2, 6); bolt(ctx, width - 20, height / 2, 6);
    });

    this.makeCanvasTexture('counterweight-v2', 78, 90, (ctx, width, height) => {
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 7;
      const metal = ctx.createLinearGradient(0,0,width,0);
      metal.addColorStop(0,'#111416'); metal.addColorStop(.28,'#747c7f'); metal.addColorStop(.48,'#b3b8b9'); metal.addColorStop(.62,'#3b4143'); metal.addColorStop(1,'#101214');
      ctx.fillStyle = metal;
      ctx.beginPath(); ctx.moveTo(24,4); ctx.lineTo(54,4); ctx.lineTo(58,16); ctx.lineTo(69,24); ctx.lineTo(75,height-5); ctx.lineTo(3,height-5); ctx.lineTo(9,24); ctx.lineTo(20,16); ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle='#080a0b';ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.25)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(20,25);ctx.lineTo(15,height-14);ctx.stroke();
    });

    this.makeCanvasTexture('hammer-v2', 136, 340, (ctx, width) => {
      ctx.save(); ctx.shadowColor='rgba(0,0,0,.38)';ctx.shadowBlur=10;ctx.shadowOffsetY=8;
      woodFill(ctx, 56, 16, 24, 246);
      ctx.restore();
      const steel=ctx.createLinearGradient(9,0,width-9,0);
      steel.addColorStop(0,'#13181b');steel.addColorStop(.22,'#8a9396');steel.addColorStop(.45,'#333a3d');steel.addColorStop(.68,'#9da4a6');steel.addColorStop(1,'#151a1d');
      ctx.fillStyle=steel;roundedRect(ctx,13,247,width-26,74,9);ctx.fill();
      ctx.strokeStyle='#0b0e10';ctx.lineWidth=6;ctx.stroke();
      const red=ctx.createLinearGradient(0,247,0,321);red.addColorStop(0,'#e05b43');red.addColorStop(.55,'#a62f25');red.addColorStop(1,'#6f1c18');
      ctx.fillStyle=red;roundedRect(ctx,5,252,22,64,5);ctx.fill();roundedRect(ctx,width-27,252,22,64,5);ctx.fill();
      ctx.strokeStyle='#49140f';ctx.lineWidth=3;roundedRect(ctx,5,252,22,64,5);ctx.stroke();roundedRect(ctx,width-27,252,22,64,5);ctx.stroke();
      const pivot=ctx.createRadialGradient(width/2-4,14,2,width/2,17,16);pivot.addColorStop(0,'#d8dddd');pivot.addColorStop(.35,'#626a6d');pivot.addColorStop(1,'#14191b');
      ctx.fillStyle=pivot;ctx.beginPath();ctx.arc(width/2,17,15,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#0d1113';ctx.lineWidth=4;ctx.stroke();
    });

    this.makeCanvasTexture('pulley-v2', 104, 104, (ctx, width, height) => {
      ctx.save();ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=10;ctx.shadowOffsetY=7;
      const metal=ctx.createRadialGradient(39,31,4,width/2,height/2,49);
      metal.addColorStop(0,'#d4d9da');metal.addColorStop(.16,'#687174');metal.addColorStop(.34,'#171c1f');metal.addColorStop(.53,'#899194');metal.addColorStop(.7,'#252b2e');metal.addColorStop(.87,'#697174');metal.addColorStop(1,'#090c0e');
      ctx.fillStyle=metal;ctx.beginPath();ctx.arc(width/2,height/2,48,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.strokeStyle='#0a0d0f';ctx.lineWidth=6;ctx.stroke();
      ctx.strokeStyle='#151a1c';ctx.lineWidth=9;ctx.beginPath();ctx.arc(width/2,height/2,34,0,Math.PI*2);ctx.stroke();
      const axle=ctx.createRadialGradient(46,44,2,52,52,12);axle.addColorStop(0,'#ffd184');axle.addColorStop(.3,'#c38332');axle.addColorStop(1,'#4d2b12');
      ctx.fillStyle=axle;ctx.beginPath();ctx.arc(52,52,12,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#2d1a0d';ctx.lineWidth=3;ctx.stroke();
    });

    this.makeCanvasTexture('bell-v2', 138, 170, (ctx, width) => {
      ctx.save();ctx.shadowColor='rgba(0,0,0,.38)';ctx.shadowBlur=10;ctx.shadowOffsetY=7;
      const gold=ctx.createLinearGradient(18,20,width-18,145);
      gold.addColorStop(0,'#6f3d0e');gold.addColorStop(.18,'#ffd76f');gold.addColorStop(.42,'#d89a24');gold.addColorStop(.62,'#fff0a1');gold.addColorStop(.82,'#b96d13');gold.addColorStop(1,'#5b3009');
      ctx.fillStyle=gold;
      ctx.beginPath();ctx.moveTo(69,22);ctx.bezierCurveTo(34,26,29,70,24,116);ctx.quadraticCurveTo(14,123,9,135);ctx.quadraticCurveTo(69,156,129,135);ctx.quadraticCurveTo(124,123,114,116);ctx.bezierCurveTo(109,70,104,26,69,22);ctx.closePath();ctx.fill();
      ctx.restore();
      ctx.strokeStyle='#69400e';ctx.lineWidth=5;ctx.stroke();
      ctx.fillStyle='#9a5b12';ctx.beginPath();ctx.ellipse(69,136,61,17,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#5a3309';ctx.lineWidth=4;ctx.stroke();
      ctx.fillStyle='#d8911f';ctx.beginPath();ctx.arc(69,157,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#70400c';ctx.lineWidth=3;ctx.stroke();
      ctx.fillStyle='#805015';ctx.beginPath();ctx.arc(69,15,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#4d2c0a';ctx.lineWidth=4;ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(48,39);ctx.bezierCurveTo(36,68,36,95,31,115);ctx.stroke();
    });

    this.makeCanvasTexture('bearing-v2', 70, 70, (ctx) => {
      const g=ctx.createRadialGradient(25,20,2,35,35,33);g.addColorStop(0,'#e3e7e7');g.addColorStop(.22,'#6d7679');g.addColorStop(.5,'#171c1e');g.addColorStop(.72,'#858d90');g.addColorStop(1,'#0b0e10');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(35,35,32,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#090c0d';ctx.lineWidth=5;ctx.stroke();
      ctx.fillStyle='#2a3032';ctx.beginPath();ctx.arc(35,35,13,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b47a30';ctx.lineWidth=4;ctx.stroke();
    });
  },

  makeCanvasTexture(key, width, height, painter) {
    const texture = this.textures.createCanvas(key, width, height);
    const context = texture.context;
    context.clearRect(0, 0, width, height);
    painter(context, width, height);
    texture.refresh();
  }
};
