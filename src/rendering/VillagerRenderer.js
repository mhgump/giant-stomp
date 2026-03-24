import * as THREE from 'three';

export class VillagerRenderer {
  constructor(scene) {
    this.scene = scene;
    this.meshes = new Map(); // id -> THREE.Group
  }

  sync(villagerStates) {
    for (const [id, v] of villagerStates) {
      let mesh = this.meshes.get(id);

      // Create mesh on first encounter
      if (!mesh) {
        mesh = createVillagerMesh();
        this.scene.add(mesh);
        this.meshes.set(id, mesh);
      }

      if (!v.alive && !v.thrown) {
        mesh.visible = false;
        continue;
      }

      // Handle thrown animation
      if (v.thrown) {
        mesh.visible = true;
        mesh.position.set(v.x, v.throwY, v.z);
        mesh.rotation.x += 0.15; // tumble
        mesh.rotation.z += 0.1;
        continue;
      }

      // Hide if inside a house
      mesh.visible = !v.isInside;

      if (!v.isInside) {
        mesh.position.set(v.x, 0, v.z);
        mesh.rotation.y = v.rotation;
        // Reset any tumble rotation
        mesh.rotation.x = 0;
        mesh.rotation.z = 0;
      }
    }
  }
}

function createVillagerMesh() {
  const group = new THREE.Group();

  // Body
  const bodyGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.8, 8);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 8, 8);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xffcc88 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.2;
  head.castShadow = true;
  group.add(head);

  return group;
}
