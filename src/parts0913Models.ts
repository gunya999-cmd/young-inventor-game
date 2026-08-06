import * as THREE from 'three';

export interface ReviewAssetModel0913 {
  group: THREE.Group;
  selectionMeshes: THREE.Object3D[];
}

function makeSelectionBox(size: THREE.Vector3, opacity = 0.06): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.visible = false;
  return mesh;
}

function roundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  shape.closePath();
  return shape;
}

function roundedRectPath(width: number, height: number, radius: number): THREE.Path {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(radius, w, h);
  const path = new THREE.Path();
  path.moveTo(-w + r, -h);
  path.lineTo(w - r, -h);
  path.quadraticCurveTo(w, -h, w, -h + r);
  path.lineTo(w, h - r);
  path.quadraticCurveTo(w, h, w - r, h);
  path.lineTo(-w + r, h);
  path.quadraticCurveTo(-w, h, -w, h - r);
  path.lineTo(-w, -h + r);
  path.quadraticCurveTo(-w, -h, -w + r, -h);
  path.closePath();
  return path;
}

function extrude(shape: THREE.Shape, depth: number, bevel = 0.04): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 18,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel * 0.85
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createGloveShellShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-1.10, -0.48);
  s.quadraticCurveTo(-0.82, -0.72, -0.30, -0.70);
  s.quadraticCurveTo(0.08, -0.78, 0.48, -0.62);
  s.quadraticCurveTo(0.88, -0.48, 1.05, -0.18);
  s.quadraticCurveTo(1.22, 0.16, 1.06, 0.48);
  s.quadraticCurveTo(0.90, 0.78, 0.54, 0.91);
  s.quadraticCurveTo(0.18, 1.04, -0.22, 0.94);
  s.quadraticCurveTo(-0.56, 0.86, -0.77, 0.60);
  s.quadraticCurveTo(-0.96, 0.37, -1.03, 0.12);
  s.lineTo(-1.18, -0.08);
  s.quadraticCurveTo(-1.30, -0.28, -1.10, -0.48);
  s.closePath();
  return s;
}

function createThumbShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-0.42, -0.12);
  s.quadraticCurveTo(-0.20, -0.42, 0.10, -0.46);
  s.quadraticCurveTo(0.38, -0.47, 0.55, -0.26);
  s.quadraticCurveTo(0.66, -0.06, 0.54, 0.16);
  s.quadraticCurveTo(0.40, 0.36, 0.14, 0.34);
  s.quadraticCurveTo(-0.18, 0.31, -0.42, -0.12);
  s.closePath();
  return s;
}

export function createBoxingGloveModel(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'boxing-glove-3d';
  group.userData.assetVersion = 'boxing-glove-v1';
  group.userData.sourceKey = 'opengameart-boxing-gloves-cc0';
  group.userData.snapPoints = [{ id: 'impact', position: [1.08, 0.20, 0] }];

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xc9343f,
    metalness: 0,
    roughness: 0.54,
    clearcoat: 0.12,
    clearcoatRoughness: 0.72,
    sheen: 0.16,
    sheenRoughness: 0.78,
    sheenColor: new THREE.Color(0xffaca9)
  });
  const darkLeather = new THREE.MeshPhysicalMaterial({
    color: 0x8f202c,
    metalness: 0,
    roughness: 0.62,
    clearcoat: 0.06,
    clearcoatRoughness: 0.82
  });

  const shell = new THREE.Mesh(extrude(createGloveShellShape(), 0.78, 0.085), leather);
  shell.rotation.x = -0.08;
  shell.rotation.y = -0.08;
  shell.name = 'BoxingGloveContinuousShell';
  group.add(shell);

  const thumb = new THREE.Mesh(extrude(createThumbShape(), 0.56, 0.07), leather);
  thumb.position.set(0.02, -0.58, 0.16);
  thumb.rotation.z = -0.42;
  thumb.rotation.x = 0.12;
  thumb.name = 'BoxingGloveThumb';
  group.add(thumb);

  const cuffShape = roundedRectShape(0.78, 0.70, 0.19);
  const cuff = new THREE.Mesh(extrude(cuffShape, 0.84, 0.055), darkLeather);
  cuff.position.set(-1.32, -0.08, -0.01);
  cuff.rotation.z = -0.03;
  cuff.name = 'BoxingGloveCuff';
  group.add(cuff);

  const seamMaterial = new THREE.MeshStandardMaterial({ color: 0xe6c3b8, roughness: 0.78, metalness: 0 });
  const seamCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.78, -0.52, 0.40),
    new THREE.Vector3(-0.20, -0.63, 0.43),
    new THREE.Vector3(0.34, -0.50, 0.42),
    new THREE.Vector3(0.78, -0.21, 0.37)
  ]);
  const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 40, 0.018, 6, false), seamMaterial);
  seam.name = 'BoxingGlovePalmSeam';
  group.add(seam);

  const selection = makeSelectionBox(new THREE.Vector3(2.85, 2.15, 1.25));
  selection.position.x = -0.08;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

