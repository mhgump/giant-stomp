import { GIANT } from '../state/constants.js';
import { spendEnergy } from './EnergySystem.js';
import { ejectFromHouse } from './VillagerAISystem.js';

export function executeRoar(state) {
  if (!spendEnergy(state, GIANT.ROAR_COST)) return false;

  for (const v of state.villagers.values()) {
    if (v.alive && v.isInside) {
      ejectFromHouse(state, v);
    }
  }

  return true;
}
