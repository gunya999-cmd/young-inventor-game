import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const mats = {
  blue: new THREE.MeshPhysicalMaterial({ color: 0x2196d3, roughness: 0.34, metalness: 0.12, clearcoat: 0.28, clearcoatRoughness: 0.22 }),
  teal: new THREE.MeshPhysicalMaterial({ color: 0x1aa7aa, roughness: 0.36, metalness: 0.14, clearcoat: 0.24 }),
  yellow: new THREE.MeshPhysicalMaterial({ color: 0xf6bd36, roughness: 0.38, metalness: 0.09, clearcoat: 0.22 }),
  orange: new THREE.MeshPhysicalMaterial({ color: 0xf18b3f, roughness: 0.43, metalness: 0.06 }),
  green: new THREE.MeshPhysicalMaterial({ color: 0x65c96d, roughness: 0.42, metalness: 0.03 }),
  red: new THREE.MeshPhysicalMaterial({ color: 0xdf4742, roughness: 0.28, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.18 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xf6efd8, roughness: 0.80, metalness: 0 }),
  wallBlue: new THREE.MeshStandardMaterial({ color: 0x7fcbea, roughness: 0.76, metalness: 0 }),
  wood: new THREE.MeshPhysicalMaterial({ color: 0xc58d55, roughness: 0.64, metalness: 0, clearcoat: 0.08 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x76513a, roughness: 0.78, metalness: 0 }),
  steel: new THREE.MeshPhysicalMaterial({ color: 0x9ba7af, roughness: 0.25, metalness: 0.88, clearcoat: 0.16 }),
  darkSteel: new THREE.MeshPhysicalMaterial({ color: 0x46535c, roughness: 0.31, metalness: 0.78 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x23282d, roughness: 0.90, metalness: 0.02 }),
  rope: new THREE.MeshStandardMaterial({ color: 0xb98148, roughness: 0.92, metalness: 0 }),
  white: new THREE.MeshPhysicalMaterial({ color: 0xf7fbfd, roughness: 0.44, metalness: 0.02, clearcoat: 0.25 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0xc7efff, roughness: 0.08, metalness: 0, transmission: 0.72, transparent: true, opacity: 0.55, thickness: 0.02 }),
  glow: new THREE.MeshStandardMaterial({ color: 0x6df16e, emissive: 0x39ff59, emissiveIntensity: 1.5, roughness: 0.20 }),
};

function finish(root: THREE.Object3D): THREE.Object3D {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return root;
}

function rbox(w: number, h: number, d: number, radius: number, material: THREE.Material): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 5, Math.min(radius, Math.min(w, h, d) * 0.45)), material);
}

function cyl(radius: number, height: number, material: THREE.Material, radial = 48): THREE.Mesh {
  return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, radial), material);
}

function bolt(radius = 0.035, material: THREE.Material = mats.steel): THREE.Group {
  const g = new THREE.Group();
  const head = cyl(radius, radius * 0.55, material, 24);
  head.rotation.x = Math.PI / 2;
  g.add(head);
  const slot = rbox(radius * 1.1, radius * 0.12, radius * 0.10, radius * 0.03, mats.darkSteel);
  slot.position.z = radius * 0.30;
  g.add(slot);
  return g;
}

function addBolt(group: THREE.Group, x: number, y: number, z: number, scale = 1): void {
  const b = bolt(0.035 * scale);
  b.position.set(x, y, z);
  group.add(b);
}

function gear(radius: number, teeth: number): THREE.Group {
  const g = new THREE.Group();
  const core = cyl(radius * 0.74, 0.11, mats.yellow, 48);
  core.rotation.x = Math.PI / 2;
  g.add(core);
  for (let i = 0; i < teeth; i += 1) {
    const a = i / teeth * Math.PI * 2;
    const tooth = rbox(radius * 0.24, radius * 0.14, 0.12, 0.025, mats.yellow);
    tooth.position.set(Math.cos(a) * radius * 0.88, Math.sin(a) * radius * 0.88, 0);
    tooth.rotation.z = a;
    g.add(tooth);
  }
  const hub = cyl(radius * 0.19, 0.15, mats.steel, 32);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

export function createHeavyBallAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.34, 56, 36), mats.steel);
  g.add(ball);
  for (const axis of ['x', 'y'] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.338, 0.006, 8, 72), mats.darkSteel);
    if (axis === 'x') ring.rotation.x = Math.PI / 2;
    else ring.rotation.y = Math.PI / 2;
    g.add(ring);
  }
  return finish(g);
}

