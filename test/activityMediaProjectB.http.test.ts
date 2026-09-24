import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * ⚠️ **必須在載入 `server.ts` 之前設定。** 少了這一行，整支測試會在專案 A 的伺服器上跑，
 * 而那裡 `/media` 是存在的 —— 拿到的 200 會被讀成「B 也有示範片」。
 */
process.env.APP_MODE = 't1only';

/**
 * 專案 B 沒有 `/media`（Keep 規格 K05）：B 沒有 T2，也就沒有活動與示範片。
 *
 * 就算 B 的主機上剛好有同一個目錄、放著同一支片，B 也不服務它 —— 路由掛在 `tier2Only` 上，
 * 在 B 註冊到一個永遠不會被掛載的 Router（與 `t2PlanProjectB.http.test.ts` 同一個寫法）。
 */

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sxk-media-b-'));
const MEDIA = path.join(TMP, 'media');
fs.mkdirSync(path.join(MEDIA, 'activities'), { recursive: true });
fs.writeFileSync(path.join(MEDIA, 'activities', 'A001.mp4'), Buffer.alloc(100, 1));
process.env.MEDIA_DIR = MEDIA;

let client: TestClient;

beforeAll(async () => {
  client = await startTestApp(await loadApp());
});

afterAll(async () => {
  await client.close();
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('專案 B 沒有示範片的靜態目錄', () => {
  it('片子在目錄裡也不服務：404', async () => {
    expect((await client.get('/media/activities/A001.mp4')).status).toBe(404);
  });

  it('Range 請求也一樣 404（不是 206）', async () => {
    expect((await client.get('/media/activities/A001.mp4', { Range: 'bytes=0-1' })).status).toBe(404);
  });
});
