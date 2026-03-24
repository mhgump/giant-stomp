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

// Camera offset relative to player facing direction (behind and above)
const cameraDist = 30;
const cameraHeight = 25;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  player.update(input, delta);

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
