// @ts-nocheck
import { ASSET_BACKGROUND_IMAGE } from './assetBackgroundImage';
import { ASSET_STATIC_SPRITES } from './assetStaticSprites';
import { ASSETS_MECHANISM_A } from './assetsMechanismA';
import { ASSETS_MECHANISM_B } from './assetsMechanismB';
import { ASSETS_PARTS } from './assetsParts';
export const VISUAL_ASSETS = { ...ASSET_BACKGROUND_IMAGE, ...ASSET_STATIC_SPRITES, ...ASSETS_MECHANISM_A, ...ASSETS_MECHANISM_B, ...ASSETS_PARTS } as const;
