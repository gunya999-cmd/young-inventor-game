import { LEVEL_01, LEVEL_07, type LevelSpec } from './level';
import type { MachineSnapshot, PartState } from './model';
import { createLevel07ReferenceSolution } from './referenceSolution';

function initialParts(level:LevelSpec):PartState[]{
 return level.initialParts.map(part=>({...part,locked:true}));
}

/** Canonical introductory build: three rails form one continuous descending route. */
function createLevel01Route(level:LevelSpec):MachineSnapshot{
 return {
  parts:[
   ...initialParts(level),
   {id:'reference-1-rail-a',kind:'plank',x:548,y:330,angle:.34,fixed:true},
   {id:'reference-1-rail-b',kind:'plank',x:758,y:407,angle:.34,fixed:true},
   {id:'reference-1-rail-c',kind:'plank',x:965,y:468,angle:.24,fixed:true}
  ],
  ropes:[],hinges:[],signals:level.initialSignals.map(link=>({...link}))
 };
}

/**
 * Legal geometry-only route retained for campaign levels 2–6 until they are
 * redesigned from the Level 01 gold-standard template.
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
 if(level.id===LEVEL_01.id)return createLevel01Route(level);
 if(level.id===LEVEL_07.id)return createLevel07ReferenceSolution();
 return createIntroRoute(level);
}
