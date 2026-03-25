import { createVillager } from '../characters.js';

export class VillagerRenderer {
  constructor(scene, characterLibrary) {
    this.scene = scene;
    this.library = characterLibrary;
    this.villagers = new Map(); // id -> { character, tumbleRate }
  }

  sync(villagerStates, delta) {
    for (const [id, v] of villagerStates) {
      let entry = this.villagers.get(id);

      if (!entry) {
        const character = createVillager(this.library);
        this.scene.add(character.root);
        entry = { character, tumbleRate: (Math.random() * 2 + 1.5) };
        this.villagers.set(id, entry);
      }

      const { character } = entry;

      // Dead villager — fly up then lie flat (ragdoll), or just hide if no ragdoll
      if (!v.alive) {
        if (!v.ragdoll) {
          character.root.visible = false;
          continue;
        }

        character.root.visible = true;
        character.root.position.set(v.x, v.ragdollY, v.z);

        if (v.ragdollY > 0) {
          // Airborne: keep running animation, tumble the root
          if (!character.runAction.isRunning()) character.runAction.reset().play();
          character.mixer.update(delta);
          character.root.rotation.x += entry.tumbleRate * delta;
          character.root.rotation.z += entry.tumbleRate * 0.6 * delta;
        } else {
          // Landed: freeze and lie on side
          if (character.runAction.isRunning()) character.mixer.stopAllAction();
          character.root.rotation.set(Math.PI / 2, v.rotation + Math.PI, 0);
        }
        continue;
      }

      // Alive villager — always visible and upright
      character.root.visible = true;
      character.root.position.set(v.x, 0, v.z);
      character.root.rotation.x = 0;
      character.root.rotation.z = 0;
      character.root.rotation.y = v.rotation + Math.PI;

      if (v.isInside || v.aiState === 'ROPING') {
        // Freeze in place — same stopped state as a landed ragdoll
        if (character.runAction.isRunning()) character.mixer.stopAllAction();
      } else {
        if (!character.runAction.isRunning()) character.runAction.reset().play();
        character.mixer.update(delta);
      }
    }
  }
}
