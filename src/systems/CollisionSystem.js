import { GIANT } from '../state/constants.js';
import { restoreEnergy } from './EnergySystem.js';

const STOMP_RAGDOLL_VEL = 10;

export function tickCollisions(state) {
  const g = state.giant;

  for (const v of state.villagers.values()) {
    if (!v.alive || v.isInside || v.thrown ||
        v.aiState === 'ROPING' || v.aiState === 'SEEKING_GIANT_WITH_ROPE') continue;

    const dx = v.x - g.x;
    const dz = v.z - g.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < GIANT.COLLISION_RADIUS) {
      v.alive = false;
      v.ragdoll = true;
      v.ragdollY = 0;
      v.ragdollVelY = STOMP_RAGDOLL_VEL;
      restoreEnergy(state, GIANT.KILL_RESTORE);
    }
  }
}