export function createLightBallAsset(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 48, 32), mats.white));
  for (const rotation of [0, Math.PI / 2]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.239, 0.014, 9, 64), mats.red);
    ring.rotation.x = rotation;
    g.add(ring);
  }
  return finish(g);
}

export function createRampAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const deck = rbox(2.95, 0.16, 1.02, 0.05, mats.darkSteel);
  deck.position.y = 0.03;
  g.add(deck);
  const rolling = rbox(2.74, 0.055, 0.76, 0.018, mats.rubber);
  rolling.position.y = 0.14;
  g.add(rolling);
  for (const z of [-0.49, 0.49]) {
    const rail = rbox(3.0, 0.27, 0.10, 0.035, mats.teal);
    rail.position.set(0, 0.22, z);
    g.add(rail);
    for (let i = 0; i < 13; i += 1) {
      const stripe = rbox(0.16, 0.055, 0.028, 0.008, i % 2 ? mats.darkSteel : mats.yellow);
      stripe.position.set(-1.32 + i * 0.22, 0.37, z > 0 ? 0.548 : -0.548);
      stripe.rotation.z = i % 2 ? -0.48 : 0.48;
      g.add(stripe);
    }
  }
  for (const x of [-1.28, 1.28]) {
    const roller = cyl(0.12, 0.76, mats.steel, 36);
    roller.rotation.x = Math.PI / 2;
    roller.position.set(x, 0.14, 0);
    g.add(roller);
    for (const z of [-0.41, 0.41]) {
      const leg = rbox(0.12, 0.76, 0.12, 0.025, mats.teal);
      leg.position.set(x, -0.36, z);
      g.add(leg);
    }
  }
  for (const z of [-0.41, 0.41]) {
    const brace = rbox(2.58, 0.085, 0.085, 0.018, mats.teal);
    brace.position.set(0, -0.68, z);
    g.add(brace);
  }
  addBolt(g, -1.34, 0.30, 0.56); addBolt(g, 1.34, 0.30, 0.56); addBolt(g, -1.34, 0.30, -0.56); addBolt(g, 1.34, 0.30, -0.56);
  return finish(g);
}

export function createLeverAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const foot = rbox(0.96, 0.13, 0.76, 0.055, mats.blue); foot.position.y = -0.49; g.add(foot);
  const pedestal = rbox(0.58, 0.58, 0.58, 0.08, mats.darkSteel); pedestal.position.y = -0.20; g.add(pedestal);
  const axle = cyl(0.17, 0.82, mats.steel, 42); axle.rotation.x = Math.PI / 2; axle.position.y = 0.06; g.add(axle);
  const beam = rbox(3.2, 0.17, 0.44, 0.055, mats.yellow); beam.position.y = 0.30; g.add(beam);
  const top = rbox(3.04, 0.04, 0.34, 0.012, mats.wood); top.position.y = 0.405; g.add(top);
  for (const x of [-1.42, 1.42]) { const pad = rbox(0.34, 0.065, 0.39, 0.018, mats.rubber); pad.position.set(x, 0.44, 0); g.add(pad); }
  addBolt(g, -0.23, 0.06, 0.31); addBolt(g, 0.23, 0.06, 0.31);
  return finish(g);
}

export function createPulleyAsset(): THREE.Object3D {
  const g = new THREE.Group();
  for (const z of [-0.13, 0.13]) { const flange = cyl(0.43, 0.055, mats.steel, 56); flange.rotation.x = Math.PI / 2; flange.position.set(0, 0.24, z); g.add(flange); }
  const wheel = cyl(0.37, 0.18, mats.blue, 56); wheel.rotation.x = Math.PI / 2; wheel.position.y = 0.24; g.add(wheel);
  const groove = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.035, 12, 56), mats.rubber); groove.position.set(0, 0.24, 0.11); g.add(groove);
  const axle = cyl(0.08, 0.58, mats.steel, 28); axle.rotation.x = Math.PI / 2; axle.position.y = 0.24; g.add(axle);
  for (const z of [-0.30, 0.30]) { const bracket = rbox(0.13, 1.22, 0.08, 0.025, mats.darkSteel); bracket.position.set(0, -0.10, z); g.add(bracket); }
  const base = rbox(0.68, 0.12, 0.76, 0.04, mats.teal); base.position.y = -0.68; g.add(base);
  return finish(g);
}

