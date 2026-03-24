import * as THREE from 'three';

export class InputManager {
  constructor(camera, houseMeshes) {
    this.camera = camera;
    this.houseMeshes = houseMeshes; // Map<id, THREE.Group>
    this.raycaster = new THREE.Raycaster();
    this.pendingCommand = null;
    this.spacePressed = false;
    this.roarPressed = false;

    // Touch (primary) and mouse (fallback for desktop testing)
    window.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.castFromScreen(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive: false });

    window.addEventListener('click', (e) => {
      this.castFromScreen(e.clientX, e.clientY);
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this.spacePressed = true;
      }
      if (e.code === 'KeyR') {
        this.roarPressed = true;
      }
    });
  }

  castFromScreen(screenX, screenY) {
    const ndc = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(ndc, this.camera);

    // Collect all meshes from house groups
    const meshes = [];
    for (const [, group] of this.houseMeshes) {
      group.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
    }

    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      // Walk up to find the group with userData.id
      let target = hits[0].object;
      while (target.parent && target.userData.id === undefined) {
        target = target.parent;
      }
      if (target.userData.id !== undefined) {
        this.pendingCommand = { type: 'move_to_house', houseId: target.userData.id };
      }
    }
  }

  consumeCommand() {
    const cmd = this.pendingCommand;
    this.pendingCommand = null;
    return cmd;
  }

  consumeSpace() {
    if (this.spacePressed) {
      this.spacePressed = false;
      return true;
    }
    return false;
  }

  consumeRoar() {
    if (this.roarPressed) {
      this.roarPressed = false;
      return true;
    }
    return false;
  }

  // Called by HUD break button
  triggerSpace() {
    this.spacePressed = true;
  }

  // Called by HUD roar button
  triggerRoar() {
    this.roarPressed = true;
  }
}
