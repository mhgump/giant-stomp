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

  // Houses
  const houses = [];
  for (let i = 0; i < 10; i++) {
    const house = createHouse();
    house.position.set(
      (Math.random() - 0.5) * 60,
      0,
      (Math.random() - 0.5) * 60
    );
    house.rotation.y = Math.random() * Math.PI * 2;
    house.castShadow = true;
    scene.add(house);
    houses.push(house);
  }

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
