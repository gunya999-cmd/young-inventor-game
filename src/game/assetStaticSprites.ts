// @ts-nocheck
import { ASSET_RAMP_SUPPORT } from './assetRampSupport';
import { ASSET_BELL_ASSEMBLY } from './assetBellAssembly';
export const ASSET_STATIC_SPRITES = { ...ASSET_RAMP_SUPPORT, ...ASSET_BELL_ASSEMBLY } as const;
