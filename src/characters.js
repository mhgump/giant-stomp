import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";

import giantUrl from "./assets/characters/giant.glb?url";
import manUrl from "./assets/characters/man.glb?url";

/*
Assumptions:
- `giant.glb` contains clips named `Slow_Orc_Walk` and `Charged_Ground_Slam`.
- `man.glb` contains a clip named `Armature|running|baselayer`.
- Both models are authored facing +Z; we rotate model roots by PI so "forward" is -Z.
- The game wants world-space heights of ~6.5 (giant) and ~2.0 (villager).
*/

export const GIANT_RUN_CLIP = "Slow_Orc_Walk";
export const GIANT_GROUND_SLAM_CLIP = "Charged_Ground_Slam";
export const VILLAGER_RUN_CLIP = "Armature|running|baselayer";

const TARGET_HEIGHT_GIANT = 6.5;
const TARGET_HEIGHT_VILLAGER = 2.0;

function getClip(gltf, clipName, modelFile) {
  const clip = gltf.animations.find((a) => a.name === clipName);
  if (!clip)
    throw new Error(
      `Missing clip ${JSON.stringify(clipName)} in ${JSON.stringify(modelFile)}`
    );
  return clip;
}

function computeScaleForHeight(scene, targetHeight) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  return targetHeight / size.y;
}

function enableShadows(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
  });
}

function wrapAndPlaceOnGround(modelRoot) {
  const wrapper = new THREE.Group();
  wrapper.add(modelRoot);

  modelRoot.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(modelRoot);
  modelRoot.position.y -= box.min.y;

  return wrapper;
}

function poseBind(root) {
  root.traverse((child) => {
    if (child.isSkinnedMesh) child.skeleton.pose();
  });
}

export async function loadCharacterLibrary() {
  const loader = new GLTFLoader();

  const [giantGltf, manGltf] = await Promise.all([
    loader.loadAsync(giantUrl),
    loader.loadAsync(manUrl)
  ]);

  const giantScale = computeScaleForHeight(giantGltf.scene, TARGET_HEIGHT_GIANT);
  const villagerScale = computeScaleForHeight(manGltf.scene, TARGET_HEIGHT_VILLAGER);

  return {
    giantGltf,
    manGltf,
    clips: {
      giantRun: getClip(giantGltf, GIANT_RUN_CLIP, "giant.glb"),
      giantSlam: getClip(giantGltf, GIANT_GROUND_SLAM_CLIP, "giant.glb"),
      villagerRun: getClip(manGltf, VILLAGER_RUN_CLIP, "man.glb")
    },
    scales: {
      giant: giantScale,
      villager: villagerScale
    }
  };
}

export function createGiant(library) {
  const model = cloneSkeleton(library.giantGltf.scene);
  model.scale.setScalar(library.scales.giant);
  model.rotation.y = Math.PI;
  enableShadows(model);

  const root = wrapAndPlaceOnGround(model);
  const mixer = new THREE.AnimationMixer(root);

  const runAction = mixer
    .clipAction(library.clips.giantRun)
    .setLoop(THREE.LoopRepeat, Infinity);
  runAction.play();

  const slamAction = mixer
    .clipAction(library.clips.giantSlam)
    .setLoop(THREE.LoopOnce, 1);
  slamAction.clampWhenFinished = true;

  const giant = {
    type: "giant",
    root,
    mixer,
    runAction,
    slamAction,
    isSlamming: false
  };

  mixer.addEventListener("finished", (e) => {
    if (e.action !== slamAction) return;
    giant.isSlamming = false;
    slamAction.stop();
    runAction.reset().fadeIn(0.08).play();
  });

  return giant;
}

export function createVillager(library) {
  const model = cloneSkeleton(library.manGltf.scene);
  model.scale.setScalar(library.scales.villager);
  model.rotation.y = Math.PI;
  enableShadows(model);

  const root = wrapAndPlaceOnGround(model);
  const mixer = new THREE.AnimationMixer(root);

  const runAction = mixer
    .clipAction(library.clips.villagerRun)
    .setLoop(THREE.LoopRepeat, Infinity);
  runAction.play();

  return {
    type: "villager",
    root,
    mixer,
    runAction
  };
}

export function playGiantGroundSlam(giant) {
  giant.isSlamming = true;
  giant.runAction.fadeOut(0.06);
  giant.slamAction.reset().fadeIn(0.02).play();
}

export function stopVillagerRunning(villager) {
  villager.mixer.stopAllAction();
  poseBind(villager.root);
}

