import * as THREE from 'three';

export interface ReviewAssetModel {
  group: THREE.Group;
  selectionMeshes: THREE.Object3D[];
}

const X_AXIS = new THREE.Vector3(1, 0, 0);

function selectionShell(radius = 1.06): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 40, 28),
    new THREE.MeshBasicMaterial({
      color: 0x6e82ff,
      transparent: true,
      opacity: 0.11,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  mesh.visible = false;
  return mesh;
}

function projectedCurve(latitudeAmplitude: number, phase = 0): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < 128; index += 1) {
    const longitude = (index / 128) * Math.PI * 2;
    const latitude = latitudeAmplitude * Math.sin(longitude * 2 + phase);
    const point = new THREE.Vector3(
      Math.cos(latitude) * Math.cos(longitude),
      Math.sin(latitude),
      Math.cos(latitude) * Math.sin(longitude)
    ).multiplyScalar(1.012);
    points.push(point);
  }
  return points;
}

function tubeFromPoints(points: THREE.Vector3[], radius: number, color: number, roughness = 0.62): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.35);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, 192, radius, 7, true),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 })
  );
}

function addBaseballStitches(group: THREE.Group, points: THREE.Vector3[], phaseIndex: number): void {
  const material = new THREE.MeshStandardMaterial({ color: 0xb8292f, roughness: 0.66, metalness: 0 });
  for (let index = phaseIndex; index < points.length; index += 7) {
    const previous = points[(index - 1 + points.length) % points.length];
    const current = points[index].clone();
    const next = points[(index + 1) % points.length];
    const radial = current.clone().normalize();
    const tangent = next.clone().sub(previous).normalize();
    const across = new THREE.Vector3().crossVectors(radial, tangent).normalize();
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.018, 0.016), material);
    stitch.position.copy(radial.multiplyScalar(1.025));
    stitch.quaternion.setFromUnitVectors(X_AXIS, across);
    stitch.rotateX(index % 2 === 0 ? 0.23 : -0.23);
    group.add(stitch);
  }
}

export function createBaseballModel(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'baseball-3d';
  group.userData.assetVersion = 'baseball-v1';
  group.userData.sourceKey = 'opengameart-old-baseball-cc0';

  const leather = new THREE.MeshPhysicalMaterial({
    color: 0xf0eee7,
    roughness: 0.78,
    metalness: 0,
    clearcoat: 0.035,
    clearcoatRoughness: 0.92
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), leather));

  const seamA = projectedCurve(0.37, 0.18);
  const seamB = projectedCurve(-0.37, Math.PI + 0.18);
  group.add(tubeFromPoints(seamA, 0.011, 0xb8292f, 0.72));
  group.add(tubeFromPoints(seamB, 0.011, 0xb8292f, 0.72));
  addBaseballStitches(group, seamA, 2);
  addBaseballStitches(group, seamB, 5);

  const select = selectionShell();
  group.add(select);
  return { group, selectionMeshes: [select] };
}

function createTennisFuzzTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tennis fuzz texture canvas unavailable.');
  context.fillStyle = '#8a8a8a';
  context.fillRect(0, 0, 256, 256);
  let seed = 0x51adf00d;
  const random = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  for (let i = 0; i < 3600; i += 1) {
    const value = 112 + Math.round(random() * 34);
    context.fillStyle = `rgb(${value},${value},${value})`;
    context.fillRect(random() * 256, random() * 256, 0.65 + random() * 1.2, 0.65 + random() * 1.2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 4.2);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

export function createTennisBallModel(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'tennis-ball-3d';
  group.userData.assetVersion = 'tennis-ball-v1';
  group.userData.sourceKey = 'opengameart-hq-pbr-tennis-ball-cc0';

  const felt = new THREE.MeshStandardMaterial({
    color: 0xb8d51f,
    roughness: 0.94,
    metalness: 0,
    bumpMap: createTennisFuzzTexture(),
    bumpScale: 0.018
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(1, 96, 72), felt));

  const seamA = projectedCurve(0.47, 0.4);
  const seamB = projectedCurve(-0.47, Math.PI + 0.4);
  group.add(tubeFromPoints(seamA, 0.022, 0xf4f0dc, 0.9));
  group.add(tubeFromPoints(seamB, 0.022, 0xf4f0dc, 0.9));

  const select = selectionShell();
  group.add(select);
  return { group, selectionMeshes: [select] };
}

function createBalloonBody(): THREE.LatheGeometry {
  const points = [
    new THREE.Vector2(0.0, 1.22),
    new THREE.Vector2(0.31, 1.15),
    new THREE.Vector2(0.62, 0.93),
    new THREE.Vector2(0.81, 0.56),
    new THREE.Vector2(0.88, 0.08),
    new THREE.Vector2(0.81, -0.38),
    new THREE.Vector2(0.61, -0.73),
    new THREE.Vector2(0.34, -0.93),
    new THREE.Vector2(0.15, -1.02)
  ];
  return new THREE.LatheGeometry(points, 96);
}

export function createBalloonModel(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'balloon-3d';
  group.userData.assetVersion = 'balloon-v1';
  group.userData.sourceKey = 'opengameart-balloons-cc0';
  group.userData.snapPoints = [{ id: 'knot', position: [0, -1.11, 0] }];

  const latex = new THREE.MeshPhysicalMaterial({
    color: 0xe64c67,
    roughness: 0.34,
    metalness: 0,
    clearcoat: 0.17,
    clearcoatRoughness: 0.56,
    transmission: 0.025,
    thickness: 0.4
  });
  const body = new THREE.Mesh(createBalloonBody(), latex);
  body.scale.set(0.92, 1, 0.92);
  group.add(body);

  const knotMaterial = new THREE.MeshStandardMaterial({ color: 0xc83e57, roughness: 0.56 });
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.11, 0.17, 20), knotMaterial);
  neck.position.y = -1.08;
  group.add(neck);
  const knot = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.19, 20), knotMaterial);
  knot.position.y = -1.23;
  knot.rotation.z = Math.PI;
  group.add(knot);

  const stringCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -1.31, 0),
    new THREE.Vector3(0.08, -1.52, 0.02),
    new THREE.Vector3(-0.06, -1.73, -0.01),
    new THREE.Vector3(0.02, -1.94, 0)
  ]);
  const string = new THREE.Mesh(
    new THREE.TubeGeometry(stringCurve, 32, 0.009, 5, false),
    new THREE.MeshStandardMaterial({ color: 0x666a70, roughness: 0.88 })
  );
  group.add(string);

  const select = selectionShell(1.28);
  select.scale.set(0.9, 1.04, 0.9);
  group.add(select);
  return { group, selectionMeshes: [select] };
}

function roundedBoard(width: number, height: number, depth: number, color: number): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, clearcoat: 0.08, clearcoatRoughness: 0.74 });
  const center = new THREE.Mesh(new THREE.BoxGeometry(width - height, height, depth), material);
  group.add(center);
  const capGeometry = new THREE.CylinderGeometry(height / 2, height / 2, depth, 32);
  const left = new THREE.Mesh(capGeometry, material);
  left.rotation.x = Math.PI / 2;
  left.position.x = -(width - height) / 2;
  group.add(left);
  const right = left.clone();
  right.position.x *= -1;
  group.add(right);
  return group;
}

