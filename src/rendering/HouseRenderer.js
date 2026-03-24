import { GIANT } from '../state/constants.js';

export class HouseRenderer {
  constructor(scene, houseMeshes) {
    this.scene = scene;
    this.meshes = houseMeshes; // Map<id, THREE.Group>
    this.removed = new Set();
  }

  sync(houseStates, giantState) {
    for (const [id, house] of houseStates) {
      const mesh = this.meshes.get(id);
      if (!mesh) continue;

      if (house.destroyed && !this.removed.has(id)) {
        this.scene.remove(mesh);
        this.removed.add(id);
        continue;
      }

      // Pickup animation: lift and shrink
      if (giantState.status === 'picking_up' && giantState.targetHouseId === id) {
        house.pickingUp = true;
        const progress = giantState.pickupTimer / GIANT.PICKUP_DURATION;
        mesh.position.y = progress * 8;
        const scale = 1 - progress * 0.8;
        mesh.scale.set(scale, scale, scale);
      }
    }
  }
}
