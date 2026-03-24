import * as THREE from 'three';

export class InputManager {
  constructor(camera, selectableObjects) {
    this.camera = camera;
    this.selectableObjects = selectableObjects;
    this.raycaster = new THREE.Raycaster();
    this.target = null; // world position to move toward

    // Touch (primary) and mouse (fallback for desktop testing)
    window.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.castFromScreen(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive: false });

    window.addEventListener('click', (e) => {
      this.castFromScreen(e.clientX, e.clientY);
    });
  }

  castFromScreen(screenX, screenY) {
    const ndc = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );

    this.raycaster.setFromCamera(ndc, this.camera);

    // Collect all meshes from selectable groups
    const meshes = [];
    for (const obj of this.selectableObjects) {
      obj.traverse((child) => {
        if (child.isMesh) meshes.push(child);
      });
    }

    const hits = this.raycaster.intersectObjects(meshes);
    if (hits.length > 0) {
      // Walk up to find the group with userData.type
      let target = hits[0].object;
      while (target.parent && !target.userData.type) {
        target = target.parent;
      }
      this.target = target.position.clone();
    }
  }
}
