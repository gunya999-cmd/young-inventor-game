// @ts-nocheck
import { ASSET_BACKGROUND_IMAGE } from './assetBackgroundImage';
import { ASSET_STATIC_SPRITES } from './assetStaticSprites';
import { ASSET_BALL } from './asset_ball';
import { PROCEDURAL_MECHANISM_ASSETS } from './proceduralMechanismAssets';
import { ASSETS_PARTS } from './assetsParts';

export const VISUAL_ASSETS = {
  ...ASSET_BACKGROUND_IMAGE,
  ...ASSET_STATIC_SPRITES,
  ...ASSET_BALL,
  ...PROCEDURAL_MECHANISM_ASSETS,
  ...ASSETS_PARTS
} as const;
