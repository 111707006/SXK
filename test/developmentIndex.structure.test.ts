import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * 發育指數與通過率表只給伺服器（#68，規格 §3.2）：家長端 bundle 不能帶著 180 題的推估表。
 *
 * 從家長端唯一的入口（`index.html` → `src/main.tsx`）沿著 import 走一遍 —— 靜態 import、`export … from`、
 * `import()`（後台是 lazy chunk，一樣會被 vite 打包、放上家長也下載得到的同一個網站）—— 走得到的檔案
 * 都不能是 `src/developmentIndex/` 底下的。只走相對路徑（套件不會 import 我們的檔）。
 */

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'src/main.tsx');
const SERVER_ONLY_DIR = path.join(ROOT, 'src/developmentIndex') + path.sep;

const SPECIFIER = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolve(from: string, spec: string): string | null {
  const base = path.resolve(path.dirname(from), spec);
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(SPECIFIER)) {
      const spec = m[1] ?? m[2] ?? m[3];
      if (!spec.startsWith('.')) continue;
      const target = resolve(file, spec);
      if (target) queue.push(target);
    }
  }
  return seen;
}

describe('發育指數不進家長端 bundle', () => {
  const reached = reachableFrom(ENTRY);
  const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

  it('入口就是 index.html 載的那一支', () => {
    expect(readFileSync(path.join(ROOT, 'index.html'), 'utf8')).toContain('src="/src/main.tsx"');
  });

  it('走得到家長端與後台（lazy）的檔案 —— 確定真的有在走', () => {
    const files = [...reached].map(rel);
    expect(files).toContain('src/t1report/answers.ts');
    expect(files).toContain('src/admin/AdminApp.tsx');
    expect(files.length).toBeGreaterThan(100);
  });

  it('走不到 src/developmentIndex/ 底下任何一檔', () => {
    expect([...reached].filter(f => f.startsWith(SERVER_ONLY_DIR)).map(rel)).toEqual([]);
  });
});
