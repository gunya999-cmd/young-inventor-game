# Open-source TIM rebuild

## Decision

The current Phaser/Matter prototype is frozen. The rebuild will not extend the scripted V1–V4 scenes.

## Primary gameplay reference

### The Butterfly Effect (`the-butterfly-effect/tbe`)

- Mature open-source game explicitly inspired by The Incredible Machine.
- C++/Qt application using Box2D.
- More than 80 playable levels.
- Object model, goals, level loading, editing, undo/redo, simulation start/stop, joints and object-specific interactions.
- License: GPL-2.0-only. Code cannot be copied into a proprietary product; a derivative distribution must remain GPL-compatible and publish source.

The TBE source is the behavioral and architectural reference for the object system, level state, simulation lifecycle, goals and interactions.

## Browser editor reference

### IncrediBots 2 HTML5 Open Source (`JoshTheDerf/Incredibots-2-HTML5-Open-Source`)

- TypeScript/PIXI browser port of a Box2D construction game.
- Existing separation between controllers, parts, drawing, actions, undo/redo and simulation mode.
- Useful reference for touch-capable browser editing, but not a complete TIM clone and not the gameplay base.

## Physics base

### Planck.js

- TypeScript rewrite of Box2D for HTML5 and mobile browsers.
- MIT licensed.
- Supports deterministic rigid bodies and standard Box2D joints more closely than the current Matter.js implementation.

## Rebuild rules

1. Remove Phaser/Matter from the new runtime.
2. Use Planck.js as the physics world.
3. Keep edit-state objects separate from runtime Box2D bodies.
4. Build all joints through one connection system.
5. Restore the exact edit snapshot when simulation stops.
6. Implement object behavior from a data-driven catalog.
7. Port one complete interaction slice before adding visual polish.
8. Do not publish a build until it passes an actual Safari/iPad smoke test.

## First acceptance slice

- one fixed wall;
- one movable ball;
- one freely positioned plank;
- one revolute joint;
- one rope/distance joint;
- one pulley route;
- inventory drag under the finger;
- start, pause, stop and exact restore;
- one goal sensor;
- deterministic replay test.

The first release of the rebuild must show all of the above working together in one playable level before any new object types are added.