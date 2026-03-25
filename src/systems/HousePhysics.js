// Rapier-based collision resolution for houses landing outside the wall.
// RAPIER must be pre-initialized (await RAPIER.init()) before constructing.
//
// Houses are modeled as axis-aligned cuboids on the XZ plane.
// Gravity is zero — we only care about lateral separation.
// Restitution is 0 (no bounce); density is very high (heavy slide).

const HOUSE_HALF_XZ = 2.4; // approximate half-footprint of a house
const HOUSE_HALF_Y  = 2.0; // approximate half-height

export class HousePhysics {
  constructor(RAPIER) {
    this.R = RAPIER;
    // No gravity: all motion is in the XZ plane
    this.world = new RAPIER.World({ x: 0.0, y: 0.0, z: 0.0 });
  }

  /**
   * Settle a newly landed house that starts at (startX, startZ).
   * Runs a fast-forward physics simulation so the house slides away from
   * any previously-landed houses (fixed bodies already in the world).
   * Adds the settled house as a fixed body for future collisions.
   * @returns {{ x: number, z: number }} final resting position
   */
  settle(id, startX, startZ) {
    const R   = this.R;
    const HXZ = HOUSE_HALF_XZ;
    const HY  = HOUSE_HALF_Y;

    // Give the arriving house a small radial nudge outward from the origin
    const len = Math.sqrt(startX * startX + startZ * startZ);
    const nx  = len > 0.01 ? startX / len : 1.0;
    const nz  = len > 0.01 ? startZ / len : 0.0;

    // Dynamic rigid body — very heavy, no restitution
    const bodyDesc = R.RigidBodyDesc.dynamic()
      .setTranslation(startX, HY, startZ)
      .setLinvel(nx * 2.0, 0.0, nz * 2.0)
      .setLinearDamping(8.0)
      .setAngularDamping(100.0)
      .setGravityScale(0.0);
    const body = this.world.createRigidBody(bodyDesc);

    this.world.createCollider(
      R.ColliderDesc.cuboid(HXZ, HY, HXZ)
        .setRestitution(0.0)
        .setFriction(1.5)
        .setDensity(500.0),
      body
    );

    // Fast-forward until velocity is negligible (max 300 steps × 1/60 s each)
    for (let i = 0; i < 300; i++) {
      this.world.step();
      const vel = body.linvel();
      if (vel.x * vel.x + vel.z * vel.z < 0.001) break;
    }

    const pos = body.translation();
    const fx  = pos.x;
    const fz  = pos.z;

    // Remove the dynamic body
    this.world.removeRigidBody(body);

    // Re-add as a fixed body so future arrivals collide with it
    const fixedDesc = R.RigidBodyDesc.fixed().setTranslation(fx, HY, fz);
    const fixedBody = this.world.createRigidBody(fixedDesc);
    this.world.createCollider(
      R.ColliderDesc.cuboid(HXZ, HY, HXZ)
        .setRestitution(0.0)
        .setFriction(1.5),
      fixedBody
    );

    return { x: fx, z: fz };
  }
}
