/**
 * 完整版題庫的登錄表（T2 v3 題庫規格 §3）：客規代碼 → 題庫。手寫；每一支的 `<slug>.ts` 是腳本產出的，
 * `test/t2KitV3Registry.test.ts` 核對這張表與配方表（`scripts/t2/kitv3-recipes`）一支不多、一支不少。
 */

import type { KitV3Bank } from './types';
import { BANK as SXK_GM } from './sxk-gm';
import { BANK as SXK_SOC } from './sxk-soc';
import { BANK as SXK_ADP } from './sxk-adp';
import { BANK as SXK_PLC } from './sxk-plc';
import { BANK as SXK_LANG } from './sxk-lang';
import { BANK as SXK_LQ } from './sxk-lq';
import { BANK as MCHAT_RF } from './mchat-rf';
import { BANK as SXK_ASQ3 } from './sxk-asq3';
import { BANK as SXK_VOC } from './sxk-voc';
import { BANK as SXK_ASB } from './sxk-asb';
import { BANK as SXK_ASR } from './sxk-asr';
import { BANK as SXK_QOL } from './sxk-qol';
import { BANK as SXK_AB } from './sxk-ab';
import { BANK as SXK_ATT } from './sxk-att';
import { BANK as SNAP_IV } from './snap-iv';
import { BANK as CHEXI } from './chexi';
import { BANK as SXK_LDP } from './sxk-ldp';
import { BANK as SXK_LDS } from './sxk-lds';
import { BANK as SXK_SP } from './sxk-sp';
import { BANK as SXK_SPB } from './sxk-spb';
import { BANK as SXK_ADL } from './sxk-adl';
import { BANK as SXK_EMO } from './sxk-emo';
import { BANK as SXK_TIC } from './sxk-tic';
import { BANK as TEMPERAMENT } from './temperament';

export const KITV3_BANKS: Readonly<Record<string, KitV3Bank>> = {
  'SXK-GM': SXK_GM,
  'SXK-SOC': SXK_SOC,
  'SXK-ADP': SXK_ADP,
  'SXK-PLC': SXK_PLC,
  'SXK-LANG': SXK_LANG,
  'SXK-LQ': SXK_LQ,
  'M-CHAT-R/F': MCHAT_RF,
  'SXK-ASQ3': SXK_ASQ3,
  'SXK-VOC': SXK_VOC,
  'SXK-ASB': SXK_ASB,
  'SXK-ASR': SXK_ASR,
  'SXK-QOL': SXK_QOL,
  'SXK-AB': SXK_AB,
  'SXK-ATT': SXK_ATT,
  'SNAP-IV': SNAP_IV,
  'CHEXI': CHEXI,
  'SXK-LDP': SXK_LDP,
  'SXK-LDS': SXK_LDS,
  'SXK-SP': SXK_SP,
  'SXK-SPb': SXK_SPB,
  'SXK-ADL': SXK_ADL,
  'SXK-EMO': SXK_EMO,
  'SXK-TIC': SXK_TIC,
  'ITQ/TTS/BSQ': TEMPERAMENT,
};

export function isKitV3Tool(x: unknown): x is string {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(KITV3_BANKS, x);
}
