import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createScene } from './scene.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { GameState } from './state/GameState.js';
import { HUD } from './ui/HUD.js';
import { HouseRenderer } from './rendering/HouseRenderer.js';
import { HousePhysics } from './systems/HousePhysics.js';
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

// Initialise Rapier WASM before creating any physics objects
await RAPIER.init();

const { scene, camera, houseMeshes, housePositions } = await createScene();
const characterLibrary = await loadCharacterLibrary();
const player           = new Player(scene, characterLibrary);
const input            = new InputManager(camera, houseMeshes);
const gameState        = new GameState(housePositions);
const hud              = new HUD(input);
const housePhysics     = new HousePhysics(RAPIER);
const houseRenderer    = new HouseRenderer(scene, houseMeshes, housePhysics);
const villagerRenderer = new VillagerRenderer(scene, characterLibrary);
const ropeRenderer     = new RopeRenderer(scene);
const bubbleSystem     = new BubbleSystem((villagerId) => {
  gameState.addCommand({ type: 'move_to_villager', villagerId });
});

// Camera — closer to the giant for a more immersive view
const cameraDist   = 18;
const cameraHeight = 16;

// Camera is tracked as two independent values:
//   cameraYaw   — the azimuth angle (rotates around the Y axis, stays behind the giant's head)
//   cameraPivot — the XZ centre-point the camera orbits (follows the giant's world position)
// Separating them prevents the camera from cutting through the giant during a 180° turn.
let cameraYaw    = gameState.giant.rotation;
let cameraPivotX = gameState.giant.x;
let cameraPivotZ = gameState.giant.z;

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

  if (input.consumeTurn()) {
    gameState.addCommand({ type: 'turn' });
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

  // 4. Camera follow — two-axis decomposition so rotation always arcs around Y
  //
  //  a) XZ pivot: smooth Cartesian follow of the giant's world position
  cameraPivotX += (gameState.giant.x - cameraPivotX) * Math.min(1, 8 * delta);
  cameraPivotZ += (gameState.giant.z - cameraPivotZ) * Math.min(1, 8 * delta);
  //
  //  b) Yaw: during a turn animation, lock exactly to giant.rotation so the
  //     camera orbits around the Y axis at the same rate as the giant turns.
  //     Otherwise, use a smooth angular lerp (never interpolates through 3D space).
  const gRot = gameState.giant.rotation;
  if (gameState.giant.turnAnim) {
    cameraYaw = gRot; // locked: camera pivots around Y in perfect sync
  } else {
    let yawDiff = gRot - cameraYaw;
    while (yawDiff >  Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    cameraYaw += yawDiff * Math.min(1, 4 * delta);
  }
  //
  //  c) Position: orbit at fixed distance and height around the pivot
  camera.position.set(
    cameraPivotX - Math.sin(cameraYaw) * cameraDist,
    cameraHeight,
    cameraPivotZ - Math.cos(cameraYaw) * cameraDist
  );
  camera.lookAt(cameraPivotX, 1, cameraPivotZ);
  camera.rotateX(THREE.MathUtils.degToRad(20));

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
