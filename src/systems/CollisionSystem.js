import { GIANT } from '../state/constants.js';
import { restoreEnergy } from './EnergySystem.js';

export function tickCollisions(state) {
  const g = state.giant;

  for (const v of state.villagers.values()) {
    if (!v.alive || v.isInside || v.thrown) continue;

    const dx = v.x - g.x;
    const dz = v.z - g.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < GIANT.COLLISION_RADIUS) {
      v.alive = false;
      restoreEnergy(state, GIANT.KILL_RESTORE);
    }
  }
}
