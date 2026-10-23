import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { homeMediaFromRow, isSafeMediaLink, publicHomeMedia, readPublicHomeMedia, type HomeMediaItem } from '../src/homeMedia/shape';
import { precheckHomeMediaFile } from '../src/admin/panels/HomeMediaPanel';

/**
 * 首頁素材的純函式（#87）：連結只收站內路徑或 https、公開那一份只有啟用中的、上傳前的格式與大小檢查；
 * schema 與遷移的 CREATE TABLE 一字不差。
 */

describe('isSafeMediaLink', () => {
  it.each(['/', '/r/abc', '/handoff', 'https://example.com', 'https://example.com/a?b=1#c', 'https://活动.cn/x'])('收 %s', link => {
    expect(isSafeMediaLink(link)).toBe(true);
  });

  it.each([
    '', ' /', '/ ', '//evil.com', '/\\evil.com', 'http://example.com', 'HTTP://example.com', 'javascript:alert(1)',
    'JavaScript:alert(1)', 'data:text/html,hi', 'event', 'example.com', 'ftp://example.com', 'https://', 'https://user:pw@example.com',
    '/a\nb', `/${'a'.repeat(600)}`,
  ])('不收 %j', link => {
    expect(isSafeMediaLink(link)).toBe(false);
  });

  it('不是字串不收', () => {
    expect(isSafeMediaLink(null)).toBe(false);
    expect(isSafeMediaLink(1)).toBe(false);
  });
});

const row = (over: Record<string, unknown>) => ({ id: 1, slot: 'banner', kind: 'image', url: '/media/home/a.jpg?v=1', poster_url: null, link: null, sort_order: 1, active: 1, created_at: null, ...over });

describe('列與公開那一份', () => {
  it('認不得的列不要（不畫一張壞掉的素材）', () => {
    expect(homeMediaFromRow(row({ slot: 'nope' }))).toBeNull();
    expect(homeMediaFromRow(row({ kind: 'gif' }))).toBeNull();
    expect(homeMediaFromRow(row({ url: '' }))).toBeNull();
  });

  it('資料庫裡不安全的連結讀成沒有連結', () => {
    expect(homeMediaFromRow(row({ link: 'javascript:alert(1)' }))!.link).toBeNull();
  });

  it('只有啟用中的；開屏取排序最前的一張；輪播依排序', () => {
    const items = [
      row({ id: 1, sort_order: 3 }), row({ id: 2, sort_order: 1 }), row({ id: 3, sort_order: 2, active: 0 }),
      row({ id: 4, slot: 'splash', sort_order: 2 }), row({ id: 5, slot: 'splash', sort_order: 1 }),
    ].map(r => homeMediaFromRow(r)!) as HomeMediaItem[];
    const pub = publicHomeMedia(items);
    expect(pub.splash!.id).toBe(5);
    expect(pub.banners.map(b => b.id)).toEqual([2, 1]);
  });

  it('前端讀回來形狀不對就當成沒有素材', () => {
    expect(readPublicHomeMedia(null)).toEqual({ splash: null, banners: [] });
    expect(readPublicHomeMedia({ splash: { url: 1 }, banners: 'x' })).toEqual({ splash: null, banners: [] });
  });
});

describe('上傳前的檢查（後台畫面）', () => {
  it('格式', () => {
    expect(precheckHomeMediaFile({ type: 'image/jpeg', size: 10 })).toEqual({ kind: 'image' });
    expect(precheckHomeMediaFile({ type: 'image/png', size: 10 })).toEqual({ kind: 'image' });
    expect(precheckHomeMediaFile({ type: 'video/mp4', size: 10 })).toEqual({ kind: 'video' });
    expect(precheckHomeMediaFile({ type: 'image/gif', size: 10 })).toHaveProperty('error');
  });

  it('大小：圖片 2 MB、短片 30 MB', () => {
    expect(precheckHomeMediaFile({ type: 'image/jpeg', size: 2 * 1024 * 1024 + 1 })).toHaveProperty('error');
    expect(precheckHomeMediaFile({ type: 'video/mp4', size: 30 * 1024 * 1024 })).toEqual({ kind: 'video' });
    expect(precheckHomeMediaFile({ type: 'video/mp4', size: 30 * 1024 * 1024 + 1 })).toHaveProperty('error');
  });
});

describe('schema 與遷移', () => {
  const ROOT = path.resolve(__dirname, '..');
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
  const block = (sql: string) => {
    const start = sql.indexOf('CREATE TABLE IF NOT EXISTS `home_media`');
    expect(start).toBeGreaterThan(-1);
    return sql.slice(start, sql.indexOf('ENGINE=InnoDB', start));
  };

  it('CREATE TABLE 一字不差、遷移只加表', () => {
    const migration = read('deploy/migrations/2026-10-23-home-media.sql');
    expect(block(migration)).toBe(block(read('deploy/schema.sql')));
    expect(migration).not.toMatch(/ALTER TABLE|DROP /);
  });
});
