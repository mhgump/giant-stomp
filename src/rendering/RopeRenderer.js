import * as THREE from 'three';

export class RopeRenderer {
  constructor(scene) {
    this.scene = scene;
    this.lines = new Map(); // villagerId -> THREE.Line
    this.material = new THREE.LineBasicMaterial({ color: 0x8B6914, linewidth: 2 });
  }

  sync(giantState, villagerStates) {
    const activeRopeVillagers = new Set();

    for (const rope of giantState.ropeStack) {
      activeRopeVillagers.add(rope.fromVillager);
      const v = villagerStates.get(rope.fromVillager);
      if (!v) continue;

      let line = this.lines.get(rope.fromVillager);
      if (!line) {
        const geo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(), new THREE.Vector3()
        ]);
        line = new THREE.Line(geo, this.material);
        this.scene.add(line);
        this.lines.set(rope.fromVillager, line);
      }

      // Update line endpoints: giant hand to villager
      const positions = line.geometry.attributes.position.array;
      positions[0] = giantState.x;
      positions[1] = 5; // giant hand height
      positions[2] = giantState.z;
      positions[3] = v.x;
      positions[4] = 1;
      positions[5] = v.z;
      line.geometry.attributes.position.needsUpdate = true;
      line.visible = true;
    }

    // Hide lines for ropes that no longer exist
    for (const [vid, line] of this.lines) {
      if (!activeRopeVillagers.has(vid)) {
        line.visible = false;
      }
    }
  }
}
