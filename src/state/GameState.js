import { GIANT, HOUSE, VILLAGER } from './constants.js';
import { createGiantState, createVillagerState, createHouseState } from './entities.js';
import { tickEnergy } from '../systems/EnergySystem.js';
import { tickHouseInteraction } from '../systems/HouseSystem.js';
import { tickVillagerAI, tickHidingRopeDecision } from '../systems/VillagerAISystem.js';
import { tickRope, processSpacebar, tickThrownVillagers } from '../systems/RopeSystem.js';
import { executeRoar } from '../systems/RoarSystem.js';
import { tickCollisions } from '../systems/CollisionSystem.js';
import { RoadGraph, buildPathToHouse } from '../systems/Pathfinding.js';

const WALL_RADIUS = 32;

export class GameState {
  constructor(housePositions) {
    this.giant = createGiantState();
    this.houses = new Map();
    this.villagers = new Map();
    this.clock = { elapsed: 0, gameOver: false, winner: null };
    this.commands = [];
    this.roadGraph = new RoadGraph();

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
    this.tickTurnAnimation(delta);
    this.tickGiantMovement(delta);
    tickHouseInteraction(this, delta);
    tickVillagerAI(this, delta);
    tickHidingRopeDecision(this, delta);
    tickCollisions(this);
    tickRope(this, delta);
    tickThrownVillagers(this, delta);
    this.tickRagdollVillagers(delta);

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
        this.giant.path = buildPathToHouse(this.roadGraph, this.giant.x, this.giant.z, house.x, house.z);
        this.giant.pathIndex = 0;
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
      case 'turn': {
        const g = this.giant;
        if (g.turnAnim) break; // already mid-turn, ignore
        // Start a smooth 180° turn; cancel navigation so the giant pivots cleanly
        g.turnAnim = { fromRot: g.rotation, toRot: g.rotation + Math.PI, progress: 0 };
        g.status = 'idle';
        g.targetX = null;
        g.targetZ = null;
        g.path = null;
        g.targetHouseId = null;
        g.targetVillagerId = null;
        break;
      }
    }
  }

  tickGiantMovement(delta) {
    const g = this.giant;

    if (g.status === 'slamming') {
      g.slamTimer += delta;
      if (g.slamTimer >= GIANT.SLAM_DURATION) {
        // Guard against large deltas that skip over VILLAGER_RAGDOLL_TIME in one frame,
        // which would cause tickGiantMovement to reset state before tickHouseInteraction fires.
        tickHouseInteraction(this, delta);
        g.status = 'idle';
        g.slamTimer = 0;
        g.targetHouseId = null;
      }
      return;
    }

    if (g.status !== 'moving_to_house' && g.status !== 'moving_to_villager') return;

    // --- Moving to house: follow road path ---
    if (g.status === 'moving_to_house') {
      if (!g.path || g.pathIndex >= g.path.length) {
        g.status = 'idle';
        return;
      }

      // Skip intermediate waypoints the giant is already close to 
      while (g.pathIndex < g.path.length - 1) {
        const skip = g.path[g.pathIndex];
        const sdx = skip.x - g.x;
        const sdz = skip.z - g.z;
        if (sdx * sdx + sdz * sdz < 5) {
          g.pathIndex++;
        } else {
          break;
        }
      }

      const wp = g.path[g.pathIndex];
      const dx = wp.x - g.x;
      const dz = wp.z - g.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      const isLast = g.pathIndex === g.path.length - 1;
      const threshold = isLast ? HOUSE.PICKUP_DISTANCE : 1.0;

      if (dist < threshold) {
        if (isLast) {
          g.status = 'slamming';
          g.slamTimer = 0;
          g.targetX = null;
          g.targetZ = null;
          g.path = null;
        } else {
          g.pathIndex++;
        }
        return;
      }

      this._turnAndMove(g, dx, dz, dist, delta);
      return;
    }

    // --- Moving to villager: direct movement ---
    if (g.targetVillagerId !== null) {
      const v = this.villagers.get(g.targetVillagerId);
      if (v && v.alive) {
        g.targetX = v.x;
        g.targetZ = v.z;
      } else {
        g.status = 'idle';
        return;
      }
    }

    {
      const dx = g.targetX - g.x;
      const dz = g.targetZ - g.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < GIANT.COLLISION_RADIUS) {
        g.status = 'idle';
        g.targetX = null;
        g.targetZ = null;
        return;
      }

      this._turnAndMove(g, dx, dz, dist, delta);
    }
  }

  _turnAndMove(g, dx, dz, dist, delta) {
    const targetAngle = Math.atan2(dx, dz);
    let angleDiff = targetAngle - g.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const maxTurn = GIANT.TURN_SPEED * delta;
    if (Math.abs(angleDiff) > maxTurn) {
      g.rotation += Math.sign(angleDiff) * maxTurn;
    } else {
      g.rotation += angleDiff;
    }

    if (Math.abs(angleDiff) < Math.PI / 3) {
      const step = Math.min(GIANT.SPEED * delta, dist);
      g.x += (dx / dist) * step;
      g.z += (dz / dist) * step;
    }
  }

  tickTurnAnimation(delta) {
    const g = this.giant;
    if (!g.turnAnim) return;

    const TURN_DURATION = 0.5; // seconds for a full 180°
    g.turnAnim.progress += delta / TURN_DURATION;

    if (g.turnAnim.progress >= 1.0) {
      // Snap to exact target and normalise to (−π, π]
      g.rotation = g.turnAnim.toRot;
      while (g.rotation >  Math.PI) g.rotation -= Math.PI * 2;
      while (g.rotation < -Math.PI) g.rotation += Math.PI * 2;
      g.turnAnim = null;
    } else {
      // Smoothstep easing: slow start, fast middle, slow end
      const t = _smoothstep(g.turnAnim.progress);
      g.rotation = g.turnAnim.fromRot + (g.turnAnim.toRot - g.turnAnim.fromRot) * t;
    }
  }

  tickRagdollVillagers(delta) {
    const gravity = 20;
    for (const v of this.villagers.values()) {
      if (!v.ragdoll || (v.ragdollY <= 0 && v.ragdollVelY <= 0)) continue;
      v.ragdollVelY -= gravity * delta;
      v.ragdollY = Math.max(0, v.ragdollY + v.ragdollVelY * delta);
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

// Smoothstep: slow → fast → slow easing for the turn animation
function _smoothstep(t) {
  return t * t * (3 - 2 * t);
}