function createFrameRing(width: number, height: number, border: number, radius: number, depth: number): THREE.Mesh {
  const outer = roundedRectShape(width, height, radius);
  outer.holes.push(roundedRectPath(width - border * 2, height - border * 2, Math.max(0.05, radius - border)));
  const material = new THREE.MeshStandardMaterial({ color: 0x3d596c, metalness: 0.72, roughness: 0.36 });
  return new THREE.Mesh(extrude(outer, depth, 0.035), material);
}

function helixBetween(start: THREE.Vector3, end: THREE.Vector3, turns = 4): THREE.Mesh {
  const points: THREE.Vector3[] = [];
  const direction = end.clone().sub(start);
  const length = direction.length();
  const axis = direction.clone().normalize();
  const helper = Math.abs(axis.y) < 0.8 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const side = new THREE.Vector3().crossVectors(axis, helper).normalize();
  const up = new THREE.Vector3().crossVectors(side, axis).normalize();
  for (let i = 0; i <= 48; i += 1) {
    const t = i / 48;
    const angle = t * Math.PI * 2 * turns;
    const p = start.clone().addScaledVector(axis, length * t);
    p.addScaledVector(side, Math.cos(angle) * 0.035);
    p.addScaledVector(up, Math.sin(angle) * 0.035);
    points.push(p);
  }
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 80, 0.012, 5, false),
    new THREE.MeshStandardMaterial({ color: 0xb9c2c8, metalness: 0.88, roughness: 0.28 })
  );
}

export function createTrampolineModel(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'trampoline-3d';
  group.userData.assetVersion = 'trampoline-v1';
  group.userData.sourceKey = 'opengameart-elastic-trampoline';
  group.userData.snapPoints = [{ id: 'bounce-surface', position: [0, 0.16, 0] }];

  const frame = createFrameRing(3.25, 1.95, 0.19, 0.38, 0.14);
  frame.rotation.x = -Math.PI / 2;
  frame.position.y = 0.08;
  frame.name = 'TrampolineSteelFrame';
  group.add(frame);

  const mat = new THREE.Mesh(
    extrude(roundedRectShape(2.58, 1.30, 0.28), 0.055, 0.018),
    new THREE.MeshPhysicalMaterial({ color: 0x182127, roughness: 0.86, metalness: 0, clearcoat: 0.02, clearcoatRoughness: 0.95 })
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = 0.15;
  mat.name = 'TrampolineElasticMat';
  group.add(mat);

  const springPairs: Array<[THREE.Vector3, THREE.Vector3]> = [];
  for (const x of [-1.1, -0.55, 0, 0.55, 1.1]) {
    springPairs.push([new THREE.Vector3(x, 0.14, 0.67), new THREE.Vector3(x, 0.10, 0.88)]);
    springPairs.push([new THREE.Vector3(x, 0.14, -0.67), new THREE.Vector3(x, 0.10, -0.88)]);
  }
  for (const z of [-0.42, 0, 0.42]) {
    springPairs.push([new THREE.Vector3(1.31, 0.14, z), new THREE.Vector3(1.56, 0.10, z)]);
    springPairs.push([new THREE.Vector3(-1.31, 0.14, z), new THREE.Vector3(-1.56, 0.10, z)]);
  }
  springPairs.forEach(([a, b], index) => {
    const spring = helixBetween(a, b, 3.5);
    spring.name = `TrampolineSpring${index + 1}`;
    group.add(spring);
  });

  const legMaterial = new THREE.MeshStandardMaterial({ color: 0x3d596c, metalness: 0.72, roughness: 0.36 });
  for (const x of [-1.28, 1.28]) {
    for (const z of [-0.68, 0.68]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.72, 18), legMaterial);
      leg.position.set(x, -0.28, z);
      leg.rotation.z = x < 0 ? -0.09 : 0.09;
      group.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 18), new THREE.MeshStandardMaterial({ color: 0x1e2529, roughness: 0.78 }));
      foot.position.set(x, -0.65, z);
      group.add(foot);
    }
  }

  const selection = makeSelectionBox(new THREE.Vector3(3.75, 1.55, 2.35));
  selection.position.y = -0.10;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

