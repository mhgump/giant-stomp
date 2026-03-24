# Giant Stomp

A 3D game in which a single giant character searches for villagers who can hide
in houses and search for rope to down him.

## Roles

### Giant

- 3rd person over-the-shoulder POV
- Has fixed energy
- Is at any point either traveling towards a house, a villager, or stationary
- Collision with a villager kills then and restores proportional energy
- Notifications/bubbles pop up in the direction of each exposed villager
	- Clicking on these directs the giant toward their location at the time of
	  clicking
- Clicking on a house travels to that house, which upon being reached is picked
  up, energy depleted, and whose occupants (if any) are consumed and
	proportional energy restored
	- Any rope in the house is also destroyed
	- The giant is then stationary until another target is chosen
- Rope
	- If the giant is roped by a villager, the player must spam `Space` for two
    seconds for each rope
	- If the giant is roped for more than ten seconds, he is downed
- Pressing `Space` "roars" and forces all villagers in houses outside,
  consuming energy

### Villager

- 3rd person top-down perspective of the town
- At any time either in a house or in automatic motion towards a chosen house
- Produces a yell anytime outside
- Interactions with the giant
  - Can hear the giant's footsteps, closer is louder
	- Collision with the giant results in death
- Rope
  - Going inside a house with rope picks up the rope
  - A villager can only have one rope at a time
	- Pressing `Space` activates the rope and will direct the villager in the
	  closest direction of the giant, throwing the rope when in direct line of
		sight
