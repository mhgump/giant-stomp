import * as THREE from 'three';
import { createScene } from './scene.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { GameState } from './state/GameState.js';
import { HUD } from './ui/HUD.js';
import { HouseRenderer } from './rendering/HouseRenderer.js';
import { VillagerRenderer } from './rendering/VillagerRenderer.js';
import { RopeRenderer } from './rendering/RopeRenderer.js';
import { BubbleSystem } from './ui/BubbleSystem.js';
import { loadCharacterLibrary } from './characters.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const { scene, camera, houseMeshes, housePositions } = await createScene();
const characterLibrary = await loadCharacterLibrary();
const player = new Player(scene, characterLibrary);
const input = new InputManager(camera, houseMeshes);
const gameState = new GameState(housePositions);
const hud = new HUD(input);
const houseRenderer = new HouseRenderer(scene, houseMeshes);
const villagerRenderer = new VillagerRenderer(scene, characterLibrary);
const ropeRenderer = new RopeRenderer(scene);
const bubbleSystem = new BubbleSystem((villagerId) => {
  gameState.addCommand({ type: 'move_to_villager', villagerId });
});

// Camera settings
const cameraDist = 30;
const cameraHeight = 25;

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  // 1. Gather input commands
  const cmd = input.consumeCommand();
  if (cmd) gameState.addCommand(cmd);

  if (input.consumeSpace()) {
    gameState.addCommand({ type: 'spam_space' });
  }

  if (input.consumeRoar()) {
    gameState.addCommand({ type: 'roar' });
  }

  // 2. Tick game state
  gameState.tick(delta);

  // 3. Sync renderers from state
  player.syncFromState(gameState.giant, delta);
  houseRenderer.sync(gameState.houses, gameState.giant, delta);
  villagerRenderer.sync(gameState.villagers, delta);
  ropeRenderer.sync(gameState.giant, gameState.villagers);
  hud.update(gameState);
  bubbleSystem.update(gameState, camera);

  // 4. Camera follow (behind player based on facing direction)
  const behindX = -Math.sin(gameState.giant.rotation) * cameraDist;
  const behindZ = -Math.cos(gameState.giant.rotation) * cameraDist;
  const targetCameraPos = new THREE.Vector3(
    gameState.giant.x + behindX,
    cameraHeight,
    gameState.giant.z + behindZ
  );
  camera.position.lerp(targetCameraPos, 3 * delta);
  camera.lookAt(gameState.giant.x, 1, gameState.giant.z);
  camera.rotateX(THREE.MathUtils.degToRad(20));

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
