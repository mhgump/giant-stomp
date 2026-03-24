import { GIANT } from './constants.js';

export function createGiantState() {
  return {
    x: 0,
    z: 0,
    rotation: 0,
    energy: GIANT.MAX_ENERGY,
    maxEnergy: GIANT.MAX_ENERGY,
    status: 'idle', // idle | moving_to_house | moving_to_villager | picking_up | roped
    targetX: null,
    targetZ: null,
    targetHouseId: null,
    targetVillagerId: null,
    pickupTimer: 0,
    slamTimer: 0,
    ropeStack: [],
    ropedTime: 0,
  };
}

export function createVillagerState(id, x, z) {
  return {
    id,
    x,
    z,
    rotation: 0,
    alive: true,
    aiState: 'FLEEING', // HIDING | FLEEING | MOVING_TO_HOUSE | SEEKING_GIANT_WITH_ROPE | ROPING
    isInside: false,
    houseId: null,
    targetHouseId: null,
    hasRope: false,
    bannedHouseId: null,
    // thrown animation state
    thrown: false,
    throwVelX: 0,
    throwVelY: 0,
    throwVelZ: 0,
    throwY: 0,
    // ragdoll state (ejected from destroyed house)
    ragdoll: false,
    ragdollY: 0,
    ragdollVelY: 0,
  };
}

export function createHouseState(id, x, z, hasRope = false) {
  return {
    id,
    x,
    z,
    destroyed: false,
    hasRope,
    occupantIds: [],
    pickingUp: false,
    pickupProgress: 0,
  };
}
