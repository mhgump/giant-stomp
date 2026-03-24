import { GIANT, VILLAGER } from '../state/constants.js';

export function tickVillagerAI(state, delta) {
  for (const v of state.villagers.values()) {
    if (!v.alive || v.thrown) continue;

    switch (v.aiState) {
      case 'HIDING':
        tickHiding(state, v, delta);
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

// Returns true if the giant is looking toward position (x, z)
function isInGiantViewCone(state, x, z) {
  const g = state.giant;
  const dx = x - g.x;
  const dz = z - g.z;
  // Giant nose faces -Z in local space, rotation.y has PI offset
  const angleToTarget = Math.atan2(dx, dz) + Math.PI;
  const angleDiff = Math.abs(normalizeAngle(angleToTarget - g.rotation));
  return angleDiff < GIANT.VIEW_CONE;
}

function tickHiding(state, v, delta) {
  // Check if our house was destroyed (giant picked it up)
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house && house.destroyed) {
      ejectFromHouse(state, v);
      return;
    }
  }

  // If villager has rope, the rope decision timer handles leaving (see tickHidingRopeDecision)
  if (v.hasRope) return;

  // Proactive scouting: look for rope houses when giant isn't looking
  // Initialize scout timer if not set
  if (v._scoutTimer === undefined) {
    v._scoutTimer = 3 + Math.random() * 5; // 3-8 seconds before first scout attempt
  }

  v._scoutTimer -= delta;
  if (v._scoutTimer > 0) return;

  // Reset timer for next attempt
  v._scoutTimer = 4 + Math.random() * 6; // 4-10 seconds between attempts

  // Check if there's a rope house worth going to
  const ropeHouse = findNearestRopeHouse(state, v);
  if (!ropeHouse) return;

  // Only leave if the giant is NOT looking at our house
  if (isInGiantViewCone(state, v.x, v.z)) return;

  // Leave house to go find rope
  const currentHouseId = v.houseId;
  leaveHouse(state, v);
  v.targetHouseId = ropeHouse.id;
  v.aiState = 'MOVING_TO_HOUSE';
}

function tickFleeing(state, v) {
  const target = findNearestSafeHouse(state, v);
  if (target) {
    v.targetHouseId = target.id;
    v.aiState = 'MOVING_TO_HOUSE';
  }
  // If no house available, just stand still
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

function leaveHouse(state, v) {
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house) {
      house.occupantIds = house.occupantIds.filter(id => id !== v.id);
    }
  }
  v.isInside = false;
  v.houseId = null;
  delete v._scoutTimer;
}

function enterHouse(state, v, house) {
  v.isInside = true;
  v.houseId = house.id;
  v.targetHouseId = null;
  v.aiState = 'HIDING';
  house.occupantIds.push(v.id);

  // Clear the banned house now that we've entered a different one
  v.bannedHouseId = null;

  // If house had rope and villager didn't have one, pick it up
  if (house.hasRope && !v.hasRope) {
    v.hasRope = true;
    house.hasRope = false;
  }

  // If villager has rope, eventually decide to go seek the giant
  if (v.hasRope) {
    v._ropeDecisionTimer = 2 + Math.random() * 3; // 2-5 seconds before leaving
  }

  // Reset scout timer
  v._scoutTimer = 3 + Math.random() * 5;
}

export function ejectFromHouse(state, v) {
  const previousHouseId = v.houseId;
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house) {
      house.occupantIds = house.occupantIds.filter(id => id !== v.id);
    }
  }
  v.isInside = false;
  v.houseId = null;
  v.aiState = 'FLEEING';
  // Ban the house they were ejected from (roar) until they enter another
  v.bannedHouseId = previousHouseId;
  delete v._scoutTimer;
}

function findNearestSafeHouse(state, v) {
  let best = null;
  let bestScore = Infinity;

  for (const house of state.houses.values()) {
    if (house.destroyed) continue;
    if (house.id === v.bannedHouseId) continue;

    const dx = house.x - v.x;
    const dz = house.z - v.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Prefer houses far from the giant
    const gDx = house.x - state.giant.x;
    const gDz = house.z - state.giant.z;
    const giantDist = Math.sqrt(gDx * gDx + gDz * gDz);

    // Score: closer to villager is better, farther from giant is better
    const score = dist - giantDist * 0.5;

    if (score < bestScore) {
      bestScore = score;
      best = house;
    }
  }

  return best;
}

function findNearestRopeHouse(state, v) {
  let best = null;
  let bestDist = Infinity;
  const g = state.giant;

  for (const house of state.houses.values()) {
    if (house.destroyed || !house.hasRope) continue;
    if (house.id === v.houseId) continue; // already in this house

    // Skip houses that are in the direction of the giant from the villager
    const toHouseX = house.x - v.x;
    const toHouseZ = house.z - v.z;
    const toGiantX = g.x - v.x;
    const toGiantZ = g.z - v.z;
    const toGiantDist = Math.sqrt(toGiantX * toGiantX + toGiantZ * toGiantZ);

    if (toGiantDist > 1) {
      // Dot product to check if house is in the same direction as the giant
      const dot = (toHouseX * toGiantX + toHouseZ * toGiantZ) / toGiantDist;
      const houseDist = Math.sqrt(toHouseX * toHouseX + toHouseZ * toHouseZ);
      // If the house is closer than the giant and in roughly the same direction (within 60°)
      if (dot > 0 && houseDist > 1) {
        const cosAngle = dot / houseDist;
        if (cosAngle > 0.5) continue; // skip — too close to giant's direction
      }
    }

    const dx = house.x - v.x;
    const dz = house.z - v.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < bestDist) {
      bestDist = dist;
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
        leaveHouse(state, v);
        v.aiState = 'SEEKING_GIANT_WITH_ROPE';
      }
    }
  }
}
