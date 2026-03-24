import { createVillager, stopVillagerRunning } from '../characters.js';

export class VillagerRenderer {
  constructor(scene, characterLibrary) {
    this.scene = scene;
    this.library = characterLibrary;
    this.villagers = new Map(); // id -> { character, tumbleRate, ragdollLanded }
  }

  sync(villagerStates, delta) {
    for (const [id, v] of villagerStates) {
      let entry = this.villagers.get(id);

      if (!entry) {
        const character = createVillager(this.library);
        this.scene.add(character.root);
        entry = { character, tumbleRate: (Math.random() * 2 + 1.5), ragdollLanded: false };
        this.villagers.set(id, entry);
      }

      const { character } = entry;

      // Ragdoll: villager ejected from destroyed house, falling to ground
      if (v.ragdoll) {
        character.root.visible = true;
        character.mixer.update(0); // freeze animation mid-pose

        character.root.position.set(v.x, v.ragdollY, v.z);

        if (v.ragdollY <= 0) {
          // Landed — lie flat, stop tumbling
          if (!entry.ragdollLanded) {
            entry.ragdollLanded = true;
            stopVillagerRunning(character);
            character.root.rotation.set(Math.PI / 2, v.rotation + Math.PI, 0);
          }
        } else {
          // Tumbling in air
          character.root.rotation.x += entry.tumbleRate * delta;
          character.root.rotation.z += entry.tumbleRate * 0.6 * delta;
        }
        continue;
      }

      // Dead and not ragdoll (thrown and landed, etc.) — hide
      if (!v.alive && !v.thrown) {
        character.root.visible = false;
        continue;
      }

      // Thrown arc — tumble, no running
      if (v.thrown) {
        character.root.visible = true;
        character.mixer.update(0);
        character.root.position.set(v.x, v.throwY, v.z);
        character.root.rotation.x += 0.15;
        character.root.rotation.z += 0.1;
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

      // Inside a house — hidden, stopped at default pose
      if (v.isInside) {
        if (character.root.visible) {
          stopVillagerRunning(character);
          character.root.visible = false;
        }
        continue;
      }

      // Outside — visible and running
      if (!character.root.visible || !character.runAction.isRunning()) {
        character.runAction.reset().play();
        character.root.visible = true;
        character.root.rotation.x = 0;
        character.root.rotation.z = 0;
        entry.ragdollLanded = false;
      }

      character.mixer.update(delta);
      character.root.position.set(v.x, 0, v.z);
      character.root.rotation.y = v.rotation + Math.PI;
    }
  }
}
