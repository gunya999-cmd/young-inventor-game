import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS } from './level';
import { calculateStars, isLevelUnlocked, loadCampaignProgress, recordCompletion, type CampaignProgress } from './campaign';

describe('campaign progression',()=>{
 it('awards three stars when both par targets are met',()=>{
  const level=CAMPAIGN_LEVELS[0];
  expect(calculateStars(level,(level.parTime??20)-1,(level.parParts??3))).toBe(3);
 });
 it('keeps the best stars, time and part count across replays',()=>{
  const level=CAMPAIGN_LEVELS[0];
  let progress:CampaignProgress={levels:{}};
  progress=recordCompletion(progress,level,40,4);
  progress=recordCompletion(progress,level,15,6);
  expect(progress.levels[level.id].completed).toBe(true);
  expect(progress.levels[level.id].bestTime).toBe(15);
  expect(progress.levels[level.id].fewestParts).toBe(4);
  expect(progress.levels[level.id].stars).toBeGreaterThanOrEqual(2);
 });
 it('unlocks only the first level until its predecessor is completed',()=>{
  const empty:CampaignProgress={levels:{}};
  expect(isLevelUnlocked(CAMPAIGN_LEVELS[0],empty)).toBe(true);
  expect(isLevelUnlocked(CAMPAIGN_LEVELS[1],empty)).toBe(false);
  const after=recordCompletion(empty,CAMPAIGN_LEVELS[0],20,3);
  expect(isLevelUnlocked(CAMPAIGN_LEVELS[1],after)).toBe(true);
 });
 it('recovers cleanly from malformed storage',()=>{
  const storage={getItem:()=>'{broken'};
  expect(loadCampaignProgress(storage as Pick<Storage,'getItem'>)).toEqual({levels:{}});
 });
});
