import { GIANT } from '../state/constants.js';

export function tickEnergy(state, delta) {
  const g = state.giant;
  // TODO: re-enable passive drain once balancing
  // g.energy -= GIANT.PASSIVE_DRAIN * delta;
  if (g.energy <= 0) {
    g.energy = 0;
    state.clock.gameOver = true;
    state.clock.winner = 'villagers';
  }
}

export function spendEnergy(state, amount) {
  if (state.giant.energy < amount) return false;
  state.giant.energy -= amount;
  return true;
}

export function restoreEnergy(state, amount) {
  state.giant.energy = Math.min(state.giant.energy + amount, state.giant.maxEnergy);
}
