export class HUD {
  constructor(input) {
    this.input = input;

    // Container
    this.container = document.createElement('div');
    Object.assign(this.container.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '200',
      fontFamily: 'sans-serif',
    });
    document.body.appendChild(this.container);

    // Energy bar
    this.energyBarOuter = document.createElement('div');
    Object.assign(this.energyBarOuter.style, {
      position: 'absolute',
      top: '16px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '200px',
      height: '20px',
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '10px',
      overflow: 'hidden',
      border: '2px solid rgba(255,255,255,0.3)',
    });
    this.energyBarInner = document.createElement('div');
    Object.assign(this.energyBarInner.style, {
      width: '100%',
      height: '100%',
      background: 'linear-gradient(to right, #ff4444, #ffaa00, #44ff44)',
      borderRadius: '8px',
      transition: 'width 0.1s',
    });
    this.energyBarOuter.appendChild(this.energyBarInner);
    this.container.appendChild(this.energyBarOuter);

    // Rope action button (mobile)
    this.ropeButton = document.createElement('div');
    Object.assign(this.ropeButton.style, {
      position: 'absolute',
      bottom: '40px',
      right: '40px',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'rgba(255, 80, 80, 0.8)',
      border: '3px solid rgba(255,255,255,0.6)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center',
      lineHeight: '80px',
      pointerEvents: 'auto',
      userSelect: 'none',
      touchAction: 'none',
    });
    this.ropeButton.textContent = 'BREAK';
    this.ropeButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.triggerSpace();
    }, { passive: false });
    this.ropeButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.input.triggerSpace();
    });
    this.container.appendChild(this.ropeButton);

    // Roar button (mobile) — always visible, bottom center
    this.roarButton = document.createElement('div');
    Object.assign(this.roarButton.style, {
      position: 'absolute',
      bottom: '40px',
      left: '50%',
      transform: 'translateX(-50%)',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'rgba(255, 180, 0, 0.8)',
      border: '3px solid rgba(255,255,255,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontSize: '14px',
      fontWeight: 'bold',
      textAlign: 'center',
      lineHeight: '80px',
      pointerEvents: 'auto',
      userSelect: 'none',
      touchAction: 'none',
    });
    this.roarButton.textContent = 'ROAR';
    this.roarButton.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.input.triggerRoar();
    }, { passive: false });
    this.roarButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.input.triggerRoar();
    });
    this.container.appendChild(this.roarButton);

    // Rope progress bar (shown when roped)
    this.ropeBarOuter = document.createElement('div');
    Object.assign(this.ropeBarOuter.style, {
      position: 'absolute',
      bottom: '130px',
      right: '20px',
      width: '120px',
      height: '12px',
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '6px',
      overflow: 'hidden',
      display: 'none',
    });
    this.ropeBarInner = document.createElement('div');
    Object.assign(this.ropeBarInner.style, {
      width: '0%',
      height: '100%',
      background: '#ff4444',
      borderRadius: '4px',
    });
    this.ropeBarOuter.appendChild(this.ropeBarInner);
    this.container.appendChild(this.ropeBarOuter);

    // Rope danger flash — left and right vertical edge panels
    const edgeStyle = {
      position: 'absolute',
      top: '0',
      width: '18%',
      height: '100%',
      pointerEvents: 'none',
      opacity: '0',
    };
    this.flashLeft = document.createElement('div');
    Object.assign(this.flashLeft.style, edgeStyle, {
      left: '0',
      background: 'linear-gradient(to right, rgba(220,0,0,1) 0%, transparent 100%)',
    });
    this.flashRight = document.createElement('div');
    Object.assign(this.flashRight.style, edgeStyle, {
      right: '0',
      background: 'linear-gradient(to left, rgba(220,0,0,1) 0%, transparent 100%)',
    });
    this.container.appendChild(this.flashLeft);
    this.container.appendChild(this.flashRight);

    // Game over screen
    this.gameOverScreen = document.createElement('div');
    Object.assign(this.gameOverScreen.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      fontSize: '48px',
      fontWeight: 'bold',
      textAlign: 'center',
    });
    this.container.appendChild(this.gameOverScreen);
  }

  update(gameState) {
    const g = gameState.giant;

    // Energy bar
    const pct = Math.max(0, (g.energy / g.maxEnergy) * 100);
    this.energyBarInner.style.width = `${pct}%`;

    // Break button + progress only when roped; roar always visible
    const roped = g.ropeStack.length > 0;
    this.ropeButton.style.display = roped ? 'flex' : 'none';
    this.ropeBarOuter.style.display = roped ? 'block' : 'none';
    if (roped) {
      const rope = g.ropeStack[0];
      const progress = (rope.spamCount / 8) * 100; // ROPE.SPAM_HITS_NEEDED
      this.ropeBarInner.style.width = `${progress}%`;
    }

    // Rope danger flash
    if (roped) {
      const danger = Math.min(1, g.ropedTime / 10); // 10 = ROPE.DOWN_THRESHOLD
      const freq = 0.4 + danger * 1.6; // 0.4–2 Hz
      const pulse = Math.max(0, Math.sin(Date.now() / 1000 * freq * Math.PI * 2));
      const opacity = pulse * (0.15 + danger * 0.65);
      this.flashLeft.style.opacity = opacity;
      this.flashRight.style.opacity = opacity;
    } else {
      this.flashLeft.style.opacity = 0;
      this.flashRight.style.opacity = 0;
    }

    // Game over
    if (gameState.clock.gameOver) {
      this.gameOverScreen.style.display = 'flex';
      this.gameOverScreen.textContent = gameState.clock.winner === 'giant'
        ? 'GIANT WINS!'
        : 'GIANT FALLS!';
    }
  }
}