export function createFanBeltModel(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'fan-belt-3d';
  group.userData.assetVersion = 'fan-belt-v1';
  group.userData.sourceKey = 'opengameart-belt-cc0';
  group.userData.snapPoints = [
    { id: 'loop-left', position: [-1.18, 0, 0] },
    { id: 'loop-right', position: [1.18, 0, 0] }
  ];

  const outer = roundedRectShape(2.8, 1.55, 0.68);
  outer.holes.push(roundedRectPath(2.22, 0.97, 0.45));
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x24272a,
    metalness: 0,
    roughness: 0.83,
    clearcoat: 0.018,
    clearcoatRoughness: 0.96
  });
  const belt = new THREE.Mesh(extrude(outer, 0.26, 0.045), rubber);
  belt.rotation.x = -0.23;
  belt.rotation.y = 0.18;
  belt.name = 'ContinuousFanBeltLoop';
  group.add(belt);

  const ribMaterial = new THREE.MeshStandardMaterial({ color: 0x4b5054, roughness: 0.74, metalness: 0 });
  for (let i = -5; i <= 5; i += 1) {
    const rib = new THREE.Mesh(new THREE.BoxGeometry(0.022, 1.04, 0.018), ribMaterial);
    rib.position.set(i * 0.18, 0, 0.142);
    rib.rotation.x = -0.23;
    rib.rotation.y = 0.18;
    rib.name = `FanBeltRib${i + 6}`;
    group.add(rib);
  }

  const selection = makeSelectionBox(new THREE.Vector3(3.2, 1.95, 0.78));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

function createGearShape(teeth = 20): THREE.Shape {
  const shape = new THREE.Shape();
  const root = 0.92;
  const outer = 1.17;
  const flank = 0.98;
  const steps = teeth * 4;
  for (let i = 0; i < steps; i += 1) {
    const mod = i % 4;
    const radius = mod === 1 || mod === 2 ? outer : (mod === 0 ? flank : root);
    const angle = (i / steps) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.25, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  for (let i = 0; i < 6; i += 1) {
    const angle = (i / 6) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(angle) * 0.59, Math.sin(angle) * 0.59, 0.13, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

export function createGearModel(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'gear-3d';
  group.userData.assetVersion = 'gear-v1';
  group.userData.sourceKey = 'kenney-factory-kit-cc0';
  group.userData.snapPoints = [{ id: 'axle', position: [0, 0, 0] }];

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xb0bac0,
    metalness: 0.83,
    roughness: 0.34,
    clearcoat: 0.04,
    clearcoatRoughness: 0.58
  });
  const gear = new THREE.Mesh(extrude(createGearShape(20), 0.30, 0.025), steel);
  gear.rotation.x = -0.15;
  gear.rotation.y = 0.14;
  gear.name = 'MachinedGear20T';
  group.add(gear);

  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.40, 48), steel);
  hub.rotation.x = Math.PI / 2;
  hub.name = 'GearHub';
  group.add(hub);

  const bore = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.48, 48),
    new THREE.MeshStandardMaterial({ color: 0x424a50, metalness: 0.62, roughness: 0.43 })
  );
  bore.rotation.x = Math.PI / 2;
  bore.name = 'GearAxleBore';
  group.add(bore);

  const selection = makeSelectionBox(new THREE.Vector3(2.6, 2.6, 0.8));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

function createConveyorBeltLoop(): THREE.Mesh {
  const outer = roundedRectShape(3.45, 1.05, 0.50);
  outer.holes.push(roundedRectPath(3.02, 0.62, 0.29));
  const rubber = new THREE.MeshPhysicalMaterial({ color: 0x252b2f, roughness: 0.82, metalness: 0, clearcoat: 0.02, clearcoatRoughness: 0.95 });
  return new THREE.Mesh(extrude(outer, 0.92, 0.035), rubber);
}

export function createConveyorBeltModel(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'conveyor-belt-3d';
  group.userData.assetVersion = 'conveyor-belt-v1';
  group.userData.sourceKey = 'kenney-factory-kit-cc0';
  group.userData.snapPoints = [
    { id: 'input', position: [-1.72, 0.27, 0] },
    { id: 'output', position: [1.72, 0.27, 0] }
  ];

  const belt = createConveyorBeltLoop();
  belt.rotation.x = -Math.PI / 2;
  belt.position.y = 0.34;
  belt.name = 'ContinuousConveyorBelt';
  group.add(belt);

  const rollerMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb9bf, metalness: 0.84, roughness: 0.31 });
  for (const x of [-1.45, 1.45]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 1.12, 48), rollerMaterial);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, 0.34, 0);
    roller.name = x < 0 ? 'ConveyorDriveRoller' : 'ConveyorIdlerRoller';
    group.add(roller);
  }

  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x4b6778, metalness: 0.68, roughness: 0.40 });
  for (const z of [-0.57, 0.57]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.75, 0.18, 0.12), railMaterial);
    rail.position.set(0, 0.03, z);
    group.add(rail);
  }
  for (const x of [-1.45, 1.45]) {
    for (const z of [-0.54, 0.54]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.16), railMaterial);
      leg.position.set(x, -0.38, z);
      group.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.30), new THREE.MeshStandardMaterial({ color: 0x2f383e, metalness: 0.40, roughness: 0.55 }));
      foot.position.set(x, -0.79, z);
      group.add(foot);
    }
  }

  const selection = makeSelectionBox(new THREE.Vector3(4.25, 1.85, 1.55));
  selection.position.y = -0.08;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
