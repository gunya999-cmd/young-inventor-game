import * as THREE from 'three';
import type { ReviewAssetModel0913 } from './parts0913Models';

function makeSelectionBox(size: THREE.Vector3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size.x, size.y, size.z),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.055,
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

function extrude(shape: THREE.Shape, depth: number, bevel = 0.035): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    steps: 1,
    curveSegments: 18,
    bevelEnabled: bevel > 0,
    bevelSegments: 3,
    bevelSize: bevel,
    bevelThickness: bevel * 0.82
  });
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createRubberBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Rubber texture canvas unavailable.');
  context.fillStyle = '#808080';
  context.fillRect(0, 0, 128, 128);
  let seed = 0x0fabb117;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < 1500; i += 1) {
    const value = 121 + Math.round(random() * 14);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fillRect(random() * 128, random() * 128, 0.5 + random(), 0.5 + random());
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 3);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createFanBeltModelV2(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'fan-belt-3d';
  group.userData.assetVersion = 'fan-belt-v2';
  group.userData.sourceKey = 'opengameart-belt-cc0';
  group.userData.construction = 'continuous-v-belt-loop';
  group.userData.snapPoints = [
    { id: 'loop-left', position: [-1.18, 0, 0] },
    { id: 'loop-right', position: [1.18, 0, 0] }
  ];

  const outer = roundedRectShape(2.85, 1.60, 0.70);
  outer.holes.push(roundedRectPath(2.22, 0.97, 0.44));
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x24272a,
    metalness: 0,
    roughness: 0.86,
    clearcoat: 0.012,
    clearcoatRoughness: 0.98,
    bumpMap: createRubberBumpTexture(),
    bumpScale: 0.008
  });
  const belt = new THREE.Mesh(extrude(outer, 0.28, 0.05), rubber);
  belt.rotation.x = -0.20;
  belt.rotation.y = 0.16;
  belt.name = 'ContinuousVBeltLoop';
  group.add(belt);

  // Thin sidewall pinstripes indicate molded rib direction without placing
  // geometry across the open center of the loop.
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x484d50, roughness: 0.82, metalness: 0 });
  for (const z of [-0.148, 0.148]) {
    const stripeOuter = roundedRectShape(2.74, 1.49, 0.64);
    stripeOuter.holes.push(roundedRectPath(2.35, 1.10, 0.48));
    const stripe = new THREE.Mesh(extrude(stripeOuter, 0.012, 0.006), lineMaterial);
    stripe.position.z = z;
    stripe.rotation.x = -0.20;
    stripe.rotation.y = 0.16;
    stripe.name = z < 0 ? 'FanBeltRearMoldLine' : 'FanBeltFrontMoldLine';
    group.add(stripe);
  }

  const selection = makeSelectionBox(new THREE.Vector3(3.25, 2.00, 0.82));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

function createGearShape(teeth = 20): THREE.Shape {
  const shape = new THREE.Shape();
  const root = 0.91;
  const flank = 0.99;
  const outer = 1.17;
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
  bore.absarc(0, 0, 0.255, 0, Math.PI * 2, true);
  shape.holes.push(bore);
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const hole = new THREE.Path();
    hole.absarc(Math.cos(a) * 0.60, Math.sin(a) * 0.60, 0.135, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  return shape;
}

function createHubRingShape(): THREE.Shape {
  const ring = new THREE.Shape();
  ring.absarc(0, 0, 0.39, 0, Math.PI * 2, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, 0.255, 0, Math.PI * 2, true);
  ring.holes.push(bore);
  return ring;
}

export function createGearModelV2(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'gear-3d';
  group.userData.assetVersion = 'gear-v2';
  group.userData.sourceKey = 'kenney-factory-kit-cc0';
  group.userData.construction = 'true-through-bore';
  group.userData.snapPoints = [{ id: 'axle', position: [0, 0, 0] }];

  const steel = new THREE.MeshPhysicalMaterial({
    color: 0xb2bcc2,
    metalness: 0.84,
    roughness: 0.34,
    clearcoat: 0.035,
    clearcoatRoughness: 0.60
  });
  const gear = new THREE.Mesh(extrude(createGearShape(20), 0.30, 0.026), steel);
  gear.rotation.x = -0.15;
  gear.rotation.y = 0.14;
  gear.name = 'MachinedGear20T';
  group.add(gear);

  const hub = new THREE.Mesh(extrude(createHubRingShape(), 0.42, 0.024), steel);
  hub.rotation.x = -0.15;
  hub.rotation.y = 0.14;
  hub.name = 'GearAnnularHub';
  group.add(hub);

  const innerWall = new THREE.Mesh(
    new THREE.TorusGeometry(0.255, 0.025, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0x4b545a, metalness: 0.70, roughness: 0.38 })
  );
  innerWall.rotation.x = -0.15;
  innerWall.rotation.y = 0.14;
  innerWall.name = 'GearBoreEdge';
  group.add(innerWall);

  const selection = makeSelectionBox(new THREE.Vector3(2.65, 2.65, 0.84));
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}

