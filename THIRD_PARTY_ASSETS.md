# Third-party asset references

This project may use open-licensed art as a geometric or visual source reference. Assets are re-authored or adapted locally so the game remains self-contained. No remote asset hot-linking is used at runtime.

## Cannonball — Part 03
- **Source creator:** Kenney
- **Pack:** Tower Defense Kit
- **Source asset:** `weapon-ammo-cannonball`
- **License:** Creative Commons CC0 1.0 Universal
- **Official source:** https://kenney.nl/assets/tower-defense-kit
- **Use:** proportions and game-ready simplicity; production geometry/material/lighting are re-authored locally.

## Baseball — Part 04
- **Source creator:** LonesomeDucky
- **Asset:** Old Baseball
- **License:** Creative Commons CC0 1.0 Universal
- **Source:** https://opengameart.org/content/old-baseball
- **Use:** panel/stitch construction and material reference; v2 uses one re-authored Three.js leather shell with a shallow geometric seam and surface-integrated shader stitches. No external seam or stitch meshes are used.

## Tennis Ball — Part 05
- **Source creator:** Lucian Pavel
- **Asset:** HQ PBR Tennis Ball
- **License:** Creative Commons CC0 1.0 Universal
- **Source:** https://opengameart.org/content/hq-pbr-tennis-ball
- **Use:** felt/seam material and proportion reference; v2 uses one re-authored high-resolution shell, fine procedural felt bump and a surface-integrated cream seam with a shallow physical panel joint.

## Balloon — Part 06
- **Source creator:** loafbrr_1
- **Asset:** Balloons
- **License:** Creative Commons CC0 1.0 Universal
- **Source:** https://opengameart.org/content/balloons-2
- **Use:** inflated latex silhouette, neck and knot reference; v2 uses a smooth high-resolution deformed sphere, restrained latex PBR material, folded knot and thin 3D string.

## Teeter-Totter — Part 07
- **Source creator:** leonkin
- **Asset:** Playground
- **License:** Creative Commons CC0 1.0 Universal
- **Source:** https://opengameart.org/content/playground
- **Use:** lever/pivot construction reference; v2 is re-authored as a workshop physics lever with a bevelled beam, contact pads, two real A-frame side plates, metal saddle, axle and base rather than playground furniture.

## Bellows — Part 08
- **Source creator:** Nudluria
- **Asset:** Bellows
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/bellows-9f0e0ac732af490bb68e98d21720cbfa
- **Attribution:** “Bellows” by Nudluria, used as an open-licensed geometric/proportion reference under CC BY.
- **Use:** overall paddle/leather/nozzle construction reference; v2 uses re-authored bevelled paddle boards, a single continuous pleated leather BufferGeometry shell, hinge, grips and a three-stage metal nozzle.

## Boxing Glove — Part 09
- **Source creator:** Incg5764
- **Asset:** Boxing Glove
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/boxing-glove-5b464201104949e09f77f2d1cf8b60c3
- **Attribution:** “Boxing Glove” by Incg5764, used as an open-licensed anatomical/proportion reference under CC BY.
- **Use:** v5 keeps the locally re-authored glove head but rebuilds the mechanism around the classic Incredible Machine interaction: compact blue/purple cuff base, red rear trigger button, hidden-at-rest guide/spring, fast forward punch, short hold and automatic return. The trigger contract is contact-driven rather than timer-driven: a rising contact on the rear button fires one punch and must be released before another punch can fire.

## Trampoline — Part 10
- **Source creator:** Simon Laisné
- **Asset:** Trampoline
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/trampoline-04505bad99204796a40e711f066b8f37
- **Attribution:** “Trampoline” by Simon Laisné, used as an open-licensed construction/proportion reference under CC BY.
- **Use:** v2 is re-authored locally with a continuous tubular frame, protective pad, taut fabric, twenty-two visible coil springs, real attachment tabs and paired U-legs.

