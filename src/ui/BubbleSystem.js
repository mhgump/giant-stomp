import * as THREE from 'three';

export class BubbleSystem {
  constructor(onBubbleClick) {
    this.onBubbleClick = onBubbleClick;
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '150',
    });
    document.body.appendChild(this.container);

    this.bubbles = new Map(); // villagerId -> DOM element
    this.margin = 40; // pixels from screen edge
  }

  update(gameState, camera) {
    const activeIds = new Set();

    for (const [id, v] of gameState.villagers) {
      if (!v.alive || v.isInside || v.thrown) continue;

      activeIds.add(id);
      let bubble = this.bubbles.get(id);
      if (!bubble) {
        bubble = this.createBubble(id, v);
        this.bubbles.set(id, bubble);
      }

      // Project villager world position to screen
      const worldPos = new THREE.Vector3(v.x, 1.5, v.z);
      const screenPos = worldPos.clone().project(camera);

      const hw = window.innerWidth / 2;
      const hh = window.innerHeight / 2;
      let sx = (screenPos.x * hw) + hw;
      let sy = -(screenPos.y * hh) + hh;

      // Check if behind camera
      const behindCamera = screenPos.z > 1;

      if (behindCamera) {
        // Flip to opposite side
        sx = window.innerWidth - sx;
        sy = window.innerHeight - sy;
      }

      // Check if on screen
      const onScreen = !behindCamera &&
        sx > this.margin && sx < window.innerWidth - this.margin &&
        sy > this.margin && sy < window.innerHeight - this.margin;

      if (onScreen) {
        // Show bubble near villager
        bubble.style.left = `${sx}px`;
        bubble.style.top = `${sy - 30}px`;
        bubble.textContent = '!';
        bubble.style.transform = 'translate(-50%, -50%)';
      } else {
        // Clamp to screen edge with arrow
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const dx = sx - cx;
        const dy = sy - cy;
        const angle = Math.atan2(dy, dx);

        const edgeX = Math.max(this.margin, Math.min(window.innerWidth - this.margin,
          cx + Math.cos(angle) * (hw - this.margin)));
        const edgeY = Math.max(this.margin, Math.min(window.innerHeight - this.margin,
          cy + Math.sin(angle) * (hh - this.margin)));

        bubble.style.left = `${edgeX}px`;
        bubble.style.top = `${edgeY}px`;
        bubble.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
        bubble.textContent = '\u25B6'; // triangle arrow
      }

      bubble.style.display = 'flex';
    }

    // Hide bubbles for villagers no longer exposed
    for (const [id, bubble] of this.bubbles) {
      if (!activeIds.has(id)) {
        bubble.style.display = 'none';
      }
    }
  }

  createBubble(villagerId, v) {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'absolute',
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'rgba(255, 200, 0, 0.85)',
      color: '#000',
      fontSize: '18px',
      fontWeight: 'bold',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: 'auto',
      cursor: 'pointer',
      userSelect: 'none',
      touchAction: 'none',
      boxShadow: '0 0 6px rgba(0,0,0,0.4)',
    });
    el.textContent = '!';

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.onBubbleClick(villagerId);
    };
    el.addEventListener('touchstart', handler, { passive: false });
    el.addEventListener('click', handler);

    this.container.appendChild(el);
    return el;
  }
}
