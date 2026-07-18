# TIM clean-room gameplay specification

This project does not contain or depend on the proprietary source code, artwork, audio, text, or level data from *The Incredible Machine*.

The gameplay contract is reconstructed from publicly documented level/resource formats, observable behavior of legally obtained releases, and independently written open-source implementations.

## Reference material

- ModdingWiki: The Incredible Machine level format
  - https://moddingwiki.shikadi.net/wiki/The_Incredible_Machine_Level_Format
- ModdingWiki: The Incredible Machine resource format
  - https://moddingwiki.shikadi.net/wiki/TIM_Resource_Format
- The Butterfly Effect, an independent GPL-2.0 machine-puzzle implementation
  - https://github.com/the-butterfly-effect/tbe

No source code is copied from these projects. They are used to identify public gameplay concepts and engineering risks.

## Required player loop

1. Load a level containing fixed objects, movable objects and a parts bin.
2. In build mode the player may place, move, rotate, flip, fix and delete allowed parts at arbitrary valid coordinates.
3. Connections are created explicitly between compatible anchors. A rope may be routed through pulley anchors.
4. Starting the simulation captures an immutable construction snapshot.
5. Build controls are locked while running.
6. Pause preserves the current simulation state.
7. Stop restores every part and connection exactly to the captured construction snapshot.
8. Victory is evaluated from physical state and contacts, never from a scripted animation timeline.

## Determinism requirements

- Simulation uses a fixed step; render frame rate must not alter results.
- Browser stalls are clamped and cannot produce unbounded catch-up steps.
- IDs are stable and unique.
- Snapshots are deep copies.
- Removing a part removes all connections that depend on it, including pulley routes.
- Connections are accepted only when both endpoint anchors and all route anchors are compatible.

## Architecture

- `MachineModel`: authoritative editable machine graph and build/run lifecycle.
- `FixedStepClock`: deterministic simulation clock, independent of display refresh rate.
- `PartDefinition`: reusable behavior and anchor schema.
- `PartInstance`: level-specific transform, fixed state and metadata.
- `Connection`: rope, belt, hinge or rigid relationship between anchors.
- Physics adapter: a later layer that maps the machine graph into the selected solver.
- Renderer: a later layer; visual assets never define collision geometry.

## Acceptance gates before graphics work

- Free placement does not snap to a scripted solution.
- Run/stop round-trip restores an identical snapshot.
- 30 Hz, 60 Hz and 120 Hz rendering produce the same physics steps.
- Rope, pulley, belt, hinge and gear tests pass independently.
- Every part has deterministic regression scenarios.
- A representative level passes repeated headless runs before it is exposed in the UI.
