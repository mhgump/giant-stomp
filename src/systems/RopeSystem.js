import { ROPE } from '../state/constants.js';

export function tickRope(state, delta) {
  const g = state.giant;

  // Process pending rope throws from villager AI
  if (state._pendingRopes) {
    for (const villagerId of state._pendingRopes) {
      applyRope(state, villagerId);
    }
    state._pendingRopes = [];
  }

  if (g.ropeStack.length === 0) return;

  // Giant is roped — override status
  if (g.status !== 'roped') {
    g.status = 'roped';
    g.targetX = null;
    g.targetZ = null;
  }

  g.ropedTime += delta;

  // Check game-over condition
  if (g.ropedTime >= ROPE.DOWN_THRESHOLD) {
    state.clock.gameOver = true;
    state.clock.winner = 'villagers';
    return;
  }

  // Age out stale spam progress (reset if no hits within window)
  const oldest = g.ropeStack[0];
  if (oldest._lastHitTime !== undefined) {
    if (state.clock.elapsed - oldest._lastHitTime > ROPE.SPAM_WINDOW) {
      oldest.spamCount = 0;
    }
  }
}

function applyRope(state, villagerId) {
  state.giant.ropeStack.push({
    fromVillager: villagerId,
    appliedAt: state.clock.elapsed,
    spamCount: 0,
    _lastHitTime: undefined,
  });
}

export function processSpacebar(state) {
  const g = state.giant;
  if (g.ropeStack.length === 0) return;

  const oldest = g.ropeStack[0];
  oldest.spamCount++;
  oldest._lastHitTime = state.clock.elapsed;

  if (oldest.spamCount >= ROPE.SPAM_HITS_NEEDED) {
    // Break free from this rope — throw the roping villager
    const villagerId = oldest.fromVillager;
    g.ropeStack.shift();

    const v = state.villagers.get(villagerId);
    if (v && v.alive) {
      v.alive = false;
      v.isInside = false;
      v.ragdoll = true;
      v.ragdollY = 0;
      v.ragdollVelY = 12;
    }

    // If no more ropes, release giant
    if (g.ropeStack.length === 0) {
      g.ropedTime = 0;
      g.status = 'idle';
    }
  }
}

// Tick thrown villager physics (parabolic arc)
export function tickThrownVillagers(state, delta) {
  const gravity = 20;
  for (const v of state.villagers.values()) {
    if (!v.thrown) continue;

    v.x += v.throwVelX * delta;
    v.z += v.throwVelZ * delta;
    v.throwVelY -= gravity * delta;
    v.throwY += v.throwVelY * delta;

    // Landed
    if (v.throwY <= 0) {
      v.throwY = 0;
      v.thrown = false;
      // Already marked alive=false, renderer will hide
    }
  }
}
