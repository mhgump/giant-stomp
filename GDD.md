# Giant Stomp

A 3D game in which a single giant character searches for villagers who can hide
in houses and search for rope to down him.

## World

- Grid-based town with houses placed in cells between roads
- Roads form a regular grid; houses sit at cell centers
- Circular ring wall encloses the village (radius 32 units)
- Only houses that fit inside the ring wall are placed
- 4 center cells are clear for the giant's spawn point

## Roles

### Giant

- 3rd person over-the-shoulder POV
- Camera locked behind the giant, rotates with facing direction
- Has fixed energy (max 100) that drains passively over time (2/s)
	- Actions also cost energy: picking up a house (15), roaring (20)
	- Killing a villager restores energy (12 per villager)
	- Energy reaching 0 = game over (villagers win)
- Statuses: `idle`, `moving_to_house`, `moving_to_villager`, `picking_up`, `roped`
- Is at any point either traveling towards a house, a villager, or stationary
- Collision with a villager kills them and restores proportional energy
- Notifications/bubbles pop up in the direction of each exposed villager
	- Clicking on these directs the giant toward their location at the time of
	  clicking
- Clicking on a house travels to that house, which upon being reached triggers a
  pickup animation (1.5s lift + shrink), energy depleted, and whose occupants
  (if any) are consumed and proportional energy restored
	- Any rope in the house is also destroyed
	- The giant is then stationary until another target is chosen
- Rope
	- If the giant is roped by a villager, the player must spam `Space` (or tap
	  the mobile BREAK button) to break free — 8 hits within 2 seconds per rope
	- Multiple villagers can rope the giant simultaneously (rope stack, oldest
	  first)
	- On breaking free from a rope, the roping villager is thrown in the
	  direction the giant is facing, ragdolls through the air, and dies on
	  landing
	- If the giant is roped for more than ten seconds total, he is downed
	  (game over)
- Pressing `Space` (when not roped) "roars" and forces all villagers in houses
  outside, consuming energy (20)

### Villager

- Currently AI-controlled (architecture supports future multiplayer)
- 12 villagers spawned distributed across houses at game start
- AI finite state machine:
	- `HIDING` — inside a house; exits if house is destroyed or giant roars
	- `FLEEING` — picks nearest safe house (favoring distance from giant)
	- `MOVING_TO_HOUSE` — walking toward target house; enters on arrival;
	  picks up rope from nearby rope houses while passing
	- `SEEKING_GIANT_WITH_ROPE` — has rope, moves toward giant; throws rope
	  when in range (10 units) and line of sight (30° cone)
	- `ROPING` — persistent state while actively roping the giant; stays until
	  giant is downed or giant breaks free (villager is thrown and killed)
- At any time either in a house or in automatic motion towards a chosen house
- Produces a yell anytime outside (audio stub)
- Interactions with the giant
	- Can hear the giant's footsteps, closer is louder (audio stub)
	- Collision with the giant results in death
- Rope
	- 4 houses are pre-loaded with rope at game start
	- Going inside a house with rope picks up the rope
	- A villager can only have one rope at a time
	- After picking up rope and hiding for 2-5 seconds, leaves house to seek
	  the giant
	- Throws rope when in range and line of sight of the giant

## Win/Loss Conditions

- **Giant wins**: all villagers are dead
- **Villagers win**: giant's energy reaches 0, or giant is roped for 10+ seconds

## Technical Architecture

- State/rendering separation: all game logic in plain JS (no THREE.js imports),
  renderers sync THREE objects from state
- Command queue pattern: input pushes commands, state processes them each tick
- `GameState.serialize()`/`deserialize()` for future multiplayer support
- Mobile-first: touch-action disabled, virtual BREAK button for rope escape,
  tap-to-select houses and villager bubbles

## Audio (Stubbed)

- Giant footsteps (distance-based volume)
- Giant roar
- Villager yell (when outside)
- Rope throw
- Death
- House pickup
- Game over

## Pathing

- Both the villagers and giant are restricted to traveling on the paths between
  houses
- Both the villagers and giants will take the shortest path to their target
  - If there are multiple shortest paths, a random one is taken
- When villagers are seeking the giant, they will pursue the current shortest
  path between them and the giant until they are within a one grid space radius
