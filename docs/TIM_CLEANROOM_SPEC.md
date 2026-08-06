# Young Inventor — clean-room gameplay specification

This project is an **original physics construction game**. It may study generic observable mechanics from historical machine-puzzle games, including *The Incredible Machine*, but it must not copy proprietary source code, artwork, audio, text, characters, UI, branding, or level layouts.

The authoritative mechanics inventory is:

- [`TIM_MECHANICS_BIBLE.md`](./TIM_MECHANICS_BIBLE.md)
- typed runtime catalog: `src/mechanicsCatalog.ts`

## Clean-room rule

Research answers only the question:

> What generic physical input/output behavior makes this kind of mechanism useful in a machine puzzle?

Implementation then starts from real-world physics and the Young Inventor architecture.

Examples:

- rotational input -> electrical output becomes our own generator model;
- contact -> bistable electrical state becomes our own switch model;
- rope tension routed around a wheel becomes our own pulley/rope system.

The historical shape, art, text, animation, level placement and naming are not implementation references.

## Product architecture

Young Inventor uses:

- **Three.js** for full 3D presentation;
- **Rapier3D** as the authoritative new-level physics solver;
- fixed-step simulation independent of display refresh;
- **2.75D construction**: pointer drag changes X/Y; depth is discrete BACK / MAIN / FRONT;
- visual meshes and physics colliders kept independent;
- original PBR assets and environments;
- touch-first controls for iPad.

## Required player loop

1. Load an original level containing fixed objects and a limited parts bin.
2. In BUILD mode the player creates, moves and rotates allowed parts on X/Y.
3. A selected part may move between explicit depth layers when the part supports it.
4. Compatible anchors create rope, belt, gear or electrical connections.
5. Starting simulation captures an immutable construction snapshot.
6. Build editing is locked during RUN.
7. PAUSE preserves exact simulation state.
8. RESET restores the captured build snapshot.
9. Victory is evaluated from physical state/contact/sustained signals, never a scripted animation timeline.

## Universal part contract

Every gameplay object must resolve to a registered `MechanicDefinition` or an explicitly reviewed extension.

Required fields:

- stable generic ID;
- category;
- inputs;
- outputs;
- connection kinds;
- layer policy;
- physics description;
- runtime states;
- production priority.

Level code must compose these contracts rather than implement unique hidden behavior for each puzzle.

## Determinism requirements

- physics advances at fixed timestep;
- rendering frequency cannot change simulation results;
- browser stalls have bounded catch-up;
- object and connection IDs are stable;
- build snapshots are deep immutable copies;
- removing an object removes dependent connections;
- connections require compatible endpoint types;
- FRONT/BACK objects cannot accidentally collide with MAIN because of visual perspective;
- cross-layer connections require explicit layer-compatible ports.

## Core connection contracts

### Rope

- anchor-to-anchor;
- optional ordered pulley route;
- finite length;
- tension-only behavior;
- slack supported;
- physical cutters may split it.

### Belt

- compatible shaft endpoints only;
- finite length;
- finite traction and slip;
- transfers torque instead of assigning angular velocity.

### Gear

- explicit mesh compatibility;
- pitch ratio determines angular-speed relationship;
- finite torque/inertia.

### Electrical

- explicit producer/switch/consumer graph;
- power source has finite capability where relevant;
- consumers create load;
- electrical load may feed back into mechanical generators and motors.

## Visual/IP boundary

Final assets must be original Young Inventor work or properly licensed third-party material documented in `THIRD_PARTY_ASSETS.md`.

Do not import or recreate one-for-one:

- commercial-game sprites/models/textures;
- sound/music;
- characters;
- logos/title treatment;
- distinctive UI layouts;
- original puzzle maps;
- original tutorial wording;
- extracted resource or save/level files as shipping content.

## Acceptance gates

Before a new mechanic is accepted:

1. It has a clean-room contract in `mechanicsCatalog.ts`.
2. It has no level-specific success hack.
3. Visual geometry is independent of collision geometry.
4. Physics regression is deterministic.
5. iPad input is covered where editing is involved.
6. Run/reset round-trip restores the construction.
7. A focused browser test verifies a real cause-and-effect path.
8. Final art passes the AAA-child visual standard separately from CI.

## Current implementation direction

The current Stage 02 is the reference touch/editor experiment for the 2.75D model. The next engineering focus is to move from stage-specific snap assumptions to reusable P0 ports and connection tools from the Mechanics Bible.

This specification is an engineering discipline, not legal advice. A commercial release should receive an IP review covering art, branding, UI, characters, marketing and level content.
