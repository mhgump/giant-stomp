import { createGiant, playGiantGroundSlam } from "./characters.js";

export class Player {
  constructor(scene, characterLibrary) {
    this.character = createGiant(characterLibrary);
    this.group = this.character.root;
    this.group.userData.type = "giant";
    scene.add(this.group);
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

  syncFromState(giantState, delta) {
    this.character.mixer.update(delta ?? 0);

    if (giantState.status === 'slamming' && !this.character.isSlamming) {
      playGiantGroundSlam(this.character);
    }

    this.group.position.x = giantState.x;
    this.group.position.z = giantState.z;
    this.group.rotation.y = giantState.rotation + Math.PI;
  }
}
