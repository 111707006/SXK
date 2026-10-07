/**
 * 完整版題庫的**延遲載入**（畫面用）：24 支加起來數百 KB，手機上只在打開那一支時才下載那一支（每支一個 chunk）。
 * 伺服器與測試用 `index.ts` 的 `KITV3_BANKS`（一次全載）；兩張表一支不多、一支不少由 `test/t2KitV3Registry.test.ts` 核對。
 */

import type { KitV3Bank } from './types';

export const KITV3_LOADERS: Readonly<Record<string, () => Promise<KitV3Bank>>> = {
  'SXK-GM': () => import('./sxk-gm').then(m => m.BANK),
  'SXK-SOC': () => import('./sxk-soc').then(m => m.BANK),
  'SXK-ADP': () => import('./sxk-adp').then(m => m.BANK),
  'SXK-PLC': () => import('./sxk-plc').then(m => m.BANK),
  'SXK-LANG': () => import('./sxk-lang').then(m => m.BANK),
  'SXK-LQ': () => import('./sxk-lq').then(m => m.BANK),
  'M-CHAT-R/F': () => import('./mchat-rf').then(m => m.BANK),
  'SXK-ASQ3': () => import('./sxk-asq3').then(m => m.BANK),
  'SXK-VOC': () => import('./sxk-voc').then(m => m.BANK),
  'SXK-ASB': () => import('./sxk-asb').then(m => m.BANK),
  'SXK-ASR': () => import('./sxk-asr').then(m => m.BANK),
  'SXK-QOL': () => import('./sxk-qol').then(m => m.BANK),
  'SXK-AB': () => import('./sxk-ab').then(m => m.BANK),
  'SXK-ATT': () => import('./sxk-att').then(m => m.BANK),
  'SNAP-IV': () => import('./snap-iv').then(m => m.BANK),
  'CHEXI': () => import('./chexi').then(m => m.BANK),
  'SXK-LDP': () => import('./sxk-ldp').then(m => m.BANK),
  'SXK-LDS': () => import('./sxk-lds').then(m => m.BANK),
  'SXK-SP': () => import('./sxk-sp').then(m => m.BANK),
  'SXK-SPb': () => import('./sxk-spb').then(m => m.BANK),
  'SXK-ADL': () => import('./sxk-adl').then(m => m.BANK),
  'SXK-EMO': () => import('./sxk-emo').then(m => m.BANK),
  'SXK-TIC': () => import('./sxk-tic').then(m => m.BANK),
  'ITQ/TTS/BSQ': () => import('./temperament').then(m => m.BANK),
};