export function createPlatformAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const top = rbox(1.02, 0.13, 0.80, 0.04, mats.wood); top.position.y = 0.43; g.add(top);
  for (const x of [-0.40, 0.40]) for (const z of [-0.30, 0.30]) { const leg = rbox(0.09, 0.85, 0.09, 0.02, mats.teal); leg.position.set(x, 0, z); g.add(leg); }
  for (const z of [-0.30, 0.30]) { const brace = rbox(0.78, 0.06, 0.06, 0.014, mats.yellow); brace.position.set(0, -0.28, z); g.add(brace); }
  return finish(g);
}

export function createWeightAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const body = cyl(0.32, 0.68, mats.darkSteel, 48); g.add(body);
  for (const y of [-0.20, 0.20]) { const band = cyl(0.326, 0.10, mats.yellow, 48); band.position.y = y; g.add(band); }
  const eye = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.034, 12, 42), mats.steel); eye.rotation.y = Math.PI / 2; eye.position.y = 0.45; g.add(eye);
  return finish(g);
}

export function createButtonAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const base = rbox(0.86, 0.20, 0.76, 0.07, mats.blue); base.position.y = -0.08; g.add(base);
  const trim = rbox(0.70, 0.13, 0.61, 0.045, mats.yellow); trim.position.y = 0.08; g.add(trim);
  const ring = cyl(0.27, 0.055, mats.steel, 44); ring.position.y = 0.16; g.add(ring);
  const button = cyl(0.22, 0.13, mats.red, 44); button.position.y = 0.24; g.add(button);
  for (const x of [-0.30, 0.30]) for (const z of [-0.25, 0.25]) { const b = bolt(0.028); b.rotation.x = Math.PI / 2; b.position.set(x, 0.18, z); g.add(b); }
  return finish(g);
}

export function createFinalDeviceAsset(): THREE.Object3D {
  const g = new THREE.Group();
  const body = rbox(1.20, 1.40, 0.92, 0.10, mats.teal); body.position.y = 0.68; g.add(body);
  const front = rbox(0.96, 1.08, 0.08, 0.055, mats.blue); front.position.set(0, 0.68, 0.49); g.add(front);
  const g1 = gear(0.33, 14); g1.position.set(-0.22, 0.83, 0.56); g.add(g1);
  const g2 = gear(0.25, 12); g2.scale.setScalar(0.88); g2.position.set(0.27, 0.44, 0.56); g.add(g2);
  const beaconBase = cyl(0.18, 0.12, mats.steel, 36); beaconBase.position.y = 1.42; g.add(beaconBase);
  const beacon = cyl(0.14, 0.24, mats.glow, 36); beacon.position.y = 1.61; beacon.name = 'SuccessBeacon'; g.add(beacon);
  for (const x of [-0.48, 0.48]) { const foot = rbox(0.18, 0.14, 0.74, 0.03, mats.darkSteel); foot.position.set(x, -0.08, 0); g.add(foot); }
  return finish(g);
}

function shelfUnit(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  for (const px of [-0.78, 0.78]) { const post = rbox(0.09, 3.1, 0.56, 0.025, mats.wood); post.position.set(px, 1.55, 0); g.add(post); }
  for (const y of [0.35, 1.15, 1.95, 2.75]) { const shelf = rbox(1.72, 0.08, 0.58, 0.025, mats.wood); shelf.position.y = y; g.add(shelf); }
  const colors = [mats.blue, mats.yellow, mats.orange, mats.green];
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) { const bin = rbox(0.44, 0.31, 0.42, 0.055, colors[(row + col) % colors.length]); bin.position.set(-0.55 + col * 0.55, 0.62 + row * 0.80, 0.18); g.add(bin); }
  g.position.set(x, 0, z);
  return g;
}

