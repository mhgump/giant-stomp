import * as THREE from 'three';
import { createScene } from './scene.js';
import { Player } from './player.js';
import { InputManager } from './input.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, houses } = createScene();
const player = new Player(scene);
const input = new InputManager(camera, houses);

// Third-person camera offset
const cameraOffset = new THREE.Vector3(0, 25, 35);

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  player.update(input, delta);

  // Smooth camera follow
  const targetCameraPos = player.position.clone().add(cameraOffset);
  camera.position.lerp(targetCameraPos, 5 * delta);
  camera.lookAt(player.position.x, player.position.y + 1, player.position.z);

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
