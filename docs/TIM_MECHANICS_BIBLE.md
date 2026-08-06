# Young Inventor — Clean-room Mechanics Bible

Status: **authoritative gameplay reference** for all new parts and levels.

This document captures only **functional gameplay ideas and physical relationships** observed in classic machine-puzzle games such as *The Incredible Machine*. It is not a reproduction of proprietary art, code, audio, text, characters, UI, or level layouts.

## 1. Product rule

Young Inventor is an original 2.75D physics construction game:

- full 3D PBR visuals;
- authoritative Rapier3D simulation;
- main construction plane is X/Y;
- depth is discrete: BACK / MAIN / FRONT;
- simple touch-first editing;
- physical cause-and-effect, not scripted success;
- original parts, environments, names, levels and audiovisual identity.

The goal is to preserve the **systemic freedom** that makes machine puzzles compelling, not to imitate the protected expression of any earlier game.

## 2. Clean-room boundary

### Allowed as functional reference

- generic physical concepts: gravity, mass, friction, restitution, torque, pressure, airflow, light, heat, electricity;
- generic machine categories: ramps, pulleys, gears, belts, motors, generators, switches, fans, ropes, levers, springs;
- observable input/output behavior of a generic mechanism;
- broad puzzle pattern: place limited parts, run simulation, observe, revise;
- compatibility rules derived from real-world physics.

### Must be original in Young Inventor

- source code and data structures;
- 3D models, geometry, textures and materials;
- audio and music;
- names, logos and branding;
- characters and character designs;
- UI composition and iconography;
- tutorials, text and dialogue;
- level geometry and puzzle solutions;
- distinctive fictional object designs and animations.

### Never import

- extracted game files;
- sprites or sounds from a commercial release;
- decompiled/recovered source;
- level files copied from the original game;
- traced/redrawn original art intended to look identical.

## 3. Universal Part Contract

Every interactive part must be specified before art production.

```text
id
category
inputs[]
outputs[]
connections[]
physics
states[]
2.75D layer policy
failure modes[]
telemetry[]
regression scenarios[]
```

### Signal vocabulary

**Mechanical**
- contact
- force
- impulse
- torque
- angular_velocity
- linear_velocity
- pressure

**Transmission**
- rope_tension
- belt_rotation
- shaft_rotation
- gear_mesh

**Environmental / optical / thermal**
- airflow
- light_flux
- focused_light
- heat
- gravity

**Electrical**
- electrical_power
- electrical_load
- switch_state

**Logic**
- latch
- timer
- count
- sensor_contact

## 4. Clean-room mechanic archetypes

The project deliberately uses generic archetypes rather than copying a historical parts sidebar.

