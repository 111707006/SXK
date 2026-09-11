/**
 * 抽題的可重用入口：從工具包 zip 算出 `src/t2/toolkit/<id>.ts` 每一份該長什麼樣。
 *
 * 腳本（`scripts/t2-extract-toolkit.ts`）拿它來寫檔；結構測試拿它來比對 —— 重跑一次、
 * 逐位元對照 git 裡那一份，這就是「抽取腳本從 zip 重跑，產出與已提交的一致」那條
 * 驗收的實作。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readZip } from './zip';
import { KIT_ZIP, extractToolkit } from './kit';
import { emitBankModule } from './emit';
import type { ToolkitBank } from '../../src/t2/toolkit/types';

export const TOOLKIT_DIR = 'src/t2/toolkit';

export function loadKitZip(root: string): Map<string, Buffer> {
  return readZip(readFileSync(path.join(root, KIT_ZIP)));
}

export function extractBanks(root: string): ToolkitBank[] {
  return extractToolkit(loadKitZip(root));
}

/**
 * 比對「重跑的結果」與「磁碟上那一份」時用這個，不要直接 `===`。
 * 這台機器 `core.autocrlf=true`：fresh clone 在 Windows 上會把 LF 換成 CRLF，那是 git 的
 * 換行政策不是內容；只把 CRLF 折回 LF，其餘一個位元都不放過。
 */
export function sameToolkitContent(a: string, b: string): boolean {
  return a.replace(/\r\n/g, '\n') === b.replace(/\r\n/g, '\n');
}

/** `相對路徑 → 檔案內容`，相對於 repo 根目錄。 */
export function renderToolkitFiles(root: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const bank of extractBanks(root)) {
    out.set(`${TOOLKIT_DIR}/${bank.id}.ts`, emitBankModule(bank, KIT_ZIP));
  }
  return out;
}
