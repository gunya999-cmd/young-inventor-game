import { LEVEL_07, type LevelSpec } from './level';
import type { MachineSnapshot, PartState } from './model';
import { createLevel07ReferenceSolution } from './referenceSolution';

function initialParts(level:LevelSpec):PartState[]{
 return level.initialParts.map(part=>({...part,locked:true}));
}

/**
 * Legal geometry-only route for the introductory campaign levels.
 * The two fixed guide rails are available in every level 1–6 inventory and
 * bridge only the authored gaps; no hidden joints, forces or special values.
 */
function createIntroRoute(level:LevelSpec):MachineSnapshot{
 return {
  parts:[
   ...initialParts(level),
   {id:`reference-${level.number}-bridge-a`,kind:'plank',x:535,y:412,angle:.66,fixed:true},
   {id:`reference-${level.number}-bridge-b`,kind:'plank',x:985,y:552,angle:.52,fixed:true}
  ],
  ropes:[],hinges:[],signals:level.initialSignals.map(link=>({...link}))
 };
}

export function createCampaignReferenceSolution(level:LevelSpec):MachineSnapshot{
 if(level.id===LEVEL_07.id)return createLevel07ReferenceSolution();
 return createIntroRoute(level);
}