## Fan Belt — Part 11
- **Source creator:** lokilegioner
- **Asset:** V Belt C Type
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/v-belt-c-type-507329650b9c4357b536464de7d38100
- **Attribution:** “V Belt C Type” by lokilegioner, used as an open-licensed V-profile/material reference under CC BY.
- **Use:** v2 is a locally generated continuous trapezoidal V-belt around two neutral preview pulleys, making the rotational-transfer function readable instead of presenting a rigid rounded rectangle.

## Gear — Part 12
- **Source creator:** plaggy
- **Asset:** CC0 - Gear
- **License:** Creative Commons CC0 1.0 Universal
- **Source:** https://sketchfab.com/3d-models/cc0-gear-bb92a0e2e5e04ed4a62a51dde6cb854a
- **Use:** PBR/material and machined-tooth reference; v2 uses a locally generated 24-tooth profile, true through-bore, lightening holes, raised hub rings, bore sleeve and subtle machined face steps.

## Conveyor Belt — Part 13
- **Source creator:** Jason Kan
- **Asset:** Conveyor Belt
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/conveyor-belt-a32d111b9d7b416e8a2c074501333eb4
- **Attribution:** “Conveyor Belt” by Jason Kan, used as an open-licensed industrial construction reference under CC BY.
- **Use:** v2 is re-authored locally as a complete machine with one continuous rubber loop, end drums, five support rollers, bearing housings, side rails, four braced legs, tread detail and a side-mounted motor/gearbox.

## Jack-in-the-Box — Classic Part 14
- **Primary visual reference creator:** evan.cg
- **Reference asset:** Jack In The Box
- **Reference license:** Creative Commons Attribution (CC BY)
- **Reference:** https://sketchfab.com/3d-models/jack-in-the-box-8c96dd839bc14a289a3c857a9a41ba0b
- **Additional construction reference:** “Jack In The Box” by Vasian-Digital3D, CC BY — https://sketchfab.com/3d-models/jack-in-the-box-32702a813df8489aad2a54be7eb5f86a
- **Attribution:** open models above are retained as visual/proportion references. Their downloadable binary meshes are not copied into this repository.
- **Production asset:** `public/assets/jack-in-the-box-v3-realistic.glb` is a locally re-authored binary GLB with named `JITB_Housing`, `JITB_Lid`, `JITB_Drive`, `JITB_Jack` and `JITB_Spring` assemblies. It is generated reproducibly from the project source and loaded at runtime through `GLTFLoader`.
- **Physics separation:** the high-detail render mesh is not used as a physics collider. Planck keeps simple dedicated bodies/joints for the input drive, latch, prismatic Jack, Hooke spring and hinged lid. Sufficient real input rotation releases the latch and the rising Jack opens the lid through physical contact.

## Pulley — Classic Part 18
- **Source creator:** fuglee
- **Asset:** Pulley
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/pulley-87d95e7b0c9d4a829823ceb29a79f0c3
- **Attribution:** “Pulley” by fuglee, used as an open-licensed forged-block/proportion reference under CC BY.
- **Use:** v1 is re-authored locally as a compact game-ready forged block with a grooved dynamic sheave, axle, mount eye and dynamic rope. The review mechanism uses a Planck PulleyJoint between unequal masses plus finite clutch torque so sheave rotation can lag the rope rather than being scripted.

## Electric Motor — Classic Part 25
- **Source creator:** joh.mackell
- **Asset:** Simple DC Motor Design
- **License:** Creative Commons Attribution (CC BY)
- **Source:** https://sketchfab.com/3d-models/simple-dc-motor-design-b909f3ece8b04f489207bbdd3eadcb1d
- **Attribution:** “Simple DC Motor Design” by joh.mackell, used as an open-licensed DC-motor proportion/construction reference under CC BY.
- **Use:** v1 keeps the compact cylindrical motor language but is re-authored into a game-ready PBR assembly with mounting feet, end bells, cooling vents, copper terminals, output hub and readable shaft markers. The shaft is a Planck dynamic body on a finite-torque revolute motor. A separate inertial flywheel is coupled through finite friction and velocity-dependent opposing load torque so the shaft can measurably slow under load.

CC0 attribution is not required, but provenance is retained for maintainability and review. CC-BY attribution is retained explicitly above.
