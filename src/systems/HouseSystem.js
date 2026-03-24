import { GIANT, HOUSE } from '../state/constants.js';
import { spendEnergy, restoreEnergy } from './EnergySystem.js';

export function tickHouseInteraction(state, delta) {
  const g = state.giant;
  if (g.status !== 'slamming' || !g.targetHouseId) return;

  // At 0.5s into the slam: launch house + ragdoll villagers
  if (g.slamTimer >= GIANT.VILLAGER_RAGDOLL_TIME) {
    const house = state.houses.get(g.targetHouseId);
    if (house && !house.destroyed) {
      spendEnergy(state, GIANT.PICKUP_COST);

      for (const vid of house.occupantIds) {
        const v = state.villagers.get(vid);
        if (v && v.alive) {
          v.alive = false;
          v.isInside = false;
          v.houseId = null;
          v.ragdoll = true;
          v.ragdollY = 13;
          v.ragdollVelY = 3;
          v.x = house.x + (Math.random() - 0.5) * 3;
          v.z = house.z + (Math.random() - 0.5) * 3;
          restoreEnergy(state, GIANT.KILL_RESTORE);
        }
      }

      house.occupantIds = [];
      house.hasRope = false;
      house.destroyed = true;
      house.pickingUp = false;
    }
  }
}
