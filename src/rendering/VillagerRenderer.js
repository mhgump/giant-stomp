import { createVillager, stopVillagerRunning } from '../characters.js';

export class VillagerRenderer {
  constructor(scene, characterLibrary) {
    this.scene = scene;
    this.library = characterLibrary;
    this.villagers = new Map(); // id -> { root, character }
  }

  sync(villagerStates, delta) {
    for (const [id, v] of villagerStates) {
      let entry = this.villagers.get(id);

      // Create on first encounter
      if (!entry) {
        const character = createVillager(this.library);
        this.scene.add(character.root);
        entry = { character };
        this.villagers.set(id, entry);
      }

      const { character } = entry;

      if (!v.alive && !v.thrown) {
        character.root.visible = false;
        continue;
      }

      // Handle thrown arc — tumble in the air, no running
      if (v.thrown) {
        character.root.visible = true;
        character.mixer.update(0); // freeze animation mid-pose
        character.root.position.set(v.x, v.throwY, v.z);
        character.root.rotation.x += 0.15;
        character.root.rotation.z += 0.1;
        continue;
      }

      // Inside a house — hidden, stopped at default pose
      if (v.isInside) {
        if (character.root.visible) {
          stopVillagerRunning(character);
          character.root.visible = false;
        }
        continue;
      }

      // Roping — visible but still
      if (v.aiState === 'ROPING') {
        if (character.runAction.isRunning()) stopVillagerRunning(character);
        character.root.visible = true;
        character.mixer.update(0);
        character.root.position.set(v.x, 0, v.z);
        character.root.rotation.y = v.rotation + Math.PI;
        continue;
      }

      // Outside — visible and running
      if (!character.root.visible || !character.runAction.isRunning()) {
        character.runAction.reset().play();
        character.root.visible = true;
        character.root.rotation.x = 0;
        character.root.rotation.z = 0;
      }

      character.mixer.update(delta);
      character.root.position.set(v.x, 0, v.z);
      character.root.rotation.y = v.rotation + Math.PI;
    }
  }
}
