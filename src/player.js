import * as THREE from 'three';

export class Player {
  constructor(scene) {
    // Simple capsule-like character: body + head
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

    scene.add(this.group);

    this.speed = 8;
    this.turnSpeed = 3;
    this.velocity = new THREE.Vector3();
  }

  get position() {
    return this.group.position;
  }

  update(input, delta) {
    const direction = new THREE.Vector3();

    if (input.keys.forward) direction.z -= 1;
    if (input.keys.backward) direction.z += 1;
    if (input.keys.left) direction.x -= 1;
    if (input.keys.right) direction.x += 1;

    if (direction.lengthSq() > 0) {
      direction.normalize();

      // Rotate character to face movement direction
      const targetAngle = Math.atan2(direction.x, direction.z);
      const currentAngle = this.group.rotation.y;
      let angleDiff = targetAngle - currentAngle;

      // Normalize angle difference to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this.group.rotation.y += angleDiff * this.turnSpeed * delta * 5;

      // Move in input direction
      this.group.position.x += direction.x * this.speed * delta;
      this.group.position.z += direction.z * this.speed * delta;
    }
  }
}
