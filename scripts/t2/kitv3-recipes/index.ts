/** 完整版題庫的配方表（T2 v3 題庫規格 §3.2）：每一族一個檔，在這裡依客規附錄 A 的順序接起來。 */

import type { V3Recipe } from '../kitv3';
import { PCT_RECIPES } from './pct';
import { LQ_RECIPES } from './lq';

export const V3_RECIPES: V3Recipe[] = [...PCT_RECIPES, ...LQ_RECIPES];
