import { createGiant, playGiantGroundSlam } from "./characters.js";

export class Player {
  constructor(scene, characterLibrary) {
    this.character = createGiant(characterLibrary);
    this.group = this.character.root;
    this.group.userData.type = "giant";
    scene.add(this.group);

    this.speed = 8;
    this.turnSpeed = 2.5; // radians per second
  }

  get position() {
    return this.group.position;
  }

  get rotation() {
    return this.group.rotation.y;
  }

  playGroundSlam() {
    playGiantGroundSlam(this.character);
  }

  update(input, delta) {
    this.character.mixer.update(delta);
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

    // Calculate desired facing angle (nose points -Z, so offset by PI)
    const targetAngle = Math.atan2(dx, dz) + Math.PI;
    let angleDiff = targetAngle - this.group.rotation.y;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Turn toward target at a fixed rate
    const maxTurn = this.turnSpeed * delta;
    if (Math.abs(angleDiff) > maxTurn) {
      this.group.rotation.y += Math.sign(angleDiff) * maxTurn;
    } else {
      this.group.rotation.y += angleDiff;
    }

    // Only move forward when roughly facing the target
    if (Math.abs(angleDiff) < Math.PI / 3) {
      const moveX = (dx / dist) * this.speed * delta;
      const moveZ = (dz / dist) * this.speed * delta;
      this.group.position.x += moveX;
      this.group.position.z += moveZ;
    }
  }
}
