import { VILLAGER } from '../state/constants.js';

export function tickVillagerAI(state, delta) {
  for (const v of state.villagers.values()) {
    if (!v.alive || v.thrown) continue;

    switch (v.aiState) {
      case 'HIDING':
        tickHiding(state, v);
        break;
      case 'FLEEING':
        tickFleeing(state, v);
        break;
      case 'MOVING_TO_HOUSE':
        tickMovingToHouse(state, v, delta);
        break;
      case 'SEEKING_GIANT_WITH_ROPE':
        tickSeekingGiant(state, v, delta);
        break;
      case 'ROPING':
        // Stays in this state until rope system resolves it
        break;
    }
  }
}

function tickHiding(state, v) {
  // Check if our house was destroyed (giant picked it up)
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house && house.destroyed) {
      ejectFromHouse(state, v);
    }
  }
}

function tickFleeing(state, v) {
  // Find nearest non-destroyed, non-full house
  const target = findNearestSafeHouse(state, v);
  if (target) {
    v.targetHouseId = target.id;
    v.aiState = 'MOVING_TO_HOUSE';
  }
  // If no house available, just stand still (will get stomped)
}

function tickMovingToHouse(state, v, delta) {
  const targetHouse = state.houses.get(v.targetHouseId);

  // If target house was destroyed while moving, flee again
  if (!targetHouse || targetHouse.destroyed) {
    v.targetHouseId = null;
    v.aiState = 'FLEEING';
    return;
  }

  const dx = targetHouse.x - v.x;
  const dz = targetHouse.z - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < 1.5) {
    // Arrived at house — enter it
    enterHouse(state, v, targetHouse);
    return;
  }

  // Move toward house
  moveToward(v, targetHouse.x, targetHouse.z, delta);

  // Check if passing through a rope house and we don't have rope
  if (!v.hasRope) {
    for (const house of state.houses.values()) {
      if (house.destroyed || !house.hasRope || house.id === v.targetHouseId) continue;
      const hDx = house.x - v.x;
      const hDz = house.z - v.z;
      if (Math.sqrt(hDx * hDx + hDz * hDz) < 2) {
        v.hasRope = true;
        house.hasRope = false;
        break;
      }
    }
  }
}

function tickSeekingGiant(state, v, delta) {
  const g = state.giant;
  const dx = g.x - v.x;
  const dz = g.z - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist < VILLAGER.ROPE_THROW_RANGE) {
    // Check line of sight (simple angle check)
    const angleToGiant = Math.atan2(dx, dz);
    const angleDiff = Math.abs(normalizeAngle(angleToGiant - v.rotation));

    if (angleDiff < VILLAGER.ROPE_THROW_ANGLE) {
      // Throw rope!
      v.hasRope = false;
      v.aiState = 'ROPING';
      // Rope application handled by RopeSystem
      state._pendingRopes = state._pendingRopes || [];
      state._pendingRopes.push(v.id);
      return;
    }
  }

  // Move toward giant
  moveToward(v, g.x, g.z, delta);
}

function moveToward(v, targetX, targetZ, delta) {
  const dx = targetX - v.x;
  const dz = targetZ - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return;

  v.rotation = Math.atan2(dx, dz);
  v.x += (dx / dist) * VILLAGER.SPEED * delta;
  v.z += (dz / dist) * VILLAGER.SPEED * delta;
}

function enterHouse(state, v, house) {
  v.isInside = true;
  v.houseId = house.id;
  v.targetHouseId = null;
  v.aiState = 'HIDING';
  house.occupantIds.push(v.id);

  // If house had rope and villager didn't have one, pick it up
  if (house.hasRope && !v.hasRope) {
    v.hasRope = true;
    house.hasRope = false;
  }

  // If villager has rope, eventually decide to go seek the giant
  if (v.hasRope) {
    // Small delay before leaving to seek giant (handled by random chance each tick)
    v._ropeDecisionTimer = 2 + Math.random() * 3; // 2-5 seconds before leaving
  }
}

export function ejectFromHouse(state, v) {
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house) {
      house.occupantIds = house.occupantIds.filter(id => id !== v.id);
    }
  }
  v.isInside = false;
  v.houseId = null;
  v.aiState = 'FLEEING';
}

function findNearestSafeHouse(state, v) {
  let best = null;
  let bestDist = Infinity;

  for (const house of state.houses.values()) {
    if (house.destroyed) continue;

    const dx = house.x - v.x;
    const dz = house.z - v.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Prefer houses far from the giant
    const gDx = house.x - state.giant.x;
    const gDz = house.z - state.giant.z;
    const giantDist = Math.sqrt(gDx * gDx + gDz * gDz);

    // Score: closer to villager is better, farther from giant is better
    const score = dist - giantDist * 0.5;

    if (score < bestDist) {
      bestDist = score;
      best = house;
    }
  }

  return best;
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Called during HIDING to check if villager with rope should leave
export function tickHidingRopeDecision(state, delta) {
  for (const v of state.villagers.values()) {
    if (!v.alive || v.aiState !== 'HIDING' || !v.hasRope) continue;
    if (v._ropeDecisionTimer !== undefined) {
      v._ropeDecisionTimer -= delta;
      if (v._ropeDecisionTimer <= 0) {
        delete v._ropeDecisionTimer;
        ejectFromHouse(state, v);
        v.aiState = 'SEEKING_GIANT_WITH_ROPE';
      }
    }
  }
}
