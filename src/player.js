import * as THREE from 'three';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();

    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 12);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3366cc });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    this.group.add(body);

    const headGeo = new THREE.SphereGeometry(0.35, 12, 12);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc88 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.95;
    head.castShadow = true;
    this.group.add(head);

    // Direction indicator (nose)
    const noseGeo = new THREE.ConeGeometry(0.12, 0.25, 8);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0xff6644 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 1.9, -0.4);
    nose.rotation.x = -Math.PI / 2;
    this.group.add(nose);

    this.group.scale.set(5, 5, 5);
    scene.add(this.group);
  }

  get position() {
    return this.group.position;
  }

  get rotation() {
    return this.group.rotation.y;
  }

  syncFromState(giantState) {
    this.group.position.x = giantState.x;
    this.group.position.z = giantState.z;
    this.group.rotation.y = giantState.rotation;
  }
}
