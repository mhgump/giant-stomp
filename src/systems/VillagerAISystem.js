import { GIANT, VILLAGER } from '../state/constants.js';
import { buildPathToHouse, buildPathToPoint } from './Pathfinding.js';

export function tickVillagerAI(state, delta) {
  // Don't run AI for the first second so villagers are visible on spawn
  if (state.clock.elapsed < 1.0) return;

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
        break;
    }
  }
}

function isInGiantViewCone(state, x, z) {
  const g = state.giant;
  const dx = x - g.x;
  const dz = z - g.z;
  const angleToTarget = Math.atan2(dx, dz) + Math.PI;
  const angleDiff = Math.abs(normalizeAngle(angleToTarget - g.rotation));
  return angleDiff < GIANT.VIEW_CONE;
}

function tickHiding(state, v, delta) {
  if (v.houseId !== null) {
    const house = state.houses.get(v.houseId);
    if (house && house.destroyed) {
      ejectFromHouse(state, v);
      return;
    }
  }

  if (v.hasRope) return;

  if (v._scoutTimer === undefined) {
    v._scoutTimer = 3 + Math.random() * 5;
  }

  v._scoutTimer -= delta;
  if (v._scoutTimer > 0) return;

  v._scoutTimer = 4 + Math.random() * 6;

  const ropeHouse = findNearestRopeHouse(state, v);
  if (!ropeHouse) return;

  if (isInGiantViewCone(state, v.x, v.z)) return;

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
}

function tickMovingToHouse(state, v, delta) {
  const targetHouse = state.houses.get(v.targetHouseId);

  if (!targetHouse || targetHouse.destroyed) {
    v.targetHouseId = null;
    v.path = null;
    v.aiState = 'FLEEING';
    return;
  }

  // If already on an adjacent road (within half a cell diagonal of the house), go directly in
  const directDx = targetHouse.x - v.x;
  const directDz = targetHouse.z - v.z;
  const directDist = Math.sqrt(directDx * directDx + directDz * directDz);
  if (directDist < 6.0) {
    if (directDist < 1.5) {
      enterHouse(state, v, targetHouse);
      v.path = null;
    } else {
      moveToward(v, targetHouse.x, targetHouse.z, delta);
    }
    return;
  }

  // (Re)compute road path when target changes or path not yet built
  if (!v.path || v.pathTargetHouseId !== v.targetHouseId) {
    v.path = buildPathToHouse(state.roadGraph, v.x, v.z, targetHouse.x, targetHouse.z);
    v.pathIndex = 0;
    v.pathTargetHouseId = v.targetHouseId;
  }

  // Fallback to direct movement if no path found
  if (!v.path || v.path.length === 0) {
    if (directDist < 1.5) {
      enterHouse(state, v, targetHouse);
    } else {
      moveToward(v, targetHouse.x, targetHouse.z, delta);
    }
    return;
  }

  const wp = v.path[v.pathIndex];
  const dx = wp.x - v.x;
  const dz = wp.z - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  const isLast = v.pathIndex === v.path.length - 1;
  const threshold = isLast ? 1.5 : 1.0;

  if (dist < threshold) {
    if (isLast) {
      enterHouse(state, v, targetHouse);
      v.path = null;
    } else {
      v.pathIndex++;
    }
    return;
  }

  moveToward(v, wp.x, wp.z, delta);
}

function tickSeekingGiant(state, v, delta) {
  const g = state.giant;
  const dx = g.x - v.x;
  const dz = g.z - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Within throwing range — approach directly and attempt to rope
  if (dist < VILLAGER.ROPE_THROW_RANGE) {
    const angleToGiant = Math.atan2(dx, dz);
    const angleDiff = Math.abs(normalizeAngle(angleToGiant - v.rotation));

    if (angleDiff < VILLAGER.ROPE_THROW_ANGLE) {
      v.hasRope = false;
      v.aiState = 'ROPING';
      state._pendingRopes = state._pendingRopes || [];
      state._pendingRopes.push(v.id);
      return;
    }
    moveToward(v, g.x, g.z, delta);
    return;
  }

  // Follow road path toward the giant; recompute when giant moves significantly
  const needsRecompute = !v._ropeSeekPath ||
    !v._ropeSeekGiantPos ||
    Math.sqrt(
      (g.x - v._ropeSeekGiantPos.x) ** 2 + (g.z - v._ropeSeekGiantPos.z) ** 2
    ) > 4;

  if (needsRecompute) {
    v._ropeSeekPath = buildPathToPoint(state.roadGraph, v.x, v.z, g.x, g.z);
    v._ropeSeekPathIndex = 0;
    v._ropeSeekGiantPos = { x: g.x, z: g.z };
  }

  if (!v._ropeSeekPath || v._ropeSeekPathIndex >= v._ropeSeekPath.length) {
    moveToward(v, g.x, g.z, delta);
    return;
  }

  const wp = v._ropeSeekPath[v._ropeSeekPathIndex];
  const wdx = wp.x - v.x;
  const wdz = wp.z - v.z;
  const wdist = Math.sqrt(wdx * wdx + wdz * wdz);

  if (wdist < 1.0) {
    v._ropeSeekPathIndex++;
    return;
  }

  moveToward(v, wp.x, wp.z, delta);
}

function moveToward(v, targetX, targetZ, delta) {
  const dx = targetX - v.x;
  const dz = targetZ - v.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (dist < 0.1) return;

  v.rotation = Math.atan2(dx, dz);
  const step = Math.min(VILLAGER.SPEED * delta, dist);
  v.x += (dx / dist) * step;
  v.z += (dz / dist) * step;
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
  v.path = null;
  delete v._scoutTimer;
}

function enterHouse(state, v, house) {
  v.isInside = true;
  v.houseId = house.id;
  v.targetHouseId = null;
  v.aiState = 'HIDING';
  house.occupantIds.push(v.id);

  v.bannedHouseId = null;

  if (house.hasRope && !v.hasRope) {
    v.hasRope = true;
    house.hasRope = false;
  }

  if (v.hasRope) {
    v._ropeDecisionTimer = 2 + Math.random() * 3;
  }

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
  v.path = null;
  v.aiState = 'FLEEING';
  v.bannedHouseId = previousHouseId;
  delete v._scoutTimer;
  delete v._ropeSeekPath;
  delete v._ropeSeekGiantPos;
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

    const gDx = house.x - state.giant.x;
    const gDz = house.z - state.giant.z;
    const giantDist = Math.sqrt(gDx * gDx + gDz * gDz);

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
    if (house.id === v.houseId) continue;

    const toHouseX = house.x - v.x;
    const toHouseZ = house.z - v.z;
    const toGiantX = g.x - v.x;
    const toGiantZ = g.z - v.z;
    const toGiantDist = Math.sqrt(toGiantX * toGiantX + toGiantZ * toGiantZ);

    if (toGiantDist > 1) {
      const dot = (toHouseX * toGiantX + toHouseZ * toGiantZ) / toGiantDist;
      const houseDist = Math.sqrt(toHouseX * toHouseX + toHouseZ * toHouseZ);
      if (dot > 0 && houseDist > 1) {
        const cosAngle = dot / houseDist;
        if (cosAngle > 0.5) continue;
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
