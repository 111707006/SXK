/**
 * 把一支 `ToolkitBank` 印成 `src/t2/toolkit/<id>.ts`。
 *
 * 輸出必須**逐位元可重現**：同一個 zip 跑兩次要得到一樣的檔案，測試才能拿
 * 「重跑腳本、比對 git 裡那一份」當驗收。所以這裡不用 JSON.stringify（它不管
 * 一題一行這種可讀性），自己走一遍：物件的 key 照插入順序、字串一律單引號、
 * 沒有尾逗號以外的任何隨機性，也不寫時間戳。
 */

import type { ToolkitBank } from '../../src/t2/toolkit/types';

const INDENT = '  ';

export function constName(id: string): string {
  return id.toUpperCase().replace(/-/g, '_');
}

export function emitBankModule(bank: ToolkitBank, kitZip: string): string {
  const lines = [
    '/**',
    ` * ${bank.code}　${bank.title}`,
    ' *',
    ` * 由 \`scripts/t2-extract-toolkit.ts\` 從 \`${kitZip}\` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，`,
    ' * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。',
    ` * 來源檔：\`${bank.source.file}\`（sha256 ${bank.source.sha256.slice(0, 12)}…）。`,
    ' * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。',
    ' */',
    '',
    "import type { ToolkitBank } from './types';",
    '',
    `export const ${constName(bank.id)}: ToolkitBank = ${render(bank as unknown as Json, 0)};`,
    '',
  ];
  return lines.join('\n');
}

type Json = null | boolean | number | string | Json[] | { [k: string]: Json | undefined };

function render(v: Json | undefined, depth: number): string {
  if (v === null) return 'null';
  if (v === undefined) throw new Error('題庫裡不該有 undefined');
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  if (typeof v === 'string') return quote(v);
  if (Array.isArray(v)) return renderArray(v, depth);
  return renderObject(v, depth);
}

function renderArray(arr: Json[], depth: number): string {
  if (arr.length === 0) return '[]';
  if (arr.every(x => x === null || typeof x !== 'object')) {
    return `[${arr.map(x => render(x, depth)).join(', ')}]`;
  }
  const pad = INDENT.repeat(depth + 1);
  return `[\n${arr.map(x => pad + render(x, depth + 1) + ',').join('\n')}\n${INDENT.repeat(depth)}]`;
}

function renderObject(obj: { [k: string]: Json | undefined }, depth: number): string {
  const entries = Object.entries(obj).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return '{}';
  // 一個物件裡沒有任何「裝著物件的陣列」時，一行印完 —— 題目、選項、分段都是這種。
  const flat = entries.every(([, v]) => !Array.isArray(v) || v.every(x => x === null || typeof x !== 'object'));
  if (flat) {
    return `{ ${entries.map(([k, v]) => `${key(k)}: ${render(v, depth)}`).join(', ')} }`;
  }
  const pad = INDENT.repeat(depth + 1);
  return `{\n${entries.map(([k, v]) => `${pad}${key(k)}: ${render(v, depth + 1)},`).join('\n')}\n${INDENT.repeat(depth)}}`;
}

function key(k: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(k) ? k : quote(k);
}

function quote(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}
