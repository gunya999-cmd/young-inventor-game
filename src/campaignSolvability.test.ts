import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS } from './level';
import { createCampaignReferenceSolution } from './campaignReferenceSolutions';
import { validateLevel } from './levelValidator';

describe('campaign solvability',()=>{
 for(const level of CAMPAIGN_LEVELS){
  it(`level ${level.number} ${level.id} has a repeatable legal solution`,()=>{
   const reference=createCampaignReferenceSolution(level);
   const playerParts=reference.parts.filter(part=>!part.locked);
   for(const part of playerParts){
    expect(level.inventory[part.kind],`${part.kind} must be in level inventory`).toBeGreaterThan(0);
   }
   const usedByKind=new Map<string,number>();
   for(const part of playerParts)usedByKind.set(part.kind,(usedByKind.get(part.kind)??0)+1);
   for(const [kind,count] of usedByKind){
    expect(count,`${kind} reference count must fit inventory`).toBeLessThanOrEqual(level.inventory[kind as keyof typeof level.inventory]);
   }
   const report=validateLevel(level,reference);
   expect(report.baselineWon,'level must not solve itself').toBe(false);
   expect(report.referenceWon,report.checks.map(check=>`${check.severity}: ${check.title} — ${check.detail}`).join('\n')).toBe(true);
   expect(report.valid,report.checks.map(check=>`${check.severity}: ${check.title} — ${check.detail}`).join('\n')).toBe(true);
  });
 }
});
