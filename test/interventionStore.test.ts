import { describe, it, expect } from 'vitest';
import * as mysqlDb from '../src/db/mysql';

/**
 * 「這一格沒有素材」與「素材讀不到」必須是兩個不同的回答（issue #26）。
 *
 * `findActiveMaterialByCell` 的 `null` 有一個確切的意思：這一格沒有啟用中的素材，
 * 也就是家長端的「準備中」。連線池建不起來時**跟著回 `null`**，就會對每一位家長
 * 說內容還在準備 —— 那聽起來像待辦事項，不像故障，於是沒有人會去查，而真正的
 * 情況是所有已經建好的素材一份都送不出去。
 *
 * 路由那一半（例外 → `unavailable`）由 `interventionPack.http.test.ts` 釘住；
 * 這一支釘的是資料層有沒有真的把例外拋出來。
 *
 * `test/setup/testEnv.ts` 把 MYSQL_* 一律清空，所以這裡的 `getPool()` 必定是 null。
 */
describe('取一格素材時的連線池', () => {
  it('沒有連線池時拋例外，不回 null', async () => {
    await expect(
      mysqlDb.findActiveMaterialByCell('language', 'B', 'delay')
    ).rejects.toThrow(/pool/i);
  });

  it('護欄本身沒有壞掉：這個環境確實沒有設定資料庫', () => {
    expect(mysqlDb.isConfigured()).toBe(false);
  });
});

/**
 * 一列素材讀成一筆紀錄時，步驟是**全有或全無**。
 *
 * 90 格的內容有一部分會是直接下 SQL 補進去的（後台表單不是唯一的入口），
 * 那些列沒有經過 `readMaterialInput` 的檢查。留下好的那幾則會讓家長拿到一份
 * 少了中間某一步的訓練並照著做完 —— 他無從知道自己手上的是殘缺的版本。
 */
describe('讀一列素材：步驟全有或全無', () => {
  const row = (steps: unknown) => ({
    id: 1,
    dimension_id: 'language',
    age_band_id: 'B',
    severity: 'delay',
    title: '轮流发声',
    steps,
    video_url: null,
    active: 1,
    updated_at: null,
  });

  const good = [
    { imageUrl: '/m/1.png', instruction: '面对面坐下。' },
    { imageUrl: '/m/2.png', instruction: '发出一个单音。' },
  ];

  it('全部好的就原樣讀出來，順序不動', () => {
    expect(mysqlDb.materialFromRow(row(JSON.stringify(good))).steps).toEqual(good);
    // MySQL 的 JSON 欄位也可能直接回陣列，不是字串。
    expect(mysqlDb.materialFromRow(row(good)).steps).toEqual(good);
  });

  it.each([
    ['混進一則 null', [good[0], null]],
    ['混進一則缺圖', [good[0], { instruction: '只有字' }]],
    ['混進一則缺指令', [{ imageUrl: '/m/9.png' }, good[1]]],
    ['混進一則空字串圖', [{ imageUrl: '', instruction: '有字沒圖' }]],
    ['整個欄位是壞掉的 JSON', '{不是 JSON'],
    ['整個欄位是物件不是陣列', { imageUrl: '/m/1.png' }],
  ])('%s —— 整份退成空陣列，不留下好的那幾則', (_label, steps) => {
    const parsed = mysqlDb.materialFromRow(row(typeof steps === 'string' ? steps : steps));
    expect(parsed.steps).toEqual([]);
  });

  it('其餘欄位照常讀得出來 —— 步驟壞掉不會讓整列讀不出來', () => {
    const parsed = mysqlDb.materialFromRow(row([null]));
    expect(parsed).toMatchObject({ id: 1, dimensionId: 'language', ageBandId: 'B', title: '轮流发声', active: true });
  });
});
