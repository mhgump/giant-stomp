import { createVillager } from '../characters.js';

export class VillagerRenderer {
  constructor(scene, characterLibrary) {
    this.scene   = scene;
    this.library = characterLibrary;
    this.villagers = new Map(); // id -> { character, tumbleRate, boneData }
  }

  sync(villagerStates, delta) {
    for (const [id, v] of villagerStates) {
      let entry = this.villagers.get(id);

      if (!entry) {
        const character = createVillager(this.library);
        this.scene.add(character.root);
        entry = {
          character,
          tumbleRate: (Math.random() * 2 + 1.5),
          boneData: null,
        };
        this.villagers.set(id, entry);
      }

      const { character } = entry;

      // --- Dead villager ---
      if (!v.alive) {
        if (!v.ragdoll) {
          character.root.visible = false;
          continue;
        }

        character.root.visible = true;
        character.root.position.set(v.x, v.ragdollY, v.z);

        // First frame of ragdoll: stop animation and collect skeleton bones
        if (!entry.boneData) {
          character.mixer.stopAllAction();
          entry.boneData = _initBoneData(character.root);
        }

        if (v.ragdollY > 0) {
          // Airborne: tumble the root group and animate every skeleton bone
          character.root.rotation.x += entry.tumbleRate * delta;
          character.root.rotation.z += entry.tumbleRate * 0.6 * delta;
          _animateBones(entry.boneData, delta);
        } else {
          // Landed: apply a one-time collapsed-heap pose using the skeleton
          if (!entry.boneData.poseApplied) {
            character.root.rotation.set(Math.PI / 2, v.rotation + Math.PI, 0);
            _applyLandedBonePose(entry.boneData);
            entry.boneData.poseApplied = true;
          }
        }
        continue;
      }

      // Alive — reset any stale bone data
      entry.boneData = null;

      character.root.visible = true;
      character.root.position.set(v.x, 0, v.z);
      character.root.rotation.x = 0;
      character.root.rotation.z = 0;
      character.root.rotation.y = v.rotation + Math.PI;

      if (v.isInside || v.aiState === 'ROPING') {
        if (character.runAction.isRunning()) character.mixer.stopAllAction();
      } else {
        if (!character.runAction.isRunning()) character.runAction.reset().play();
        character.mixer.update(delta);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Skeleton ragdoll helpers
// ---------------------------------------------------------------------------

/** Collect every THREE.Bone in the hierarchy and assign random flail params. */
function _initBoneData(root) {
  const bones = [];
  root.traverse(child => {
    if (!child.isBone) return;
    bones.push({
      bone:  child,
      phase: Math.random() * Math.PI * 2,
      rateX: (Math.random() - 0.5) * 7.0,
      rateY: (Math.random() - 0.5) * 3.0,
      rateZ: (Math.random() - 0.5) * 7.0,
      ampX:  0.4 + Math.random() * 0.7,
      ampZ:  0.4 + Math.random() * 0.7,
    });
  });
  return { bones, time: 0, poseApplied: false };
}

/** Drive each bone with independent sinusoidal motion to simulate flailing. */
function _animateBones(boneData, delta) {
  boneData.time += delta;
  const t = boneData.time;
  for (const b of boneData.bones) {
    b.bone.rotation.x = Math.sin(b.phase        + t * b.rateX) * b.ampX;
    b.bone.rotation.y = Math.sin(b.phase * 1.3  + t * b.rateY) * 0.3;
    b.bone.rotation.z = Math.sin(b.phase * 0.7  + t * b.rateZ) * b.ampZ;
  }
}

/** Freeze every bone in a randomised static pose — looks like a crumpled heap. */
function _applyLandedBonePose(boneData) {
  for (const b of boneData.bones) {
    b.bone.rotation.x = (Math.random() - 0.5) * 0.9;
    b.bone.rotation.y = (Math.random() - 0.5) * 0.4;
    b.bone.rotation.z = (Math.random() - 0.5) * 0.9;
  }
}
