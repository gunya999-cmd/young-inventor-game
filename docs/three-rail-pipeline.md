# Three.js rail visual pipeline

Level 01 now has an experimental presentation layer that separates visual rendering from gameplay physics.

- Planck.js remains authoritative for 2D positions, rotation, collisions and simulation.
- Canvas2D remains the interaction surface for hit-testing, drag and rotation.
- Three.js renders a pointer-transparent orthographic WebGL layer above the Canvas.
- The Three camera is recalculated from `CanvasRenderer.screenToWorld`, so zoom and pan stay aligned with physics coordinates.
- Rails are generated as true 3D geometry with bevelled solids, PBR materials, connector hardware, lighting and shadows.
- The WebGL layer is Level-01-only until the visual language is approved.
- If WebGL creation fails, the Canvas2D renderer remains the fallback.

This stage is intentionally a technology and asset-quality prototype, not a final UI redesign.
