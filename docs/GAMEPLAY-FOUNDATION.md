# Gameplay foundation

## Product rule

The game is a construction puzzle, not a placement quiz. Tutorial levels may use magnetic guidance, but the player must still understand why the mechanism works.

## Core loop

1. Read a one-sentence objective.
2. Inspect the incomplete mechanism.
3. Place and rotate one or more parts.
4. Run the simulation.
5. Observe the complete physical chain.
6. Adjust without losing the previous construction.
7. Complete the quest and receive a short story beat.

## Touch controls

- One finger on a part: select and drag.
- Large rotation handle: drag around the selected part.
- Two fingers on the selected part: rotate by gesture.
- Double tap: rotate by one fixed step.
- Long press: return an optional part to the tray.
- Two-finger tap outside a part: undo the last build action.
- While simulation is running, all editing is locked.

All touch targets must be at least 56 CSS pixels on iPad. Keyboard and mouse controls are secondary.

## Forgiveness

- Tutorial snap zones are deliberately broad.
- Snapping must never move a part across a visibly large distance.
- A near-correct solution should succeed if the physical route is continuous.
- Failed runs preserve the construction.
- Failure messages identify one useful adjustment only.
- Reset is the only action that returns every part to the tray.

## Physics separation

Each part has:

1. a visual asset;
2. a simple invisible Matter.js body;
3. optional connection points;
4. optional sensors and active behaviours.

The visual silhouette may be detailed, but colliders must remain simple and predictable.

## Tutorial sequence

1. **Разбуди Луми** — one beam, continuous inclined route.
2. **Длинный путь** — two beams, ordering and length selection.
3. **Нажми и открой** — button-triggered causal chain.
4. **Прыжок энергии** — spring and landing zone.
5. **Твоё решение** — small free-build puzzle with multiple valid solutions.

## Quality gates for every level

- Objective understood without opening the hint.
- First meaningful action within 10 seconds.
- Touch placement does not require pixel precision.
- At least five nearby valid configurations are tested.
- 95% or better success rate for each intended solution family.
- Failure state restores the ball in under one second.
- No edit controls are hidden behind keyboard-only instructions.
- Scene remains fully visible on iPad landscape without browser-page scrolling.