export function createTeeterTotterModel(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'teeter-totter-3d';
  group.userData.assetVersion = 'teeter-totter-v1';
  group.userData.sourceKey = 'opengameart-playground-cc0';
  group.userData.snapPoints = [{ id: 'pivot', position: [0, 0, 0] }];

  const board = roundedBoard(3.45, 0.24, 0.48, 0xd8513d);
  board.position.y = 0.46;
  board.rotation.z = -0.055;
  group.add(board);

  const seatMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf3b63e, roughness: 0.48, clearcoat: 0.07 });
  for (const x of [-1.25, 1.25]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.7), seatMaterial);
    seat.position.set(x, 0.61 + (x < 0 ? 0.07 : -0.07), 0);
    seat.rotation.z = -0.055;
    group.add(seat);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.19, 0.035, 10, 32, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x47515b, metalness: 0.58, roughness: 0.42 })
    );
    handle.position.set(x, 0.88 + (x < 0 ? 0.07 : -0.07), 0);
    handle.rotation.set(Math.PI / 2, 0, Math.PI);
    group.add(handle);
  }

  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x4d6475, metalness: 0.52, roughness: 0.5 });
  for (const z of [-0.29, 0.29]) {
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.95, 0.16), supportMaterial);
    leftLeg.position.set(-0.3, -0.02, z);
    leftLeg.rotation.z = -0.42;
    group.add(leftLeg);
    const rightLeg = leftLeg.clone();
    rightLeg.position.x = 0.3;
    rightLeg.rotation.z = 0.42;
    group.add(rightLeg);
  }
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.78, 28), new THREE.MeshStandardMaterial({ color: 0xc5ccd1, metalness: 0.85, roughness: 0.3 }));
  axle.rotation.x = Math.PI / 2;
  axle.position.y = 0.42;
  group.add(axle);
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.13, 0.9), supportMaterial);
  base.position.y = -0.55;
  group.add(base);

  const select = selectionShell(1.9);
  select.scale.set(1, 0.62, 0.45);
  select.position.y = 0.08;
  group.add(select);
  return { group, selectionMeshes: [select] };
}

function bellowsBoard(color: number): THREE.Group {
  const board = new THREE.Group();
  const material = new THREE.MeshPhysicalMaterial({ color, roughness: 0.58, clearcoat: 0.045, clearcoatRoughness: 0.8 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.14, 1.06), material);
  board.add(body);
  const end = new THREE.Mesh(new THREE.CylinderGeometry(0.53, 0.53, 0.14, 40), material);
  end.rotation.x = Math.PI / 2;
  end.position.x = -1.05;
  board.add(end);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.34), material);
  handle.position.x = -1.62;
  board.add(handle);
  return board;
}

export function createBellowsModel(): ReviewAssetModel {
  const group = new THREE.Group();
  group.userData.kind = 'bellows-3d';
  group.userData.assetVersion = 'bellows-v1';
  group.userData.sourceKey = 'sketchfab-nudluria-bellows-cc-by';
  group.userData.snapPoints = [{ id: 'nozzle', position: [2.08, 0, 0] }];

  const lower = bellowsBoard(0x9a5c32);
  lower.position.y = -0.4;
  lower.rotation.z = -0.02;
  group.add(lower);
  const upper = bellowsBoard(0xb97743);
  upper.position.y = 0.42;
  upper.rotation.z = 0.065;
  group.add(upper);

  const leather = new THREE.MeshStandardMaterial({ color: 0x4b2925, roughness: 0.9, metalness: 0 });
  for (let index = 0; index < 7; index += 1) {
    const y = -0.29 + index * 0.105;
    const scale = 1 - Math.abs(index - 3) * 0.035;
    const fold = new THREE.Mesh(new THREE.BoxGeometry(2.03 * scale, 0.075, 0.94 * scale), leather);
    fold.position.set(-0.02, y, 0);
    group.add(fold);
  }

  const metal = new THREE.MeshStandardMaterial({ color: 0x8e999f, metalness: 0.82, roughness: 0.34 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.34, 32), metal);
  collar.rotation.z = Math.PI / 2;
  collar.position.set(1.18, 0.02, 0);
  group.add(collar);
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.22, 1.55, 32), metal);
  nozzle.rotation.z = Math.PI / 2;
  nozzle.position.set(1.98, 0.02, 0);
  group.add(nozzle);
  const opening = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 8, 28), new THREE.MeshStandardMaterial({ color: 0x343a40, metalness: 0.7, roughness: 0.5 }));
  opening.position.set(2.75, 0.02, 0);
  opening.rotation.y = Math.PI / 2;
  group.add(opening);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.24, 20), metal);
  pin.rotation.x = Math.PI / 2;
  pin.position.set(-0.85, 0, 0);
  group.add(pin);

  const select = selectionShell(2.05);
  select.scale.set(1.4, 0.5, 0.52);
  select.position.x = 0.35;
  group.add(select);
  return { group, selectionMeshes: [select] };
}
