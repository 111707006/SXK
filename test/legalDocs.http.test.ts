import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';

/**
 * 後台可編輯的條款（客戶 11/03 第 14 頁，開關 `LEGAL_DOCS`）：全域管理員存 Markdown、家長端公開端點讀。
 *
 * 要抓的錯：合作公司改得了條款、空白或認不得的那一份存進去、前端送的日期被採信、沒存過的那一份回了東西
 * （家長端就不會退回內建條款）。
 */

vi.mock('../src/admin/adminStore', async () => {
  const bcrypt = (await import('bcryptjs')).default;
  const hash = (pw: string) => bcrypt.hashSync(pw, 4);
  const admins = [
    { id: 30, email: 'god@sxk.com', role: 'global_admin' as const, companyId: null, active: true, createdAt: null, passwordHash: hash('pw-god-123') },
    { id: 10, email: 'a@jia.com', role: 'company_member' as const, companyId: 1, active: true, createdAt: null, passwordHash: hash('pw-jia-123') },
  ];
  return {
    isAvailable: () => true,
    async findAdminUserByEmail(email: string) {
      return admins.find(a => a.email === email) ?? null;
    },
    async findAdminUserById(id: number) {
      return admins.find(a => a.id === id) ?? null;
    },
    async listCompanies() {
      return [];
    },
  };
});

vi.mock('../src/db/legalDocs', () => {
  const db = { rows: new Map<string, { markdown: string; updatedAt: string; by: number | null }>() };
  return {
    __db: db,
    async loadLegalDocs() {
      const one = (k: string) => {
        const r = db.rows.get(k);
        return r ? { markdown: r.markdown, updatedAt: r.updatedAt } : null;
      };
      return { service: one('service'), privacy: one('privacy') };
    },
    async saveLegalDoc(key: string, markdown: string, by: number | null) {
      const updatedAt = new Date().toISOString();
      db.rows.set(key, { markdown, updatedAt, by });
      return { markdown, updatedAt };
    },
  };
});

process.env.LEGAL_DOCS = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-legal-docs';

let client: TestClient;
let db: any;

async function login(email: string, password: string): Promise<string> {
  const resp = await client.postJson('/api/admin/login', { email, password });
  expect(resp.status).toBe(200);
  return (await resp.json()).token;
}

function put(doc: string, body: unknown, token?: string) {
  return client.request(`/api/admin/legal/${doc}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  db = ((await import('../src/db/legalDocs')) as any).__db;
});

beforeEach(() => db.rows.clear());

afterAll(async () => {
  await client.close();
});

describe('誰改得了', () => {
  it('未登入 401、合作公司 403，什麼都沒存', async () => {
    expect((await put('service', { markdown: '## 一\n内容' })).status).toBe(401);
    const member = await login('a@jia.com', 'pw-jia-123');
    expect((await put('service', { markdown: '## 一\n内容' }, member)).status).toBe(403);
    expect((await client.get('/api/admin/legal', { Authorization: `Bearer ${member}` })).status).toBe(403);
    expect(db.rows.size).toBe(0);
  });
});

describe('存檔與讀回', () => {
  it('沒存過：公開端點兩份都是 null（家長端畫內建條款）', async () => {
    const resp = await client.get('/api/legal');
    expect(resp.status).toBe(200);
    expect(await resp.json()).toEqual({ service: null, privacy: null });
  });

  it('存一份：去頭尾空白、記下是誰、日期由伺服器填（不採信前端的），公開端點讀得到、另一份仍是 null', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    const resp = await put('privacy', { markdown: '  ## 一、总则\n**重要**内容\n', updatedAt: '2000-01-01T00:00:00Z' }, token);
    expect(resp.status).toBe(200);
    const { doc } = await resp.json();
    expect(doc.markdown).toBe('## 一、总则\n**重要**内容');
    expect(Date.parse(doc.updatedAt)).toBeGreaterThan(Date.parse('2026-01-01'));
    expect(db.rows.get('privacy').by).toBe(30);

    const pub = await (await client.get('/api/legal')).json();
    expect(pub.privacy.markdown).toBe('## 一、总则\n**重要**内容');
    expect(pub.service).toBeNull();
    const admin = await (await client.get('/api/admin/legal', { Authorization: `Bearer ${token}` })).json();
    expect(admin.privacy.updatedAt).toBe(doc.updatedAt);
  });

  it('空白、只有標記、不是字串、太長、控制字元 400；認不得的那一份 404', async () => {
    const token = await login('god@sxk.com', 'pw-god-123');
    for (const bad of ['', '   ', '## \n- ', 123, null, 'a'.repeat(30001), 'a\u0000b']) {
      expect((await put('service', { markdown: bad }, token)).status, JSON.stringify(bad).slice(0, 20)).toBe(400);
    }
    expect((await put('cookies', { markdown: '内容' }, token)).status).toBe(404);
    expect(db.rows.size).toBe(0);
  });
});
