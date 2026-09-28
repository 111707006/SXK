import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * `deploy/schema.sql` 要能用 mysql 用戶端直接套（`deploy/README.md`：「全新库请先执行 schema.sql」；
 * Render 展示站 `deploy/demo/bake.sh` 就是這樣建表的）。
 *
 * MySQL 的註解是「`--` 後面接一個空白」。`--（src/t2/scoring）` 這種少了空白的寫法不是註解，
 * 而是一句語法錯誤 —— 2026-09-28 建展示站時在第 430 行撞到，整份 schema 停在一半。
 * 遷移檔不受影響：`deploy/migrate.mjs` 自己先把 `--` 開頭的行拿掉才切句子。
 */
describe('schema.sql 的註解', () => {
  it('每一行 `--` 註解後面都有空白（或是一整排 `----` 分隔線）', () => {
    const lines = fs.readFileSync(path.resolve(__dirname, '..', 'deploy', 'schema.sql'), 'utf8').split('\n');
    const bad = lines
      .map((line, i) => ({ no: i + 1, line }))
      .filter(({ line }) => /^\s*--[^\s-]/.test(line));
    expect(bad).toEqual([]);
  });
});