| ID | Generic archetype | Input | Physical model | Output | Priority |
|---|---|---|---|---|---|
| mass-heavy | Heavy rolling mass | gravity/contact | rigid body, high density, friction | momentum/impact | P0 |
| mass-light | Light ball | gravity/contact/airflow | rigid body, low density | motion/impact | P0 |
| mass-bouncy | Elastic ball | contact | restitution + spin | rebound | P1 |
| buoyant-body | Buoyant balloon-like body | gravity/airflow | effective buoyancy + drag | upward/downward motion | P1 |
| ramp | Inclined guide | contact | static collider + friction | redirect/accelerate body | P0 |
| lever | Pivoting beam | force/contact/rope | revolute joint + torque | angular motion/launch | P0 |
| spring-launcher | Spring-loaded pusher | contact/latch | Hooke force + damping | impulse | P1 |
| trampoline | Elastic surface | impact | spring/damping contact | rebound impulse | P1 |
| bellows | Compressible air pusher | force/contact | stroke -> airflow field | airflow | P1 |
| wind-rotor | Wind turbine | airflow | aerodynamic torque + inertia | shaft_rotation | P1 |
| rope | Flexible tension link | endpoints | constrained length/tension | force transfer | P0 |
| anchor | Fixed rope point | rope_tension | static attachment | reaction force | P0 |
| pulley | Rope direction changer | rope_tension | sheave inertia + routed rope | redirected tension | P0 |
| belt | Rotational belt | shaft_rotation | finite traction/slip | belt_rotation | P0 |
| gear | Meshing gear | shaft_rotation/contact | ratio + torque + inertia | shaft_rotation | P0 |
| conveyor | Moving surface | belt_rotation/shaft_rotation | kinematic surface/friction | linear object transport | P0 |
| cutter | Closing cutter | force/contact | jointed blades + edge intersection | sever rope / puncture soft body | P1 |
| toggle-switch | Mechanical electrical switch | contact/force | articulated latch | switch_state | P0 |
| generator | Mechanical generator | shaft_rotation | inertia + electrical load torque | electrical_power | P0 |
| light-generator | Photoelectric source | light_flux/focused_light | intensity/focus/distance/occlusion | electrical_power | P1 |
| motor | Electric motor | electrical_power/load | finite torque motor + inertia | shaft_rotation | P0 |
| fan | Powered airflow source | electrical_power | motor + airflow field | airflow | P0 |
| candle | Candle | heat/airflow/contact | ignitable flame + airflow extinction | light_flux + heat | P1 |
| flashlight | Flashlight | switch_state | self-contained battery + directional beam | light_flux | P1 |
| magnifier | Magnifying lens | light_flux | convex optical focusing + focal heating | focused_light + heat | P1 |
| lamp-push | Push-activated lamp | contact | physical switch/latch | light_flux | P1 |
| lamp-pull | Pull-cord lamp | rope_tension | pull latch | light_flux | P1 |
| optical-lens | Generic light focusing element | light_flux | ray direction/occlusion/focus | concentrated light/heat | P2 |
| fuse-device | Fuse-triggered actuator | heat/light | ignition delay/state | launch/explosion/heat | P2 |
| pressure-trigger | Pressed button/plunger | contact/force | travel + spring + threshold | logic/electrical state | P0 |
| falling-weight | Hanging mass | rope/gravity | rigid body + tension | force/energy storage | P0 |
| container | Catching bucket/cup | contact/rope | concave collision proxy + mass | captures/moves body | P1 |
| barrier | Solid construction material | contact | static collider/material strength | support/deflection | P0 |
| destructible-barrier | Breakable material | impulse/explosion | damage/threshold/fracture proxy | fragments/open path | P2 |
| suction-device | Powered vacuum | electrical_power | bounded force field + occlusion | attraction | P2 |
| lure | Attractor target | proximity/agent sensing | AI steering field | agent locomotion | P3 |
| autonomous-agent | Generic moving character/toy | stimuli/contact | simple state machine + rigid body | locomotion/reaction | P3 |
| goal-receiver | Basket/home/socket/target | contact/state | sensor volume + sustained criteria | level progress | P0 |

Priority meanings:

- **P0**: core systemic sandbox; needed before campaign scaling.
- **P1**: classic chain-reaction richness.
- **P2**: advanced energy/heat/destruction systems.
- **P3**: character/agent layer after core physics is mature.

### Light / heat family added to the production catalog

These are not decorative props. They are intended to form real puzzle chains:

```text
CANDLE
  heat input -> ignition
  flame -> local light_flux + heat
  strong airflow -> extinguish

FLASHLIGHT
  physical/self-contained switch -> on/off
  directional beam -> light_flux
  beam can be blocked by scene geometry

MAGNIFIER
  receives light_flux
  orientation + source/target geometry define a focal region
  focal region -> focused_light + local heat
```

Example original Young Inventor chain:

```text
flashlight -> magnifier -> focused heat -> candle/fuse target
```

or:

```text
candle -> light generator -> electrical power -> motor
```

The exact levels, visuals, dimensions and solutions must be original.

## 5. Connection rules

### Rope

- explicit anchor-to-anchor connection;
- optional ordered pulley route;
- finite length;
- tension only, never compression;
- may become slack;
- cutter can split it into independent rope segments;
- same-layer by default; cross-layer routing requires an authored guide/port.

### Belt

- shaft/pulley endpoints only;
- finite maximum length;
- finite traction and slip;
- transmits direction and torque;
- does not teleport angular velocity;
- no cross-layer belt unless both endpoints expose compatible depth ports.

### Gear mesh