export function createWorkshopEnvironment(): THREE.Object3D {
  const g = new THREE.Group();
  const floor = rbox(14, 0.18, 9, 0.03, mats.wood); floor.position.y = -0.12; g.add(floor);
  for (let i = 0; i < 12; i += 1) { const seam = rbox(13.8, 0.012, 0.026, 0.005, mats.darkWood); seam.position.set(0, -0.015, -4.0 + i * 0.72); g.add(seam); }
  const back = rbox(14, 5.7, 0.20, 0.035, mats.cream); back.position.set(0, 2.65, -4.35); g.add(back);
  const side = rbox(0.20, 5.7, 9, 0.035, mats.wallBlue); side.position.set(-6.9, 2.65, 0); g.add(side);
  const blueBand = rbox(13.7, 1.25, 0.05, 0.02, mats.wallBlue); blueBand.position.set(0, 0.70, -4.20); g.add(blueBand);

  // Big sunny workshop window.
  const glass = rbox(2.85, 3.45, 0.035, 0.015, mats.glass); glass.position.set(5.05, 3.05, -4.18); g.add(glass);
  for (const x of [3.65, 5.05, 6.45]) { const mullion = rbox(0.10, 3.55, 0.08, 0.018, mats.white); mullion.position.set(x, 3.05, -4.10); g.add(mullion); }
  for (const y of [1.40, 3.05, 4.70]) { const mullion = rbox(2.90, 0.10, 0.08, 0.018, mats.white); mullion.position.set(5.05, y, -4.10); g.add(mullion); }

  g.add(shelfUnit(-4.55, -3.72)); g.add(shelfUnit(4.15, -3.72));

  // Workbench and pegboard.
  const benchTop = rbox(2.35, 0.14, 1.0, 0.045, mats.wood); benchTop.position.set(-2.15, 0.92, -3.18); g.add(benchTop);
  for (const x of [-3.05, -1.25]) for (const z of [-3.53, -2.83]) { const leg = rbox(0.11, 0.96, 0.11, 0.022, mats.teal); leg.position.set(x, 0.43, z); g.add(leg); }
  const peg = rbox(2.15, 1.15, 0.07, 0.035, mats.yellow); peg.position.set(-2.15, 1.92, -4.10); g.add(peg);
  for (let i = 0; i < 7; i += 1) { const tool = rbox(0.055, 0.45, 0.045, 0.012, mats.darkSteel); tool.position.set(-2.85 + i * 0.23, 1.93 + (i % 2) * 0.10, -4.00); tool.rotation.z = (i % 3 - 1) * 0.15; g.add(tool); }

  // Stair + mezzanine.
  const mezz = rbox(3.9, 0.16, 1.65, 0.04, mats.blue); mezz.position.set(-4.0, 3.34, -2.78); g.add(mezz);
  for (let i = 0; i < 8; i += 1) { const step = rbox(0.74, 0.12, 0.96, 0.03, mats.wood); step.position.set(-1.75 - i * 0.43, 0.45 + i * 0.38, -2.78); g.add(step); }
  for (let i = 0; i < 8; i += 1) { const post = rbox(0.045, 0.78, 0.045, 0.012, mats.yellow); post.position.set(-5.45 + i * 0.44, 3.78, -1.94); g.add(post); }
  const rail = rbox(3.35, 0.055, 0.055, 0.012, mats.yellow); rail.position.set(-3.92, 4.16, -1.94); g.add(rail);

  // Hanging lamps.
  for (const x of [-2.4, 1.0, 4.0]) { const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.28, 0.18, 32, 1, true), mats.yellow); shade.position.set(x, 4.65, -0.6); g.add(shade); const cord = rbox(0.025, 0.62, 0.025, 0.006, mats.darkSteel); cord.position.set(x, 4.98, -0.6); g.add(cord); }

  // Friendly science posters.
  const posterData: Array<[number, THREE.Material]> = [[-0.25, mats.orange], [1.35, mats.teal], [2.95, mats.yellow]];
  for (const [x, material] of posterData) { const poster = rbox(1.15, 1.20, 0.035, 0.025, material); poster.position.set(x, 3.05, -4.08); g.add(poster); }

  // Plants and desktop foreground give scene depth.
  for (const [x, z] of [[-6.1, -3.1], [5.95, -3.2]] as Array<[number, number]>) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.21, 0.30, 28), mats.orange); pot.position.set(x, 0.15, z); g.add(pot);
    for (let i = 0; i < 5; i += 1) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), mats.green); const a = i / 5 * Math.PI * 2; leaf.scale.set(0.65, 1.5, 0.45); leaf.position.set(x + Math.cos(a) * 0.13, 0.48 + (i % 2) * 0.08, z + Math.sin(a) * 0.13); leaf.rotation.z = Math.cos(a) * 0.5; g.add(leaf); }
  }
  const frontDesk = rbox(2.7, 0.15, 1.15, 0.045, mats.wood); frontDesk.position.set(-5.15, 0.72, 3.55); g.add(frontDesk);
  for (const x of [-6.25, -4.05]) { const leg = rbox(0.11, 0.78, 0.11, 0.022, mats.teal); leg.position.set(x, 0.28, 3.55); g.add(leg); }
  const blueprint = rbox(1.35, 0.025, 0.82, 0.012, mats.blue); blueprint.position.set(-5.2, 0.83, 3.55); blueprint.rotation.y = -0.12; g.add(blueprint);
  return finish(g);
}