function createConveyorBeltLoop(): THREE.Mesh {
  const outer = roundedRectShape(3.45, 1.05, 0.50);
  outer.holes.push(roundedRectPath(3.02, 0.62, 0.29));
  const rubber = new THREE.MeshPhysicalMaterial({
    color: 0x252b2f,
    roughness: 0.84,
    metalness: 0,
    clearcoat: 0.015,
    clearcoatRoughness: 0.97,
    bumpMap: createRubberBumpTexture(),
    bumpScale: 0.006
  });
  return new THREE.Mesh(extrude(outer, 0.92, 0.035), rubber);
}

export function createConveyorBeltModelV2(): ReviewAssetModel0913 {
  const group = new THREE.Group();
  group.userData.kind = 'conveyor-belt-3d';
  group.userData.assetVersion = 'conveyor-belt-v2';
  group.userData.sourceKey = 'kenney-factory-kit-cc0';
  group.userData.construction = 'vertical-loop-around-rollers';
  group.userData.snapPoints = [
    { id: 'input', position: [-1.72, 0.60, 0] },
    { id: 'output', position: [1.72, 0.60, 0] }
  ];

  // Side-profile loop stays in XY and extrudes across Z: this makes the belt
  // visibly wrap the drive/idler rollers instead of lying flat like a ring.
  const belt = createConveyorBeltLoop();
  belt.position.y = 0.42;
  belt.name = 'ContinuousConveyorBelt';
  group.add(belt);

  const rollerMaterial = new THREE.MeshStandardMaterial({ color: 0xaeb9bf, metalness: 0.86, roughness: 0.30 });
  for (const x of [-1.45, 1.45]) {
    const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.37, 1.04, 48), rollerMaterial);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, 0.42, 0);
    roller.name = x < 0 ? 'ConveyorDriveRoller' : 'ConveyorIdlerRoller';
    group.add(roller);
    for (const z of [-0.56, 0.56]) {
      const bearing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.08, 28),
        new THREE.MeshStandardMaterial({ color: 0x48545b, metalness: 0.72, roughness: 0.38 })
      );
      bearing.rotation.x = Math.PI / 2;
      bearing.position.set(x, 0.42, z);
      group.add(bearing);
    }
  }

  const railMaterial = new THREE.MeshStandardMaterial({ color: 0x4b6778, metalness: 0.68, roughness: 0.40 });
  for (const z of [-0.58, 0.58]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(3.78, 0.15, 0.12), railMaterial);
    rail.position.set(0, 0.02, z);
    group.add(rail);
  }
  for (const x of [-1.45, 1.45]) {
    for (const z of [-0.54, 0.54]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.76, 0.15), railMaterial);
      leg.position.set(x, -0.38, z);
      group.add(leg);
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.08, 0.30),
        new THREE.MeshStandardMaterial({ color: 0x2f383e, metalness: 0.40, roughness: 0.55 })
      );
      foot.position.set(x, -0.79, z);
      group.add(foot);
    }
  }

  const selection = makeSelectionBox(new THREE.Vector3(4.30, 2.05, 1.65));
  selection.position.y = -0.02;
  group.add(selection);
  return { group, selectionMeshes: [selection] };
}
