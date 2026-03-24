import { GIANT, HOUSE } from '../state/constants.js';
import { spendEnergy, restoreEnergy } from './EnergySystem.js';

export function tickHouseInteraction(state, delta) {
  const g = state.giant;
  if (g.status !== 'picking_up') return;

  g.pickupTimer += delta;

  if (g.pickupTimer >= GIANT.PICKUP_DURATION) {
    resolvePickup(state);
  }
}

function resolvePickup(state) {
  const g = state.giant;
  const house = state.houses.get(g.targetHouseId);

  if (house && !house.destroyed) {
    // Spend energy to pick up
    spendEnergy(state, GIANT.PICKUP_COST);

    // Consume occupants and restore energy
    for (const vid of house.occupantIds) {
      const v = state.villagers.get(vid);
      if (v && v.alive) {
        v.alive = false;
        v.isInside = false;
        v.houseId = null;
        restoreEnergy(state, GIANT.KILL_RESTORE);
      }
    }
    house.occupantIds = [];

    // Destroy rope and house
    house.hasRope = false;
    house.destroyed = true;
    house.pickingUp = false;
  }

  g.status = 'idle';
  g.targetHouseId = null;
  g.pickupTimer = 0;
}
