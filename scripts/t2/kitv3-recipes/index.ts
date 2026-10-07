/** 完整版題庫的配方表（T2 v3 題庫規格 §3.2）：每一族一個檔，在這裡依客規附錄 A 的順序接起來。 */

import type { V3Recipe } from '../kitv3';
import { PCT_RECIPES } from './pct';
import { LQ_RECIPES } from './lq';
import { MCHAT_RECIPES } from './mchat';
import { ASQ3_RECIPES } from './asq3';
import { VOC_RECIPES } from './voc';
import { CONCERN_RECIPES } from './concern';
import { QOL_RECIPES } from './qol';
import { ATTENTION_RECIPES } from './attention';
import { SNAP_CHEXI_RECIPES } from './snapchexi';
import { LD_RECIPES } from './ld';
import { SP_RECIPES } from './sp';
import { ADL_RECIPES } from './adl';
import { EMO_TIC_RECIPES } from './emotic';

export const V3_RECIPES: V3Recipe[] = [...PCT_RECIPES, ...LQ_RECIPES, ...MCHAT_RECIPES, ...ASQ3_RECIPES, ...VOC_RECIPES, ...CONCERN_RECIPES, ...QOL_RECIPES, ...ATTENTION_RECIPES, ...SNAP_CHEXI_RECIPES, ...LD_RECIPES, ...SP_RECIPES, ...ADL_RECIPES, ...EMO_TIC_RECIPES];
