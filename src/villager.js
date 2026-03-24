import { createVillager, stopVillagerRunning } from "./characters.js";

export class Villager {
  constructor(scene, characterLibrary) {
    this.character = createVillager(characterLibrary);
    this.group = this.character.root;
    this.group.userData.type = "villager";
    scene.add(this.group);
  }

  get position() {
    return this.group.position;
  }

  get rotation() {
    return this.group.rotation.y;
  }

  update(delta) {
    this.character.mixer.update(delta);
  }

  stopRunning() {
    stopVillagerRunning(this.character);
  }
}

