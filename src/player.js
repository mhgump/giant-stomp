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

    this.group.scale.set(5, 5, 5);
    scene.add(this.group);

    this.speed = 8;
    this.turnSpeed = 3;
    this.velocity = new THREE.Vector3();
  }

  get position() {
    return this.group.position;
  }

  update(input, delta) {
    if (!input.target) return;

    const target = input.target;
    const dx = target.x - this.group.position.x;
    const dz = target.z - this.group.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Stop when close enough
    if (dist < 1.5) {
      input.target = null;
      return;
    }

    // Face the target
    const targetAngle = Math.atan2(dx, dz) + Math.PI;
    const currentAngle = this.group.rotation.y;
    let angleDiff = targetAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    this.group.rotation.y += angleDiff * this.turnSpeed * delta * 5;

    // Move toward target
    const moveX = (dx / dist) * this.speed * delta;
    const moveZ = (dz / dist) * this.speed * delta;
    this.group.position.x += moveX;
    this.group.position.z += moveZ;
  }
}
