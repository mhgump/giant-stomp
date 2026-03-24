import * as THREE from 'three';
import { createScene } from './scene.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { loadCharacterLibrary } from './characters.js';
import { Villager } from './villager.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, houses } = await createScene();
const characterLibrary = await loadCharacterLibrary();
const player = new Player(scene, characterLibrary);
const input = new InputManager(camera, houses);

// Camera offset relative to player facing direction (behind and above)
const cameraDist = 30;
const cameraHeight = 25;

const clock = new THREE.Clock();

const villagers = houses.map((house, i) => {
  const villager = new Villager(scene, characterLibrary);
  const offsetX = i % 2 === 0 ? 1.4 : -1.4;
  const offsetZ = i % 3 === 0 ? 1.0 : -1.0;
  villager.position.set(house.position.x + offsetX, 0, house.position.z + offsetZ);
  villager.group.rotation.y = (i % 8) * (Math.PI / 4);

  // Stop villagers that start inside a house
  const houseBox = new THREE.Box3().setFromObject(house);
  if (houseBox.containsPoint(new THREE.Vector3(villager.position.x, houseBox.min.y + 0.1, villager.position.z))) {
    villager.stopRunning();
  }

  return villager;
});

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  player.update(input, delta);
  for (const villager of villagers) villager.update(delta);

  // Position camera behind the player based on their facing direction
  // Player nose faces -Z in local space, rotation.y rotates around Y
  const behindX = Math.sin(player.rotation) * cameraDist;
  const behindZ = Math.cos(player.rotation) * cameraDist;
  const targetCameraPos = new THREE.Vector3(
    player.position.x + behindX,
    player.position.y + cameraHeight,
    player.position.z + behindZ
  );
  camera.position.lerp(targetCameraPos, 3 * delta);
  camera.lookAt(player.position.x, player.position.y + 1, player.position.z);
  camera.rotateX(THREE.MathUtils.degToRad(20));

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
