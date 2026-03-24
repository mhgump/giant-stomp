export const GIANT = {
  MAX_ENERGY: 100,
  PASSIVE_DRAIN: 2,        // energy per second
  PICKUP_COST: 15,         // energy to pick up a house
  ROAR_COST: 20,           // energy to roar
  KILL_RESTORE: 12,        // energy restored per villager killed
  SPEED: 8,
  TURN_SPEED: 2.5,         // radians per second
  COLLISION_RADIUS: 3,
  PICKUP_DURATION: 1.5,    // seconds for pickup animation
};

export const VILLAGER = {
  COUNT: 12,
  SPEED: 5,
  ROPE_THROW_RANGE: 10,
  ROPE_THROW_ANGLE: Math.PI / 6, // 30 deg LOS cone
};

export const ROPE = {
  SPAM_WINDOW: 2,          // seconds per rope to escape
  DOWN_THRESHOLD: 10,      // seconds roped = game over
  SPAM_HITS_NEEDED: 8,     // space presses per rope to break free
  INITIAL_ROPE_HOUSES: 4,  // how many houses start with rope
};

export const HOUSE = {
  PICKUP_DISTANCE: 4,
};
