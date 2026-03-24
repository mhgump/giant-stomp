import * as THREE from 'three';

export function createScene() {
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

  // Ground
  const groundGeo = new THREE.PlaneGeometry(200, 200);
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0x4a8c3f,
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

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 1.0 });
  const halfLines = Math.floor(gridLines / 2);
  const roadLength = gridLines * cellSize;

  // Roads sit on the grid lines (edges between cells)
  for (let i = -halfLines; i <= halfLines; i++) {
    const pos = i * cellSize;
    // Vertical road (along z)
    const vRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(roadWidth, roadLength),
      roadMat
    );
    vRoad.rotation.x = -Math.PI / 2;
    vRoad.position.set(pos, 0.01, 0);
    vRoad.receiveShadow = true;
    scene.add(vRoad);

    // Horizontal road (along x)
    const hRoad = new THREE.Mesh(
      new THREE.PlaneGeometry(roadLength, roadWidth),
      roadMat
    );
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.position.set(0, 0.01, pos);
    hRoad.receiveShadow = true;
    scene.add(hRoad);
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

      // Skip the center cell where the player spawns
      if (col === -1 && row === -1) continue;
      if (col === 0 && row === -1) continue;
      if (col === -1 && row === 0) continue;
      if (col === 0 && row === 0) continue;

      const house = createHouse();
      house.position.set(x, 0, z);
      house.castShadow = true;
      scene.add(house);
      houses.push(house);
    }
  }

  // Ring wall
  const wallHeight = 5;
  const wallThickness = 1.5;
  const wallSegments = 64;
  const ringGeo = new THREE.CylinderGeometry(
    wallRadius, wallRadius, wallHeight, wallSegments, 1, true
  );
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x888877,
    roughness: 0.8,
    side: THREE.DoubleSide,
  });
  const ringWall = new THREE.Mesh(ringGeo, wallMat);
  ringWall.position.y = wallHeight / 2;
  ringWall.castShadow = true;
  ringWall.receiveShadow = true;
  scene.add(ringWall);

  return { scene, camera, houses };
}

function createHouse() {
  const group = new THREE.Group();
  group.userData.type = 'house';

  // Walls
  const wallGeo = new THREE.BoxGeometry(3, 2.5, 3);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xdecba4 });
  const walls = new THREE.Mesh(wallGeo, wallMat);
  walls.position.y = 1.25;
  walls.castShadow = true;
  walls.receiveShadow = true;
  group.add(walls);

  // Roof
  const roofGeo = new THREE.ConeGeometry(2.8, 1.8, 4);
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.y = 3.4;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  group.add(roof);

  // Door
  const doorGeo = new THREE.PlaneGeometry(0.8, 1.4);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x654321 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 0.7, 1.51);
  group.add(door);

  return group;
}
