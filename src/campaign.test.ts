import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, CUSTOM_LEVEL_STORAGE_KEY } from './level';
import { calculateStars, isCampaignCompletionEligible, isLevelUnlocked, loadCampaignProgress, recordCompletion, type CampaignProgress } from './campaign';

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
 it('recovers cleanly from malformed JSON storage',()=>{
  const storage={getItem:()=>'{broken'};
  expect(loadCampaignProgress(storage as Pick<Storage,'getItem'>)).toEqual({levels:{}});
 });
 it('drops malformed and unknown level progress records',()=>{
  const validId=CAMPAIGN_LEVELS[0].id;
  const storage={getItem:()=>JSON.stringify({levels:{
   [validId]:{completed:true,stars:3,bestTime:12.4,fewestParts:3},
   [CAMPAIGN_LEVELS[1].id]:{},
   'custom-cheat':{completed:true,stars:3,bestTime:1,fewestParts:0}
  }})};
  expect(loadCampaignProgress(storage as Pick<Storage,'getItem'>)).toEqual({levels:{
   [validId]:{completed:true,stars:3,bestTime:12.4,fewestParts:3}
  }});
 });
 it('does not award campaign progress while a custom level is active',()=>{
  const levelId=CAMPAIGN_LEVELS[0].id;
  const campaignStorage={getItem:()=>null};
  const customStorage={getItem:(key:string)=>key===CUSTOM_LEVEL_STORAGE_KEY?'{}':null};
  expect(isCampaignCompletionEligible(levelId,campaignStorage as Pick<Storage,'getItem'>)).toBe(true);
  expect(isCampaignCompletionEligible(levelId,customStorage as Pick<Storage,'getItem'>)).toBe(false);
 });
 it('rejects unknown level ids even without a custom level',()=>{
  const storage={getItem:()=>null};
  expect(isCampaignCompletionEligible('not-a-campaign-level',storage as Pick<Storage,'getItem'>)).toBe(false);
 });
});
