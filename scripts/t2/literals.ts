/**
 * 從工具包 HTML 的 `<script>` 開頭取出「純資料的 const／let 宣告」。
 *
 * 【規則：一行都不執行】
 * 工具包每支 HTML 的 script 都長這樣：先是一串 `const SECS = [...]`、`const LEVELS = [...]`
 * 這種資料宣告，然後才是 `const $ = id => document.getElementById(id)` 與一堆函式。
 * 這裡只收前面那一段，而且每個初始值都先過一次 token 檢查 —— 除了字串、數字、
 * `null`／`true`／`false`、標點與物件的 key 之外**不得有任何識別字** —— 才丟進
 * 沒有任何全域的 vm 沙箱求值。所以 `Math.random()`、`document.x`、箭頭函式一律進不來；
 * 第一個不是純資料宣告的敘述（`SECS.forEach(...)`、`const $ = ...`、`function ...`）
 * 就是收集的終點。
 *
 * 分段函式（M-CHAT 的 `band(n)`、CHEXI 的 `band(pct)`、LDP 的 `domLevel(s)`……）
 * 不在這一段裡，那些用 `kit.ts` 的正則探針去**讀**原始碼，同樣不執行。
 */

import vm from 'node:vm';

export interface DataDeclaration {
  name: string;
  value: unknown;
  /** 初始值在 script 裡的原文，供除錯。 */
  raw: string;
}

/** 回傳依出現順序排列的宣告；碰到第一個非資料敘述就停。 */
export function collectDataDeclarations(script: string): Map<string, DataDeclaration> {
  const out = new Map<string, DataDeclaration>();
  let p = skipTrivia(script, 0);
  while (p < script.length) {
    const head = /^(?:const|let|var)\s+/.exec(script.slice(p));
    if (!head) break;
    p += head[0].length;

    // 一個宣告可能有多個 declarator：`let A = {}, F = {};`
    let more = true;
    while (more) {
      const nameMatch = /^([A-Za-z_$][\w$]*)\s*=\s*/.exec(script.slice(p));
      if (!nameMatch) return out;
      p += nameMatch[0].length;
      const end = scanInitializer(script, p);
      if (end < 0) return out;
      const raw = script.slice(p, end).trim();
      if (!isPureData(raw)) return out;
      out.set(nameMatch[1], { name: nameMatch[1], value: evaluateLiteral(raw), raw });
      p = end;
      const sep = script[p];
      p += 1; // 跳過 `,` 或 `;`
      more = sep === ',';
      if (more) p = skipTrivia(script, p);
    }
    p = skipTrivia(script, p);
  }
  return out;
}

/** 跳過空白、`"use strict";` 與兩種註解。 */
function skipTrivia(s: string, p: number): number {
  for (;;) {
    const m = /^(?:\s+|"use strict";|\/\*[\s\S]*?\*\/|\/\/[^\n]*)/.exec(s.slice(p));
    if (!m || m[0].length === 0) return p;
    p += m[0].length;
  }
}

/**
 * 從 `p` 掃到初始值結束的位置：深度 0 的 `;` 或 `,`。回傳那個分隔符的索引。
 * 字串裡的括號與分號不算；`//` 註解到行尾略過。
 */
function scanInitializer(s: string, p: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = p; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '/' && s[i + 1] === '/') { i = s.indexOf('\n', i); if (i < 0) return -1; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i); if (e < 0) return -1; i = e + 1; continue; }
    if (c === '(' || c === '[' || c === '{') depth++;
    else if (c === ')' || c === ']' || c === '}') depth--;
    else if (depth === 0 && (c === ';' || c === ',')) return i;
    else if (depth === 0 && c === '\n') {
      // 沒有分號就換行的宣告（工具包沒有這種，但別讓它安靜地吞掉下一行）
      return i;
    }
  }
  return -1;
}

/**
 * 初始值只能由字面量組成。逐字元走過：字串整段跳過；遇到識別字時，只有
 * `null`／`true`／`false`，或緊接著 `:` 的物件 key 才放行。
 */
export function isPureData(raw: string): boolean {
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    // 樣板字串的 `${…}` 可以夾任何運算式，不算字面量 —— 工具包的資料裡也沒有。
    if (c === '`') return false;
    if (c === '"' || c === "'") { quote = c; continue; }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < raw.length && /[\w$]/.test(raw[j])) j++;
      const word = raw.slice(i, j);
      const next = raw.slice(j).match(/^\s*(\S)/)?.[1];
      const isKey = next === ':';
      if (!isKey && !['null', 'true', 'false'].includes(word)) return false;
      i = j - 1;
      continue;
    }
    if (/[0-9]/.test(c)) {
      // 數字裡可能有 e／E，別讓它被當成識別字
      let j = i;
      while (j < raw.length && /[0-9.eE+-]/.test(raw[j])) j++;
      i = j - 1;
    }
  }
  return quote === null;
}

function evaluateLiteral(raw: string): unknown {
  // 括號包起來，物件字面量才不會被當成區塊。沙箱沒有任何我們給的全域。
  return vm.runInNewContext(`(${raw})`, Object.create(null), { timeout: 1000 });
}
