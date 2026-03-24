import { GIANT, HOUSE } from '../state/constants.js';
import { spendEnergy, restoreEnergy } from './EnergySystem.js';

const RAGDOLL_GRAVITY = 20;
const FLY_HEIGHT = HOUSE.WALL_HEIGHT * 3;
// Upward velocity needed to reach FLY_HEIGHT under RAGDOLL_GRAVITY
const FLY_LAUNCH_VEL = Math.sqrt(2 * RAGDOLL_GRAVITY * FLY_HEIGHT);

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
          v.ragdollY = 0;
          v.ragdollVelY = FLY_LAUNCH_VEL;
          v.x = house.x;
          v.z = house.z;
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
