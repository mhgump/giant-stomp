const WALL_RADIUS = 32;
const LAUNCH_DURATION = 1.0; // seconds to reach max height
const ARC_DURATION = 2.0;    // seconds to fall to outside the wall
const MAX_HEIGHT = 100;
const LAND_INNER = WALL_RADIUS + 3;
const LAND_SPACING = 3.5;    // gap between stacked houses on the perimeter

import * as THREE from 'three';

export class HouseRenderer {
  constructor(scene, houseMeshes) {
    this.scene = scene;
    this.meshes = houseMeshes; // Map<id, THREE.Group>
    this.animations = new Map(); // id -> anim state
    this.landingSlots = new Map(); // angle bucket -> count (for stacking)
  }

  // Compute a landing position that stacks houses on the outside of the wall
  _landingPos(ox, oz) {
    const d = Math.sqrt(ox * ox + oz * oz);
    const angle = d > 0.1 ? Math.atan2(oz, ox) : 0;

    // Quantise to 16 angular slots around the perimeter
    const slotCount = 16;
    const slot = Math.round(((angle + Math.PI) / (Math.PI * 2)) * slotCount) % slotCount;
    const stackDepth = this.landingSlots.get(slot) ?? 0;
    this.landingSlots.set(slot, stackDepth + 1);

    const slotAngle = ((slot / slotCount) * Math.PI * 2) - Math.PI;
    const dist = LAND_INNER + stackDepth * LAND_SPACING;
    return {
      lx: Math.cos(slotAngle) * dist,
      lz: Math.sin(slotAngle) * dist,
    };
  }

  sync(houseStates, giantState, delta) {
    for (const [id, house] of houseStates) {
      const mesh = this.meshes.get(id);
      if (!mesh) continue;

      let anim = this.animations.get(id);

      // Start arc animation the moment house is destroyed
      if (house.destroyed && !anim) {
        const { lx, lz } = this._landingPos(house.x, house.z);
        anim = { phase: 'launch', timer: 0, ox: house.x, oz: house.z, lx, lz };
        this.animations.set(id, anim);
      }

      if (!anim) continue;

      anim.timer += delta;

      if (anim.phase === 'launch') {
        const t = Math.min(anim.timer / LAUNCH_DURATION, 1);
        mesh.position.set(anim.ox, t * MAX_HEIGHT, anim.oz);
        if (anim.timer >= LAUNCH_DURATION) {
          anim.phase = 'arc';
          anim.timer = 0;
        }

      } else if (anim.phase === 'arc') {
        const t = Math.min(anim.timer / ARC_DURATION, 1);
        mesh.position.x = anim.ox + (anim.lx - anim.ox) * t;
        mesh.position.z = anim.oz + (anim.lz - anim.oz) * t;
        mesh.position.y = Math.max(0, MAX_HEIGHT * (1 - t * t));
        mesh.rotation.x += delta * 2.5;
        mesh.rotation.z += delta * 1.8;

        if (anim.timer >= ARC_DURATION) {
          anim.phase = 'landed';
          mesh.rotation.set(Math.PI, Math.random() * Math.PI * 2, 0);
          mesh.position.set(anim.lx, 0, anim.lz);
          mesh.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(mesh);
          if (box.min.y < 0) mesh.position.y -= box.min.y;
        }
      }
      // 'landed': no more updates
    }
  }
}
