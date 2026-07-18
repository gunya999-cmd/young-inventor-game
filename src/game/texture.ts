// @ts-nocheck
export const textureMethods = {
  createTextures() {
    if (this.textures.exists('steel-ball')) return;

    const drawBall = (ctx, size, radius) => {
      const gradient = ctx.createRadialGradient(size * .3, size * .25, 2, size / 2, size / 2, radius);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(.18, '#cbd2d4');
      gradient.addColorStop(.52, '#596166');
      gradient.addColorStop(.82, '#20262a');
      gradient.addColorStop(1, '#090b0c');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111517';
      ctx.lineWidth = 3;
      ctx.stroke();
    };
    this.makeCanvasTexture('steel-ball', 72, 72, (ctx) => drawBall(ctx, 72, 33));
    this.makeCanvasTexture('steel-ball-small', 58, 58, (ctx) => drawBall(ctx, 58, 27));

    this.makeCanvasTexture('wood-plank', 360, 52, (ctx, width, height) => {
      const wood = ctx.createLinearGradient(0, 0, 0, height);
      wood.addColorStop(0, '#d99a58');
      wood.addColorStop(.48, '#ae652f');
      wood.addColorStop(1, '#633117');
      ctx.fillStyle = '#252b2e';
      ctx.fillRect(0, 4, width, height - 8);
      ctx.fillStyle = wood;
      ctx.fillRect(12, 8, width - 24, height - 16);
      ctx.strokeStyle = '#452515';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 8, width - 24, height - 16);
      ctx.strokeStyle = 'rgba(72,31,10,.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(24, 25);
      ctx.bezierCurveTo(115, 12, 245, 39, width - 25, 23);
      ctx.stroke();
      for (const x of [22, width - 22]) {
        ctx.fillStyle = '#aeb4b5';
        ctx.beginPath();
        ctx.arc(x, height / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.makeCanvasTexture('bucket', 150, 130, (ctx) => {
      ctx.strokeStyle = '#242a2d';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(75, 35, 50, Math.PI, 0);
      ctx.stroke();
      const metal = ctx.createLinearGradient(25, 30, 125, 110);
      metal.addColorStop(0, '#30373a');
      metal.addColorStop(.28, '#d4d7d6');
      metal.addColorStop(.56, '#656d70');
      metal.addColorStop(.82, '#e0e1de');
      metal.addColorStop(1, '#292f32');
      ctx.fillStyle = metal;
      ctx.beginPath();
      ctx.moveTo(24, 38);
      ctx.lineTo(126, 38);
      ctx.lineTo(112, 116);
      ctx.quadraticCurveTo(75, 127, 38, 116);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#252a2c';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(42, 55);
      ctx.lineTo(108, 55);
      ctx.stroke();
    });

    this.makeCanvasTexture('gate', 112, 220, (ctx, width, height) => {
      const metal = ctx.createLinearGradient(0, 0, width, 0);
      metal.addColorStop(0, '#171d20');
      metal.addColorStop(.26, '#70797d');
      metal.addColorStop(.52, '#22292c');
      metal.addColorStop(.78, '#8c9496');
      metal.addColorStop(1, '#151a1d');
      ctx.fillStyle = metal;
      ctx.fillRect(8, 3, width - 16, height - 6);
      ctx.strokeStyle = '#0c1012';
      ctx.lineWidth = 6;
      ctx.strokeRect(8, 3, width - 16, height - 6);
      ctx.fillStyle = '#9a5b2b';
      ctx.fillRect(22, 45, width - 44, height - 72);
      ctx.strokeStyle = '#482918';
      ctx.lineWidth = 4;
      ctx.strokeRect(22, 45, width - 44, height - 72);
      ctx.fillStyle = '#c4c9ca';
      for (const x of [26, width - 26]) {
        for (const y of [20, height - 20]) {
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    });

    this.makeCanvasTexture('lever', 520, 74, (ctx, width, height) => {
      ctx.fillStyle = '#20272b';
      ctx.fillRect(4, 15, width - 8, height - 30);
      const wood = ctx.createLinearGradient(0, 0, 0, height);
      wood.addColorStop(0, '#d4934e');
      wood.addColorStop(.5, '#99572b');
      wood.addColorStop(1, '#5c3018');
      ctx.fillStyle = wood;
      ctx.fillRect(13, 20, width - 26, height - 40);
      ctx.strokeStyle = '#301a10';
      ctx.lineWidth = 4;
      ctx.strokeRect(13, 20, width - 26, height - 40);
      ctx.fillStyle = '#969ea0';
      for (const x of [28, width - 28]) {
        ctx.beginPath();
        ctx.arc(x, height / 2, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.makeCanvasTexture('counterweight', 72, 82, (ctx, width) => {
      const metal = ctx.createLinearGradient(0, 0, width, 0);
      metal.addColorStop(0, '#15181a');
      metal.addColorStop(.45, '#858b8e');
      metal.addColorStop(.62, '#303537');
      metal.addColorStop(1, '#101214');
      ctx.fillStyle = metal;
      ctx.beginPath();
      ctx.moveTo(22, 4); ctx.lineTo(50, 4); ctx.lineTo(54, 16); ctx.lineTo(64, 23);
      ctx.lineTo(70, 77); ctx.lineTo(2, 77); ctx.lineTo(8, 23); ctx.lineTo(18, 16);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#080a0b'; ctx.lineWidth = 4; ctx.stroke();
    });

    this.makeCanvasTexture('hammer', 124, 340, (ctx, width) => {
      ctx.fillStyle = '#7d4b28';
      ctx.fillRect(53, 18, 18, 245);
      ctx.strokeStyle = '#372116'; ctx.lineWidth = 4; ctx.strokeRect(53, 18, 18, 245);
      const steel = ctx.createLinearGradient(10, 0, width - 10, 0);
      steel.addColorStop(0, '#171d20'); steel.addColorStop(.28, '#7f878a');
      steel.addColorStop(.52, '#292f32'); steel.addColorStop(.76, '#8c9294'); steel.addColorStop(1, '#151a1c');
      ctx.fillStyle = steel; ctx.fillRect(13, 248, width - 26, 72);
      ctx.strokeStyle = '#0b0e10'; ctx.lineWidth = 6; ctx.strokeRect(13, 248, width - 26, 72);
      ctx.fillStyle = '#a83527'; ctx.fillRect(7, 251, 18, 66); ctx.fillRect(width - 25, 251, 18, 66);
      ctx.fillStyle = '#1b2022'; ctx.beginPath(); ctx.arc(width / 2, 17, 14, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8b9497'; ctx.lineWidth = 4; ctx.stroke();
    });

    this.makeCanvasTexture('pulley', 96, 96, (ctx, width, height) => {
      const metal = ctx.createRadialGradient(37, 29, 4, width / 2, height / 2, 46);
      metal.addColorStop(0, '#c4cbcc'); metal.addColorStop(.2, '#4a5255');
      metal.addColorStop(.48, '#151a1d'); metal.addColorStop(.7, '#7c8487');
      metal.addColorStop(.82, '#202629'); metal.addColorStop(1, '#090c0e');
      ctx.fillStyle = metal; ctx.beginPath(); ctx.arc(48, 48, 45, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0b0e10'; ctx.lineWidth = 5; ctx.stroke();
      ctx.fillStyle = '#bd7a31'; ctx.beginPath(); ctx.arc(48, 48, 10, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#362214'; ctx.lineWidth = 3; ctx.stroke();
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