- requires compatible radii/teeth and overlap window;
- opposite rotation for external mesh;
- angular speed ratio follows pitch-radius ratio;
- finite torque and optional slip/break threshold.

### Electrical

- explicit power producer -> consumer graph;
- consumers expose load;
- generators/motors react physically to load;
- switch state gates the graph;
- visual wires may be abstracted, but power state must be deterministic.

### Light / optics

- light travels through world space, not through a logical wire;
- sources expose direction, cone/spread, intensity and range;
- geometry can occlude the beam;
- the magnifier requires the source, lens and focal target to be geometrically aligned;
- focused energy must fall off outside the focal region;
- heat accumulation uses time and intensity, never an instant scripted trigger;
- FRONT/MAIN/BACK separation applies to optical interaction unless a part explicitly bridges depth.

### Candle / heat

- ignition requires a heat threshold sustained for a minimum time;
- flame emits both light and heat;
- airflow can deform/reduce/extinguish the flame according to strength and direction;
- extinguished candles do not emit useful heat/light until re-ignited;
- no simple proximity-based `if near candle then lit` shortcut.

## 6. 2.75D interaction standard

### Player placement

- drag changes X/Y only;
- Z never follows pointer depth;
- depth changes only through BACK / MAIN / FRONT commands;
- rotation is around Z for normal construction parts;
- special parts may expose a controlled flip/direction state instead of free 3D rotation.

### Physics

- Rapier remains 3D;
- MAIN is the default interaction layer;
- FRONT/BACK are physically separated depth channels;
- collision groups/layer distance prevent accidental cross-plane contacts;
- authored connectors may bridge layers intentionally.

### Camera

- perspective 3D presentation;
- constrained orbit around the machine, not CAD-style free navigation;
- pinch/wheel zoom;
- home-camera button;
- puzzle remains readable from the default view.

## 7. Level design rule

Never recreate a historical TIM level.

A Young Inventor level may reuse only a **general physical lesson**.

Example:

```text
Reference concept: falling mass flips switch -> powered fan -> moving object.
Young Inventor level: original room, original geometry, different objects,
different inventory, different positions, different goal, multiple new solutions.
```

Every campaign level must have:

1. original geometry;
2. original objective text;
3. original inventory mix;
4. at least two plausible solution families after tutorials;
5. no hidden scripted success path;
6. deterministic reset;
7. physics telemetry;
8. focused browser regression.

## 8. Current project mapping

### Already implemented / partially implemented

- heavy/light balls;
- ramp;
- lever;
- trampoline;
- spring boxing mechanism;
- belt;
- gear;
- conveyor;
- wind rotor;
- rope prototype;
- anchor/hook;
- pulley;
- cutter prototype (not accepted yet);
- toggle outlet;
- generator;
- electric motor;
- pressure trigger;
- goal sensors.

### Registered for implementation next

- candle;
- flashlight;
- magnifier / focused-light optical interaction.

### Current Stage 02

Stage 02 exercises the P0 chain:

```text
heavy mass
  -> ramp
  -> lever / torque
  -> light mass
  -> rope/pulley concept
  -> falling weight
  -> pressure trigger
  -> goal receiver
```

The stage is also the current reference implementation for touch-first 2.75D editing.

## 9. Production order from now on

1. Finish generic P0 contracts and adapters.
2. Replace level-specific placement assumptions with reusable ports/connectors.
3. Build a reusable parts bin/editor around the catalog.
4. Validate rope + pulley + belt + gear connection editing.
5. Create three original benchmark levels using only P0 parts.
6. Move all final P0 objects to approved AAA-child PBR assets.
7. Add P1 systems, including candle + flashlight + magnifier optics/heat.
8. Only then scale campaign content.

## 10. Legal/product review gate

This document is an engineering clean-room discipline, not legal advice. Before commercial release, perform an IP review of branding, art direction, character designs, UI, marketing language and level content. The release must stand on its own as **Young Inventor**, not as a visually disguised copy of another game.

## Public functional references used for research

- GameFAQs community guide for *The Even More! Incredible Machine* — used only to understand generic observable part behavior.
- The Incredible Machine community wiki — used only to cross-check generic functional behavior.
- Real-world physics and engineering principles are the authoritative implementation target.
