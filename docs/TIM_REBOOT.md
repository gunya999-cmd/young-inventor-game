# Young Inventor — TIM gameplay reboot

## Why the current prototype is being retired

The current build is a guided bridge-placement exercise. It validates hosting, touch input and Matter.js, but it does not reproduce the core appeal of The Incredible Machine.

TIM is built around:

- a side-view sandbox;
- fixed objects already present in the level;
- a limited parts bin;
- freely placing, rotating and connecting several objects;
- interactions between many object classes;
- starting and stopping the whole simulation;
- experimentation and multiple valid solutions;
- a free-build mode.

The new implementation will use these principles directly.

## Product definition

A modern browser physics puzzle in which the child assembles Rube Goldberg machines from familiar mechanical, domestic and scientific objects.

The story locations remain:

1. Home construction workshop
2. Grandfather's garage
3. Mother's science laboratory
4. Father's engineering laboratory

The story frames the puzzles but never replaces the sandbox.

## Core screen

### Top bar

- level title and one-sentence goal;
- Run / Pause;
- Reset;
- Hint.

### Playfield

- large unobstructed side-view scene;
- fixed level objects;
- movable parts;
- ropes and belts drawn directly in the scene;
- no decorative board covering the room;
- camera fitted to the puzzle, not to the UI.

### Parts bin

A compact horizontal tray containing all remaining pieces and their counts. Dragging a part creates an instance. Returning it to the tray deletes it and restores the count.

## Input

### Desktop

- drag to move;
- wheel or rotation handle to rotate;
- click attachment point, then another point, to connect rope/belt;
- Delete removes selected part.

### iPad

- one finger moves;
- two fingers rotate;
- tap attachment point, then target point, to connect;
- drag back to parts bin to remove;
- touch targets at least 48 CSS pixels.

## Simulation states

1. BUILD — physics frozen, parts editable.
2. RUN — all dynamic objects and powered parts active.
3. PAUSE — exact simulation state preserved.
4. SUCCESS — goal trigger satisfied for required duration.
5. FAILURE — no forced fail unless an object leaves bounds or timeout is part of the puzzle.

Reset restores the level to the last build layout, not the original layout. A separate Clear button restores the original layout.

## Initial interaction library

### Passive physics

- balls with different mass;
- ramps and planks;
- boxes and weights;
- seesaw;
- trampoline / spring;
- domino;
- balloon;
- basket and target zone.

### Force producers

- fan;
- motor;
- conveyor belt;
- rocket;
- magnet.

### Transmission

- rope;
- pulley;
- belt between wheels;
- gears;
- hinges;
- pins / anchors.

### Logic and triggers

- pressure button;
- toggle switch;
- timer;
- door / gate;
- sensor;
- electrical wire.

### Character interactions

- mouse runs toward cheese;
- cat reacts to mouse;
- robot reacts to power;
- grandfather's wind-up toy.

## First vertical slice

The first release will contain five TIM-style puzzles, not ten tutorials.

### Puzzle 1 — Ball in the basket

Fixed: ball platform and basket.
Parts: two ramps, one seesaw, one weight.
Goal: get the ball into the basket.
Expected solutions: at least three.

### Puzzle 2 — Turn on the lamp

Fixed: generator, lamp, incomplete mechanism.
Parts: ball, ramp, rope, pulley, weight.
Goal: rotate the generator long enough to light the lamp.

### Puzzle 3 — Pop the balloon

Fixed: balloon and wall.
Parts: fan, bowling ball, plank, pin, rope.
Goal: make the pin touch the balloon.

### Puzzle 4 — Feed the mouse

Fixed: mouse cage and cheese.
Parts: switch, fan, conveyor, ball, ramp.
Goal: open the cage and deliver the mouse to cheese.

### Puzzle 5 — Wake Lumi

Fixed: robot, power socket, generator.
Parts: gears, belt, ball, ramp, seesaw, weight.
Goal: power the robot for two seconds.

## Architecture

- `LevelDefinition`: goal, fixed objects, parts-bin inventory, environment settings.
- `PartDefinition`: visual asset, collider, parameters, ports and behaviours.
- `PartInstance`: transform, runtime state and connections.
- `Connection`: rope, belt, wire, hinge or fixed pin.
- `GoalEvaluator`: sensor, sustained state, count or sequence.
- `SimulationSnapshot`: build layout and last run state.

No level-specific physics code is allowed in the scene class.

## Visual pipeline

The engine will no longer draw final-looking objects from rectangles and circles.

1. Use clear graybox components during gameplay implementation.
2. Produce each final object as a separate consistent asset.
3. Keep visual sprite and collider independent.
4. Replace graybox assets without changing level data or physics code.

Target style: polished 2.5D toy workshop with realistic plastic, wood and metal, but not an imitation of LEGO branding or protected product designs.

## Acceptance criteria for the new prototype

- no single predetermined snap point;
- at least five movable parts available at once;
- parts can be instantiated from and returned to a parts bin;
- at least two connection types work;
- Run, Pause, Reset and Clear are distinct;
- the first puzzle has at least three verified solutions;
- landscape iPad is fully supported;
- portrait phones display a rotate-device prompt;
- the puzzle field occupies at least 80% of available landscape height;
- no keyboard instructions are shown on touch devices.
