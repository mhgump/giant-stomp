const WALL_RADIUS     = 32;
const LAUNCH_DURATION = 1.0;   // seconds to reach max height
const ARC_DURATION    = 2.0;   // seconds to arc to landing zone
const MAX_HEIGHT      = 100;
const LAND_INNER      = WALL_RADIUS + 3; // base landing distance from origin

import * as THREE from 'three';

export class HouseRenderer {
  /**
   * @param {THREE.Scene} scene
   * @param {Map<number, THREE.Group>} houseMeshes
   * @param {import('../systems/HousePhysics.js').HousePhysics|null} physics
   */
  constructor(scene, houseMeshes, physics = null) {
    this.scene      = scene;
    this.meshes     = houseMeshes;
    this.animations = new Map(); // id -> anim state
    this.physics    = physics;
  }

  // Compute initial target landing position (radially outward from house origin)
  _landingPos(ox, oz) {
    const d     = Math.sqrt(ox * ox + oz * oz);
    const angle = d > 0.1 ? Math.atan2(oz, ox) : 0;
    return {
      lx: Math.cos(angle) * LAND_INNER,
      lz: Math.sin(angle) * LAND_INNER,
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
          // Tumbled-on-ground orientation
          mesh.rotation.set(Math.PI, Math.random() * Math.PI * 2, 0);

          // Use Rapier to find the final resting position, resolving any
          // overlaps with previously-landed houses (no bounce, heavy slide).
          let fx = anim.lx;
          let fz = anim.lz;
          if (this.physics) {
            const settled = this.physics.settle(id, anim.lx, anim.lz);
            fx = settled.x;
            fz = settled.z;
          }

          mesh.position.set(fx, 0, fz);
          mesh.updateMatrixWorld(true);

          // Ensure mesh sits above ground
          const box = new THREE.Box3().setFromObject(mesh);
          if (box.min.y < 0) mesh.position.y -= box.min.y;

          anim.phase = 'landed';
        }
      }
      // 'landed': position is fixed — no further updates
    }
  }
}
