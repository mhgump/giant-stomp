import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import houseUrl from './assets/house.glb?url';
import roadTexUrl from './assets/textures/road.png?url';
import tileTexUrl from './assets/textures/tile.png?url';
import wallTexUrl from './assets/textures/wall.png?url';
import grassTexUrl from './assets/textures/grass.png?url';

export async function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 150);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    200
  );

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(20, 30, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 100;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  scene.add(sun);

  const texLoader = new THREE.TextureLoader();

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundGrassTex = texLoader.load(grassTexUrl);
  groundGrassTex.wrapS = groundGrassTex.wrapT = THREE.RepeatWrapping;
  groundGrassTex.repeat.set(200 / 20, 200 / 20);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundGrassTex,
    roughness: 0.9,
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Grid layout — roads form the grid lines, houses sit in the cells between them
  const cellSize = 8;      // center-to-center distance between cells
  const roadWidth = 2;     // road strip width
  const gridLines = 8;     // number of road lines in each direction
  const wallRadius = 32;   // ring wall radius
  const wallHeight = 5;
  const wallThickness = 1.5;

  const halfLines = Math.floor(gridLines / 2);

  // Build a road-textured material sized to a specific strip length (2× zoom out)
  function makeRoadMat(stripLen, vertical) {
    const t = texLoader.load(roadTexUrl);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    const along = (stripLen / roadWidth) / 2;
    t.repeat.set(vertical ? 0.5 : along, vertical ? along : 0.5);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 1.0 });
  }

  // Clip each road line to the circle; skip lines outside it entirely
  function addRoadStrip(pos, vertical) {
    const offset = Math.abs(pos);
    if (offset >= wallRadius) return;
    const halfLen = Math.sqrt(wallRadius * wallRadius - offset * offset);
    const stripLen = halfLen * 2;
    const geo = vertical
      ? new THREE.PlaneGeometry(roadWidth, stripLen)
      : new THREE.PlaneGeometry(stripLen, roadWidth);
    const mesh = new THREE.Mesh(geo, makeRoadMat(stripLen, vertical));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(vertical ? pos : 0, 0.01, vertical ? 0 : pos);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  // Roads sit on the grid lines (edges between cells)
  for (let i = -halfLines; i <= halfLines; i++) {
    const pos = i * cellSize;
    addRoadStrip(pos, true);  // vertical (along z)
    addRoadStrip(pos, false); // horizontal (along x)
  }

  // Tile texture (shared across all house tiles) — 2× zoom out: 0.5 repeats per tile
  const tileTex = texLoader.load(tileTexUrl);
  tileTex.wrapS = tileTex.wrapT = THREE.RepeatWrapping;
  tileTex.repeat.set(0.5, 0.5);
  const tileMat = new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.9 });

  // Short wall (curb) material using road texture
  // Match world-space texel density of the big wall (1 repeat per wallHeight units)
  const texelsPerUnit = 1 / wallHeight;
  const shortWallTex = texLoader.load(wallTexUrl);
  shortWallTex.wrapS = shortWallTex.wrapT = THREE.RepeatWrapping;
  shortWallTex.repeat.set((cellSize - roadWidth) * texelsPerUnit * 3, wallHeight * 0.1 * texelsPerUnit * 3);
  const shortWallMat = new THREE.MeshStandardMaterial({ map: shortWallTex, roughness: 1.0 });

  // Load house GLB and scale it to fill each tile (10% buffer per side = 80% of usable tile)
  const loader = new GLTFLoader();
  const houseGltf = await loader.loadAsync(houseUrl);

  const tileUsable = cellSize - roadWidth; // 6 units between road edges
  const houseTargetSize = tileUsable * 0.8;
  const houseBox = new THREE.Box3().setFromObject(houseGltf.scene);
  const houseSize = houseBox.getSize(new THREE.Vector3());
  const houseScale = houseTargetSize / Math.max(houseSize.x, houseSize.z);
  houseGltf.scene.scale.setScalar(houseScale);

  const shortWallHeight = wallHeight * 0.1; // ~10% of the large wall
  const shortWallThick = 0.2;
  const half = tileUsable / 2;

  function addTileCurb(x, z) {
    // N/S sides span the full tile width + corner thickness so corners are filled
    const nsGeo = new THREE.BoxGeometry(tileUsable + shortWallThick * 2, shortWallHeight, shortWallThick);
    const ewGeo = new THREE.BoxGeometry(shortWallThick, shortWallHeight, tileUsable);
    const y = shortWallHeight / 2;
    const offsets = [
      [nsGeo, 0,              y,  half + shortWallThick / 2],
      [nsGeo, 0,              y, -half - shortWallThick / 2],
      [ewGeo,  half + shortWallThick / 2, y, 0],
      [ewGeo, -half - shortWallThick / 2, y, 0],
    ];
    for (const [geo, dx, dy, dz] of offsets) {
      const mesh = new THREE.Mesh(geo, shortWallMat);
      mesh.position.set(x + dx, dy, z + dz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  // Houses placed in cell centers (offset by half a cell from road lines)
  const houses = [];
  const halfCells = halfLines; // cells exist between -halfLines and halfLines
  for (let row = -halfCells; row < halfCells; row++) {
    for (let col = -halfCells; col < halfCells; col++) {
      const x = (col + 0.5) * cellSize;
      const z = (row + 0.5) * cellSize;
      const dist = Math.sqrt(x * x + z * z);

      // Skip if outside the ring wall
      if (dist + 2.5 > wallRadius) continue;

      const isCenterCell = (col === -1 || col === 0) && (row === -1 || row === 0);

      // All valid tiles get a curb
      addTileCurb(x, z);

      if (isCenterCell) continue; // center cells are grass — no tile plane or house

      // Tile plane under the house
      const tilePlane = new THREE.Mesh(
        new THREE.PlaneGeometry(tileUsable, tileUsable),
        tileMat
      );
      tilePlane.rotation.x = -Math.PI / 2;
      tilePlane.position.set(x, 0.02, z);
      tilePlane.receiveShadow = true;
      scene.add(tilePlane);

      const house = houseGltf.scene.clone();
      house.userData.type = 'house';
      house.position.set(x, 0, z);
      house.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      scene.add(house);
      houses.push(house);
    }
  }

  // Ring wall
  const wallSegments = 64;

  const wallTex = texLoader.load(wallTexUrl);
  wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
  // 5× zoom out
  wallTex.repeat.set(Math.round((2 * Math.PI * wallRadius) / wallHeight / 2.5), 1);
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8, side: THREE.DoubleSide });

  // Outer face
  const outerGeo = new THREE.CylinderGeometry(wallRadius, wallRadius, wallHeight, wallSegments, 1, true);
  const outerWall = new THREE.Mesh(outerGeo, wallMat);
  outerWall.position.y = wallHeight / 2;
  outerWall.castShadow = true;
  outerWall.receiveShadow = true;
  scene.add(outerWall);

  // Inner face
  const innerRadius = wallRadius - wallThickness;
  const innerGeo = new THREE.CylinderGeometry(innerRadius, innerRadius, wallHeight, wallSegments, 1, true);
  const innerWall = new THREE.Mesh(innerGeo, wallMat);
  innerWall.position.y = wallHeight / 2;
  innerWall.receiveShadow = true;
  scene.add(innerWall);

  // Top cap ring — solid colour approximating the average of wall.png
  const topCapGeo = new THREE.RingGeometry(innerRadius, wallRadius, wallSegments);
  const topCapMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.9 });
  const topCap = new THREE.Mesh(topCapGeo, topCapMat);
  topCap.rotation.x = -Math.PI / 2;
  topCap.position.y = wallHeight;
  scene.add(topCap);

  return { scene, camera, houses };
}

