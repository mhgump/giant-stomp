import { GIANT, HOUSE, VILLAGER } from './constants.js';
import { createGiantState, createVillagerState, createHouseState } from './entities.js';
import { tickEnergy } from '../systems/EnergySystem.js';
import { tickHouseInteraction } from '../systems/HouseSystem.js';
import { tickVillagerAI, tickHidingRopeDecision } from '../systems/VillagerAISystem.js';
import { tickRope, processSpacebar, tickThrownVillagers } from '../systems/RopeSystem.js';
import { executeRoar } from '../systems/RoarSystem.js';
import { tickCollisions } from '../systems/CollisionSystem.js';

const WALL_RADIUS = 32;

export class GameState {
  constructor(housePositions) {
    this.giant = createGiantState();
    this.houses = new Map();
    this.villagers = new Map();
    this.clock = { elapsed: 0, gameOver: false, winner: null };
    this.commands = [];

    // Initialize houses from scene data
    for (const h of housePositions) {
      this.houses.set(h.id, createHouseState(h.id, h.x, h.z, h.hasRope));
    }

    // Spawn villagers at random positions inside the ring wall
    for (let i = 0; i < VILLAGER.COUNT; i++) {
      let x, z;
      do {
        x = (Math.random() - 0.5) * WALL_RADIUS * 2;
        z = (Math.random() - 0.5) * WALL_RADIUS * 2;
      } while (Math.sqrt(x * x + z * z) > WALL_RADIUS - 2);
      const v = createVillagerState(i, x, z);
      this.villagers.set(i, v);
    }
  }

  addCommand(cmd) {
    this.commands.push(cmd);
  }

  tick(delta) {
    if (this.clock.gameOver) return;
    this.clock.elapsed += delta;

    // Process commands
    for (const cmd of this.commands) {
      this.processCommand(cmd);
    }
    this.commands.length = 0;

    // Systems
    tickEnergy(this, delta);
    this.tickGiantMovement(delta);
    tickHouseInteraction(this, delta);
    tickVillagerAI(this, delta);
    tickHidingRopeDecision(this, delta);
    tickCollisions(this);
    tickRope(this, delta);
    tickThrownVillagers(this, delta);

    // Win condition: all villagers dead
    this.checkWinCondition();
  }

  checkWinCondition() {
    let allDead = true;
    for (const v of this.villagers.values()) {
      if (v.alive) {
        allDead = false;
        break;
      }
    }
    if (allDead && this.villagers.size > 0) {
      this.clock.gameOver = true;
      this.clock.winner = 'giant';
    }
  }

  processCommand(cmd) {
    switch (cmd.type) {
      case 'move_to_house': {
        const house = this.houses.get(cmd.houseId);
        if (!house || house.destroyed) break;
        this.giant.status = 'moving_to_house';
        this.giant.targetX = house.x;
        this.giant.targetZ = house.z;
        this.giant.targetHouseId = cmd.houseId;
        break;
      }
      case 'move_to_villager': {
        const v = this.villagers.get(cmd.villagerId);
        if (!v || !v.alive) break;
        this.giant.status = 'moving_to_villager';
        this.giant.targetX = v.x;
        this.giant.targetZ = v.z;
        this.giant.targetVillagerId = cmd.villagerId;
        break;
      }
      case 'roar':
        executeRoar(this);
        break;
      case 'spam_space':
        processSpacebar(this);
        break;
    }
  }

  tickGiantMovement(delta) {
    const g = this.giant;
    if (g.status !== 'moving_to_house' && g.status !== 'moving_to_villager') return;

    // If tracking a villager, update target to their current location
    if (g.status === 'moving_to_villager' && g.targetVillagerId !== null) {
      const v = this.villagers.get(g.targetVillagerId);
      if (v && v.alive) {
        g.targetX = v.x;
        g.targetZ = v.z;
      } else {
        g.status = 'idle';
        return;
      }
    }

    const dx = g.targetX - g.x;
    const dz = g.targetZ - g.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    const arrivalDist = g.status === 'moving_to_house' ? HOUSE.PICKUP_DISTANCE : GIANT.COLLISION_RADIUS;

    if (dist < arrivalDist) {
      if (g.status === 'moving_to_house') {
        const house = this.houses.get(g.targetHouseId);
        if (house && !house.destroyed) {
          let netEnergy = -GIANT.PICKUP_COST;
          for (const vid of house.occupantIds) {
            const v = this.villagers.get(vid);
            if (v && v.alive) netEnergy += GIANT.KILL_RESTORE;
          }
          g.energy = Math.min(g.energy + netEnergy, g.maxEnergy);
          if (g.energy <= 0) {
            g.energy = 0;
            this.clock.gameOver = true;
            this.clock.winner = 'villagers';
            g.status = 'idle';
            g.targetX = null;
            g.targetZ = null;
            return;
          }
        }
        g.status = 'picking_up';
        g.pickupTimer = 0;
      } else {
        g.status = 'idle';
      }
      g.targetX = null;
      g.targetZ = null;
      return;
    }

    // Turn toward target (nose faces -Z, so offset by PI)
    const targetAngle = Math.atan2(dx, dz) + Math.PI;
    let angleDiff = targetAngle - g.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const maxTurn = GIANT.TURN_SPEED * delta;
    if (Math.abs(angleDiff) > maxTurn) {
      g.rotation += Math.sign(angleDiff) * maxTurn;
    } else {
      g.rotation += angleDiff;
    }

    // Only move when roughly facing target, clamp to not overshoot
    if (Math.abs(angleDiff) < Math.PI / 3) {
      const step = Math.min(GIANT.SPEED * delta, dist);
      g.x += (dx / dist) * step;
      g.z += (dz / dist) * step;
    }
  }

  serialize() {
    return JSON.stringify({
      giant: this.giant,
      houses: Array.from(this.houses.entries()),
      villagers: Array.from(this.villagers.entries()),
      clock: this.clock,
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const state = new GameState([]);
    state.giant = data.giant;
    state.houses = new Map(data.houses);
    state.villagers = new Map(data.villagers);
    state.clock = data.clock;
    return state;
  }
}
