export class HUD {
  constructor(input) {
    this.input = input;

    // Internal state for combined action button
    this._prevRoped       = false;
    this._roarAvailableAt = 0; // seconds; 0 = immediately available

    // Container
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      width:         '100%',
      height:        '100%',
      pointerEvents: 'none',
      zIndex:        '200',
      fontFamily:    'sans-serif',
    });
    document.body.appendChild(this.container);

    // ── Energy bar — left vertical edge ──────────────────────────────────────
    // Fills bottom-to-top; gradient red (empty) → green (full).
    this.energyBarOuter = document.createElement('div');
    Object.assign(this.energyBarOuter.style, {
      position:     'absolute',
      left:         '8px',
      top:          '60px',
      bottom:       '60px',
      width:        '14px',
      background:   'rgba(0,0,0,0.5)',
      borderRadius: '7px',
      overflow:     'hidden',
      border:       '2px solid rgba(255,255,255,0.3)',
    });
    this.energyBarInner = document.createElement('div');
    Object.assign(this.energyBarInner.style, {
      position:     'absolute',
      bottom:       '0',
      left:         '0',
      width:        '100%',
      height:       '100%',
      background:   'linear-gradient(to top, #ff4444, #ffaa00, #44ff44)',
      borderRadius: '5px',
      transition:   'height 0.1s',
    });
    this.energyBarOuter.appendChild(this.energyBarInner);
    this.container.appendChild(this.energyBarOuter);

    // ── Combined ROAR / BREAK button — top centre ─────────────────────────────
    // Four-edge fully-rounded rectangle, 60 vw wide.
    // Default = ROAR (orange). While roped = BREAK (red).
    // After breaking free: hidden 1 s, then ROAR returns.
    this.actionButton = document.createElement('div');
    Object.assign(this.actionButton.style, {
      position:       'absolute',
      top:            '16px',
      left:           '50%',
      transform:      'translateX(-50%)',
      width:          '60vw',
      height:         '52px',
      borderRadius:   '26px',
      background:     'rgba(255, 180, 0, 0.85)',
      border:         '3px solid rgba(255,255,255,0.6)',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      color:          '#fff',
      fontSize:       '16px',
      fontWeight:     'bold',
      letterSpacing:  '1px',
      pointerEvents:  'auto',
      userSelect:     'none',
      touchAction:    'none',
      boxSizing:      'border-box',
    });
    this.actionButton.textContent = 'ROAR';
    this.actionButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this._fireAction();
    }, { passive: false });
    this.actionButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this._fireAction();
    });
    this.container.appendChild(this.actionButton);

    // ── Rope progress bar (shown when roped, below action button) ─────────────
    this.ropeBarOuter = document.createElement('div');
    Object.assign(this.ropeBarOuter.style, {
      position:     'absolute',
      top:          '78px',
      left:         '50%',
      transform:    'translateX(-50%)',
      width:        '60vw',
      height:       '8px',
      background:   'rgba(0,0,0,0.4)',
      borderRadius: '4px',
      overflow:     'hidden',
      display:      'none',
      boxSizing:    'border-box',
    });
    this.ropeBarInner = document.createElement('div');
    Object.assign(this.ropeBarInner.style, {
      width:        '0%',
      height:       '100%',
      background:   '#ff4444',
      borderRadius: '4px',
    });
    this.ropeBarOuter.appendChild(this.ropeBarInner);
    this.container.appendChild(this.ropeBarOuter);

    // ── Rope death-timer bar — right vertical edge ───────────────────────────
    // Shown only when roped. Decreases top-to-bottom over ROPE.DOWN_THRESHOLD.
    this.ropeTimerOuter = document.createElement('div');
    Object.assign(this.ropeTimerOuter.style, {
      position:     'absolute',
      right:        '8px',
      top:          '60px',
      bottom:       '60px',
      width:        '14px',
      background:   'rgba(0,0,0,0.5)',
      borderRadius: '7px',
      overflow:     'hidden',
      border:       '2px solid rgba(255,60,60,0.5)',
      display:      'none',
    });
    this.ropeTimerInner = document.createElement('div');
    Object.assign(this.ropeTimerInner.style, {
      position:     'absolute',
      bottom:       '0',
      left:         '0',
      width:        '100%',
      height:       '100%',
      background:   '#ff2222',
      borderRadius: '5px',
      transition:   'height 0.15s linear',
    });
    this.ropeTimerOuter.appendChild(this.ropeTimerInner);
    this.container.appendChild(this.ropeTimerOuter);

    // ── TURN button — bottom, three edges (no bottom border) ─────────────────
    // Rounded rectangle: top-left and top-right corners rounded; bottom edge open.
    // 60 vw wide, attaches to bottom of screen.
    // Highlights blue on press.
    this.turnButton = document.createElement('div');
    const turnBtnBase = {
      position:       'absolute',
      bottom:         '0',
      left:           '50%',
      transform:      'translateX(-50%)',
      width:          '60vw',
      height:         '52px',
      borderRadius:   '14px 14px 0 0',
      background:     'rgba(30, 100, 220, 0.75)',
      borderTop:      '3px solid rgba(160, 200, 255, 0.7)',
      borderLeft:     '3px solid rgba(160, 200, 255, 0.7)',
      borderRight:    '3px solid rgba(160, 200, 255, 0.7)',
      borderBottom:   'none',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      color:          '#fff',
      fontSize:       '16px',
      fontWeight:     'bold',
      letterSpacing:  '1px',
      pointerEvents:  'auto',
      userSelect:     'none',
      touchAction:    'none',
      boxSizing:      'border-box',
    };
    Object.assign(this.turnButton.style, turnBtnBase);
    this.turnButton.textContent = 'TURN';

    const pressStyle = () => {
      this.turnButton.style.background    = 'rgba(60, 150, 255, 0.95)';
      this.turnButton.style.borderTopColor    = 'rgba(120, 200, 255, 1.0)';
      this.turnButton.style.borderLeftColor   = 'rgba(120, 200, 255, 1.0)';
      this.turnButton.style.borderRightColor  = 'rgba(120, 200, 255, 1.0)';
    };
    const releaseStyle = () => {
      this.turnButton.style.background        = turnBtnBase.background;
      this.turnButton.style.borderTopColor    = 'rgba(160, 200, 255, 0.7)';
      this.turnButton.style.borderLeftColor   = 'rgba(160, 200, 255, 0.7)';
      this.turnButton.style.borderRightColor  = 'rgba(160, 200, 255, 0.7)';
    };

    this.turnButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      pressStyle();
      this.input.triggerTurn();
    }, { passive: false });
    this.turnButton.addEventListener('touchend', (e) => {
      e.preventDefault();
      releaseStyle();
    }, { passive: false });
    this.turnButton.addEventListener('touchcancel', () => releaseStyle());
    this.turnButton.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      pressStyle();
    });
    this.turnButton.addEventListener('mouseup', (e) => {
      e.stopPropagation();
      releaseStyle();
      this.input.triggerTurn();
    });
    this.turnButton.addEventListener('mouseleave', () => releaseStyle());
    this.container.appendChild(this.turnButton);

    // ── Rope danger flash — left / right edge panels ──────────────────────────
    const edgeStyle = {
      position:      'absolute',
      top:           '0',
      width:         '18%',
      height:        '100%',
      pointerEvents: 'none',
      opacity:       '0',
    };
    this.flashLeft = document.createElement('div');
    Object.assign(this.flashLeft.style, edgeStyle, {
      left:       '0',
      background: 'linear-gradient(to right, rgba(220,0,0,1) 0%, transparent 100%)',
    });
    this.flashRight = document.createElement('div');
    Object.assign(this.flashRight.style, edgeStyle, {
      right:      '0',
      background: 'linear-gradient(to left, rgba(220,0,0,1) 0%, transparent 100%)',
    });
    this.container.appendChild(this.flashLeft);
    this.container.appendChild(this.flashRight);

    // ── Game over screen ──────────────────────────────────────────────────────
    this.gameOverScreen = document.createElement('div');
    Object.assign(this.gameOverScreen.style, {
      position:       'absolute',
      top:            '0',
      left:           '0',
      width:          '100%',
      height:         '100%',
      display:        'none',
      alignItems:     'center',
      justifyContent: 'center',
      background:     'rgba(0,0,0,0.7)',
      color:          '#fff',
      fontSize:       '48px',
      fontWeight:     'bold',
      textAlign:      'center',
    });
    this.container.appendChild(this.gameOverScreen);
  }

  // Dispatch the correct action depending on the button's current mode
  _fireAction() {
    if (this.actionButton.textContent === 'BREAK') {
      this.input.triggerSpace();
    } else {
      this.input.triggerRoar();
    }
  }

  update(gameState) {
    const g     = gameState.giant;
    const roped = g.ropeStack.length > 0;
    const now   = performance.now() / 1000; // seconds

    // ── Energy bar (left vertical edge) ──────────────────────────────────────
    const pct = Math.max(0, (g.energy / g.maxEnergy) * 100);
    this.energyBarInner.style.height = `${pct}%`;

    // ── Combined action button state machine ──────────────────────────────────
    if (!this._prevRoped && roped) {
      // Giant just became roped → switch to BREAK
      this.actionButton.textContent      = 'BREAK';
      this.actionButton.style.background = 'rgba(255, 60, 60, 0.9)';
      this.actionButton.style.display    = 'flex';
    } else if (this._prevRoped && !roped) {
      // Giant just broke free → hide for 1 second
      this._roarAvailableAt              = now + 1.0;
      this.actionButton.style.display    = 'none';
    } else if (!roped && this.actionButton.style.display === 'none' && now >= this._roarAvailableAt) {
      // Cooldown elapsed → restore ROAR
      this.actionButton.textContent      = 'ROAR';
      this.actionButton.style.background = 'rgba(255, 180, 0, 0.85)';
      this.actionButton.style.display    = 'flex';
    }
    this._prevRoped = roped;

    // ── Rope break progress bar (below action button) ─────────────────────────
    this.ropeBarOuter.style.display = roped ? 'block' : 'none';
    if (roped) {
      const rope     = g.ropeStack[0];
      const progress = (rope.spamCount / 8) * 100; // ROPE.SPAM_HITS_NEEDED = 8
      this.ropeBarInner.style.width = `${progress}%`;
    }

    // ── Rope death-timer bar (right vertical edge) ───────────────────────────
    // Full height = safe; shrinks toward zero as death approaches.
    if (roped) {
      this.ropeTimerOuter.style.display = 'block';
      const remaining = Math.max(0, 1.0 - g.ropedTime / 10); // 10 = ROPE.DOWN_THRESHOLD
      this.ropeTimerInner.style.height  = `${remaining * 100}%`;
    } else {
      this.ropeTimerOuter.style.display = 'none';
    }

    // ── Rope danger flash ─────────────────────────────────────────────────────
    if (roped) {
      const danger  = Math.min(1, g.ropedTime / 10);
      const freq    = 0.4 + danger * 1.6;
      const pulse   = Math.max(0, Math.sin(Date.now() / 1000 * freq * Math.PI * 2));
      const opacity = pulse * (0.15 + danger * 0.65);
      this.flashLeft.style.opacity  = opacity;
      this.flashRight.style.opacity = opacity;
    } else {
      this.flashLeft.style.opacity  = 0;
      this.flashRight.style.opacity = 0;
    }

    // ── Game over ─────────────────────────────────────────────────────────────
    if (gameState.clock.gameOver) {
      this.gameOverScreen.style.display = 'flex';
      this.gameOverScreen.textContent   = gameState.clock.winner === 'giant'
        ? 'GIANT WINS!'
        : 'GIANT FALLS!';
    }
  }
}
