type DragMode = 'move' | 'rotate' | null;

export function installScissors2DLab(): void {
  document.documentElement.classList.add('scissors-2d-mode');
  document.body.classList.add('scissors-2d-mode');

  const style = document.createElement('style');
  style.textContent = `
    html.scissors-2d-mode, body.scissors-2d-mode { margin:0; min-height:100%; overflow:hidden; background:#14171a; font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    body.scissors-2d-mode > :not(.scissors2d-lab):not(#fatal-error) { display:none !important; }
    .scissors2d-lab { position:fixed; inset:0; display:grid; grid-template-rows:64px 1fr; color:#f5f6f7; background:#171a1e; }
    .scissors2d-topbar { display:flex; align-items:center; justify-content:space-between; gap:18px; padding:0 22px; border-bottom:1px solid rgba(255,255,255,.09); background:rgba(9,11,13,.9); z-index:50; }
    .scissors2d-title small { display:block; color:#9ca6ad; font-size:11px; letter-spacing:.16em; margin-bottom:3px; }
    .scissors2d-title strong { font-size:20px; font-weight:780; }
    .scissors2d-badges { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .scissors2d-badges span { padding:6px 9px; border-radius:999px; font-size:11px; color:#c7cdd1; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.035); }
    .scissors2d-stage { position:relative; min-height:0; overflow:hidden; touch-action:none; user-select:none; background:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px),radial-gradient(circle at 50% 44%,#5a554e 0%,#413d38 42%,#2d2a27 78%,#242220 100%); background-size:42px 42px,42px 42px,auto; }
    .scissors2d-stage::after { content:''; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at center,transparent 48%,rgba(0,0,0,.34) 100%); }
    .scissors2d-rope { position:absolute; top:48%; height:12px; border-radius:999px; background:repeating-linear-gradient(115deg,#ad7b45 0 8px,#d0a366 8px 14px,#84592f 14px 18px); box-shadow:0 3px 5px rgba(0,0,0,.28),inset 0 1px 1px rgba(255,255,255,.22); z-index:3; transition:top .5s cubic-bezier(.2,.8,.3,1),transform .5s cubic-bezier(.2,.8,.3,1); }
    .scissors2d-rope.left { left:5%; width:47%; }
    .scissors2d-rope.right { right:8%; width:40%; transform-origin:right center; }
    .scissors2d-rope.right.cut { top:67%; transform:rotate(19deg); }
    .scissors2d-hook { position:absolute; left:3.6%; top:calc(48% - 27px); width:46px; height:46px; border:8px solid #626b70; border-left-color:transparent; border-radius:50%; filter:drop-shadow(0 4px 3px rgba(0,0,0,.35)); z-index:4; }
    .scissors2d-weight { position:absolute; right:5.5%; top:calc(48% + 34px); width:92px; height:112px; border-radius:18px 18px 24px 24px; background:linear-gradient(145deg,#747e83,#30373b 55%,#111517); border:2px solid #9ba4a9; box-shadow:0 18px 24px rgba(0,0,0,.34),inset 0 1px 5px rgba(255,255,255,.18); color:#d3d8da; display:flex; align-items:center; justify-content:center; flex-direction:column; font-weight:800; z-index:4; transition:top .5s cubic-bezier(.2,.8,.3,1),transform .5s cubic-bezier(.2,.8,.3,1); }
    .scissors2d-weight.cut { top:71%; transform:rotate(11deg); }
    .scissors2d-weight b { font-size:27px; line-height:1; }
    .scissors2d-weight small { font-size:12px; letter-spacing:.12em; margin-top:5px; }
    .scissors2d-balloon { position:absolute; right:15%; top:15%; width:78px; height:96px; border-radius:51% 49% 48% 52%/56% 56% 44% 44%; background:radial-gradient(circle at 32% 25%,#ff9b9b 0 5%,#d83239 20%,#9e1018 74%,#630a0f 100%); box-shadow:inset -9px -13px 16px rgba(0,0,0,.26),0 18px 28px rgba(0,0,0,.2); z-index:2; }
    .scissors2d-balloon::after { content:''; position:absolute; left:50%; top:94px; width:1px; height:118px; background:rgba(220,220,220,.6); }
    .scissors2d-assembly { position:absolute; width:min(62vw,720px); aspect-ratio:900/520; left:50%; top:48%; transform-origin:48.9% 50%; cursor:grab; z-index:20; will-change:left,top,transform; }
    .scissors2d-assembly.dragging { cursor:grabbing; }
    .scissors2d-svg { position:absolute; inset:0; width:100%; height:100%; overflow:visible; filter:drop-shadow(0 18px 15px rgba(0,0,0,.28)); pointer-events:none; }
    .scissors2d-upper,.scissors2d-lower { transition:transform .31s cubic-bezier(.24,.86,.28,1); transform-origin:440px 260px; transform-box:view-box; }
    .scissors2d-assembly.closed .scissors2d-upper { transform:rotate(24deg); }
    .scissors2d-assembly.closed .scissors2d-lower { transform:rotate(-24deg); }
    .scissors2d-select { position:absolute; inset:4% 3%; border:1.5px dashed rgba(255,219,93,.9); border-radius:18px; pointer-events:none; }
    .scissors2d-knob { position:absolute; left:48.9%; top:-18%; width:46px; height:46px; border-radius:50%; transform:translate(-50%,-50%); display:grid; place-items:center; border:2px solid #ffe173; background:rgba(21,24,26,.95); color:#ffe173; font-size:24px; z-index:12; cursor:crosshair; box-shadow:0 8px 18px rgba(0,0,0,.32); touch-action:none; }
    .scissors2d-knob::after { content:''; position:absolute; left:50%; top:44px; height:72px; border-left:1px dashed rgba(255,225,115,.75); }
    .scissors2d-cut-zone { position:absolute; left:7%; top:33%; width:40%; height:34%; border:2px dashed rgba(255,209,68,.78); border-radius:50%; opacity:.36; pointer-events:none; transition:opacity .25s,transform .31s; }
    .scissors2d-assembly.closed .scissors2d-cut-zone { opacity:.92; transform:scale(.78); }
    .scissors2d-controls { position:absolute; left:50%; bottom:24px; transform:translateX(-50%); display:flex; gap:10px; z-index:40; }
    .scissors2d-controls button { border:1px solid rgba(255,255,255,.14); background:rgba(14,17,19,.94); color:#f5f6f7; padding:12px 17px; min-width:148px; border-radius:12px; font-size:14px; font-weight:760; cursor:pointer; box-shadow:0 8px 24px rgba(0,0,0,.26); }
    .scissors2d-controls button.primary { color:#181b1e; background:#f3c94c; border-color:#ffe17a; }
    .scissors2d-hint { position:absolute; left:22px; bottom:24px; max-width:320px; padding:12px 14px; border-radius:12px; color:#c7cdd1; background:rgba(14,17,19,.75); border:1px solid rgba(255,255,255,.08); font-size:12px; line-height:1.45; z-index:30; }
    .scissors2d-status { position:absolute; right:22px; bottom:24px; min-width:200px; padding:11px 14px; border-radius:12px; background:rgba(14,17,19,.8); border:1px solid rgba(255,255,255,.08); color:#d9dde0; z-index:30; font-size:12px; line-height:1.5; }
    .scissors2d-spark { position:absolute; left:51.5%; top:48%; width:7px; height:7px; border-radius:50%; background:#ffe57c; box-shadow:20px -16px 0 -1px #fff4bc,32px 4px 0 -2px #ffe57c,9px 22px 0 -1px #fff,-15px 14px 0 -2px #ffd24f,-8px -19px 0 -2px #fff; opacity:0; z-index:24; pointer-events:none; }
    .scissors2d-spark.flash { animation:scissorsSpark .42s ease-out; }
    @keyframes scissorsSpark { 0%{opacity:0;transform:scale(.2)} 24%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(1.9)} }
    @media(max-width:760px){ .scissors2d-lab{grid-template-rows:58px 1fr}.scissors2d-topbar{padding:0 12px}.scissors2d-title strong{font-size:16px}.scissors2d-badges span:nth-child(n+3){display:none}.scissors2d-assembly{width:min(92vw,680px)}.scissors2d-hint{display:none}.scissors2d-status{right:10px;bottom:82px}.scissors2d-controls{bottom:16px;width:calc(100% - 20px)}.scissors2d-controls button{flex:1;min-width:0} }
  `;
  document.head.appendChild(style);

  const root = document.createElement('section');
  root.className = 'scissors2d-lab';
  root.innerHTML = `
    <header class="scissors2d-topbar">
      <div class="scissors2d-title"><small>CLASSIC PART 20 · PLAYABLE 2.5D TEST</small><strong>Scissors / Ножницы</strong></div>
      <div class="scissors2d-badges"><span>vector 2.5D</span><span>drag + rotate</span><span>layered hinge</span><span>no free 3D camera</span></div>
    </header>
    <div class="scissors2d-stage">
      <div class="scissors2d-hook"></div>
      <div class="scissors2d-rope left"></div>
      <div class="scissors2d-rope right"></div>
      <div class="scissors2d-weight"><b>10</b><small>KG</small></div>
      <div class="scissors2d-balloon"></div>
      <div class="scissors2d-spark"></div>

      <div class="scissors2d-assembly" aria-label="Interactive layered 2.5D scissors">
        <svg class="scissors2d-svg" viewBox="0 0 900 520" role="img" aria-label="2.5D scissors">
          <defs>
            <linearGradient id="steel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7fafb"/><stop offset=".16" stop-color="#a9b3b9"/><stop offset=".34" stop-color="#f2f5f6"/><stop offset=".58" stop-color="#747f86"/><stop offset=".82" stop-color="#dce2e5"/><stop offset="1" stop-color="#5c676d"/></linearGradient>
            <linearGradient id="steelEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="#bec8cd"/><stop offset=".62" stop-color="#465158"/><stop offset="1" stop-color="#eef2f4"/></linearGradient>
            <linearGradient id="red" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="#ff5358"/><stop offset=".25" stop-color="#e11e2b"/><stop offset=".58" stop-color="#980c16"/><stop offset=".78" stop-color="#f1343d"/><stop offset="1" stop-color="#69070d"/></linearGradient>
            <radialGradient id="rubber"><stop offset="0" stop-color="#343b3f"/><stop offset=".65" stop-color="#101416"/><stop offset="1" stop-color="#030506"/></radialGradient>
            <radialGradient id="pivot"><stop offset="0" stop-color="#ffffff"/><stop offset=".32" stop-color="#b8c0c4"/><stop offset=".57" stop-color="#465057"/><stop offset=".76" stop-color="#e7ecee"/><stop offset="1" stop-color="#242a2e"/></radialGradient>
            <filter id="innerShadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="8" flood-color="#000" flood-opacity=".35"/></filter>
          </defs>

          <g class="scissors2d-lower">
            <path d="M444 263 C350 270 220 300 72 347 C55 352 49 363 69 363 C225 354 355 326 458 294 Z" fill="url(#steel)" stroke="#22292d" stroke-width="7" stroke-linejoin="round"/>
            <path d="M88 348 C225 336 348 309 438 282" fill="none" stroke="rgba(255,255,255,.68)" stroke-width="5" stroke-linecap="round"/>
            <path d="M425 274 C493 295 535 324 567 350 L610 389 L556 435 L510 392 C479 362 447 334 403 308 Z" fill="url(#red)" stroke="#65080e" stroke-width="8" stroke-linejoin="round"/>
            <ellipse cx="682" cy="397" rx="168" ry="105" fill="url(#red)" stroke="#65080e" stroke-width="9" filter="url(#innerShadow)"/>
            <ellipse cx="686" cy="398" rx="101" ry="58" fill="url(#rubber)" stroke="#2a2f32" stroke-width="10"/>
            <path d="M575 356 C620 332 734 319 800 354" fill="none" stroke="rgba(255,255,255,.22)" stroke-width="12" stroke-linecap="round"/>
          </g>

          <g class="scissors2d-upper">
            <path d="M444 257 C352 245 222 201 84 133 C67 125 59 113 78 117 C229 148 360 190 458 225 Z" fill="url(#steel)" stroke="#22292d" stroke-width="7" stroke-linejoin="round"/>
            <path d="M92 129 C226 159 348 198 438 229" fill="none" stroke="rgba(255,255,255,.72)" stroke-width="5" stroke-linecap="round"/>
            <path d="M420 244 C482 226 524 202 560 173 L607 134 L660 182 L610 222 C574 250 526 277 409 276 Z" fill="url(#red)" stroke="#65080e" stroke-width="8" stroke-linejoin="round"/>
            <ellipse cx="690" cy="124" rx="165" ry="103" fill="url(#red)" stroke="#65080e" stroke-width="9" filter="url(#innerShadow)"/>
            <ellipse cx="694" cy="125" rx="99" ry="57" fill="url(#rubber)" stroke="#2a2f32" stroke-width="10"/>
            <path d="M588 168 C636 144 742 142 805 175" fill="none" stroke="rgba(255,255,255,.23)" stroke-width="12" stroke-linecap="round"/>
          </g>

          <circle cx="440" cy="260" r="43" fill="#161b1e" opacity=".9"/>
          <circle cx="440" cy="260" r="34" fill="url(#pivot)" stroke="#101416" stroke-width="6"/>
          <rect x="415" y="255" width="50" height="10" rx="5" fill="#1c2327" transform="rotate(-18 440 260)"/>
          <circle cx="430" cy="249" r="8" fill="rgba(255,255,255,.65)"/>
        </svg>
        <div class="scissors2d-cut-zone"></div>
        <div class="scissors2d-select"></div>
        <button class="scissors2d-knob" aria-label="Rotate scissors">↻</button>
      </div>

      <div class="scissors2d-hint"><b>Проверка 2.5D</b><br>Тяни ножницы — перемещение. Тяни ручку ↻ — свободное вращение в плоскости. «Сработать» вращает два независимых слоя вокруг центрального винта.</div>
      <div class="scissors2d-status"><b>Статус</b><br><span data-status>Открыты · верёвка цела</span></div>
      <div class="scissors2d-controls"><button class="primary" data-action="trigger">Сработать</button><button data-action="reset">Сбросить</button></div>
    </div>
  `;
  document.body.appendChild(root);

  const stage = root.querySelector<HTMLElement>('.scissors2d-stage')!;
  const assembly = root.querySelector<HTMLElement>('.scissors2d-assembly')!;
  const knob = root.querySelector<HTMLButtonElement>('.scissors2d-knob')!;
  const triggerButton = root.querySelector<HTMLButtonElement>('[data-action="trigger"]')!;
  const resetButton = root.querySelector<HTMLButtonElement>('[data-action="reset"]')!;
  const ropeRight = root.querySelector<HTMLElement>('.scissors2d-rope.right')!;
  const weight = root.querySelector<HTMLElement>('.scissors2d-weight')!;
  const spark = root.querySelector<HTMLElement>('.scissors2d-spark')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;

  let x = stage.clientWidth * 0.50;
  let y = stage.clientHeight * 0.48;
  let angle = 0;
  let mode: DragMode = null;
  let pointerId: number | null = null;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let rotationOffset = 0;
  let closed = false;
  let ropeCut = false;

  const setTransform = (): void => {
    assembly.style.left = `${x}px`;
    assembly.style.top = `${y}px`;
    assembly.style.transform = `translate(-48.9%, -50%) rotate(${angle}deg)`;
    assembly.dataset.angle = angle.toFixed(1);
    assembly.dataset.x = x.toFixed(1);
    assembly.dataset.y = y.toFixed(1);
  };

  const pointerAngle = (clientX: number, clientY: number): number => {
    const r = stage.getBoundingClientRect();
    return Math.atan2(clientY - r.top - y, clientX - r.left - x) * 180 / Math.PI;
  };

  const flashCut = (): void => {
    spark.classList.remove('flash');
    void spark.offsetWidth;
    spark.classList.add('flash');
  };

  const cutRope = (): void => {
    if (ropeCut) return;
    ropeCut = true;
    ropeRight.classList.add('cut');
    weight.classList.add('cut');
    flashCut();
    status.textContent = 'Закрыты · верёвка перерезана';
    assembly.dataset.ropeCut = 'true';
  };

  const trigger = (): void => {
    closed = !closed;
    assembly.classList.toggle('closed', closed);
    triggerButton.textContent = closed ? 'Открыть' : 'Сработать';
    status.textContent = closed ? (ropeCut ? 'Закрыты · верёвка перерезана' : 'Закрываются…') : (ropeCut ? 'Открыты · верёвка уже перерезана' : 'Открыты · верёвка цела');
    assembly.dataset.closed = closed ? 'true' : 'false';
    if (closed && !ropeCut) window.setTimeout(cutRope, 190);
  };

  const reset = (): void => {
    closed = false;
    ropeCut = false;
    angle = 0;
    x = stage.clientWidth * 0.50;
    y = stage.clientHeight * 0.48;
    assembly.classList.remove('closed');
    ropeRight.classList.remove('cut');
    weight.classList.remove('cut');
    triggerButton.textContent = 'Сработать';
    status.textContent = 'Открыты · верёвка цела';
    assembly.dataset.closed = 'false';
    assembly.dataset.ropeCut = 'false';
    setTransform();
  };

  assembly.addEventListener('pointerdown', (event) => {
    if ((event.target as HTMLElement).closest('.scissors2d-knob')) return;
    pointerId = event.pointerId;
    mode = 'move';
    assembly.classList.add('dragging');
    const r = stage.getBoundingClientRect();
    dragOffsetX = event.clientX - r.left - x;
    dragOffsetY = event.clientY - r.top - y;
    assembly.setPointerCapture(event.pointerId);
  });

  knob.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    event.stopPropagation();
    pointerId = event.pointerId;
    mode = 'rotate';
    rotationOffset = angle - pointerAngle(event.clientX, event.clientY);
    knob.setPointerCapture(event.pointerId);
  });

  stage.addEventListener('pointermove', (event) => {
    if (pointerId !== event.pointerId || !mode) return;
    const r = stage.getBoundingClientRect();
    if (mode === 'move') {
      x = Math.max(70, Math.min(stage.clientWidth - 70, event.clientX - r.left - dragOffsetX));
      y = Math.max(70, Math.min(stage.clientHeight - 90, event.clientY - r.top - dragOffsetY));
    } else {
      angle = pointerAngle(event.clientX, event.clientY) + rotationOffset;
    }
    setTransform();
  });

  const endPointer = (event: PointerEvent): void => {
    if (pointerId !== event.pointerId) return;
    pointerId = null;
    mode = null;
    assembly.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  triggerButton.addEventListener('click', trigger);
  resetButton.addEventListener('click', reset);

  window.addEventListener('resize', () => {
    x = Math.max(70, Math.min(stage.clientWidth - 70, x));
    y = Math.max(70, Math.min(stage.clientHeight - 90, y));
    setTransform();
  });

  assembly.dataset.visual = 'vector-2.5d-layered';
  assembly.dataset.physics = 'pivot-cut-state';
  assembly.dataset.free3d = 'false';
  assembly.dataset.closed = 'false';
  assembly.dataset.ropeCut = 'false';
  setTransform();
}
