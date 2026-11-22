/**
 * 舊資料 → 服務關係（#123，ADR-0020「後果 → 遷移」）。**只在專案 A 跑。** 指令在 deploy/migrate-service-relations.mjs。
 *
 * 規則：
 * 1. 沒隸屬單位的推薦人（停用的也算）：每人建一個個人治療師單位（`companies.kind = 'therapist'`，名字＝推薦人名，
 *    代號 `therapist-r<推薦人編號>`），把推薦人掛上去。之後「推薦人必填單位」可以收緊（另開票，只加不刪）。
 * 2. 指名的合作公司（`--therapist-unit <編號>`，例：原本當成合作公司開的獨立治療師「杨智翔」）改類型為個人治療師。
 *    哪幾家是獨立治療師看資料猜不出來，所以要人指名。
 * 3. 家長（啟用中的帳號；#116 併掉的帳號已停用、不算）：
 *    - 綁了推薦人：那位推薦人與他的單位（就算帳號歸屬另一家公司）
 *    - 沒綁、帳號歸屬某家單位：那個單位、推薦人空
 *    - 未歸屬：沒有服務關係（森心康直屬）
 *    已經有服務關係的家長不動（可重跑）。每掛上一位寫一列改派紀錄（actor＝system、reason＝migration）。
 *
 * 預演（`execute: false`）只送 SELECT。每句查詢開頭 `/* tag *\/`，測試的假連線依 tag 回資料（同 deploy/userMerge.mjs）。
 * 寫入一律帶參數，不拼字串。
 */
import { maskPhone } from './userMerge.mjs';

/**
 * @typedef {{ id: number, name: string, slug: string, kind: string, active: boolean }} MigCompany
 * @typedef {{ id: number, name: string, companyId: number | null, active: boolean }} MigReferrer
 * @typedef {{ id: number, phone: string | null, companyId: number | null }} MigUser
 * @typedef {{ userId: number, referrerId: number }} MigBinding
 * @typedef {{ referrerId: number, name: string, slug: string }} UnitPlan
 * @typedef {{
 *   userId: number, phone: string | null, fromCompanyId: number | null, boundReferrerId: number | null,
 *   to: { companyId: number | null, referrerId: number | null } | null, pendingUnitFor?: number
 * }} RelationPlan
 */

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,63}$/;

/**
 * 要替哪些推薦人建單位。代號撞到已有的（含這一輪先排的）就接 `-2`、`-3`……
 * @param {MigReferrer[]} referrers @param {Array<{ slug: string }>} companies
 * @returns {UnitPlan[]}
 */
export function planReferrerUnits(referrers, companies) {
  const taken = new Set(companies.map(c => c.slug));
  /** @type {UnitPlan[]} */
  const out = [];
  for (const r of [...referrers].sort((a, b) => a.id - b.id)) {
    if (r.companyId !== null) continue;
    const base = `therapist-r${r.id}`;
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    if (!SLUG_PATTERN.test(slug)) throw new Error(`单位代号不合格式：${slug}`);
    taken.add(slug);
    out.push({ referrerId: r.id, name: r.name, slug });
  }
  return out;
}

/**
 * 每位還沒有服務關係的家長要掛到哪裡（`to: null`＝沒有服務關係）。
 * 綁的推薦人還沒有單位時 `to.companyId` 是 null、`pendingUnitFor` 是那位推薦人（執行時先建單位、重讀再排一次）。
 * @param {{ users: MigUser[], bindings: MigBinding[], referrers: MigReferrer[], existing: Set<number> }} input
 * @returns {RelationPlan[]}
 */
export function planServiceRelations({ users, bindings, referrers, existing }) {
  const bindingOf = new Map(bindings.map(b => [b.userId, b.referrerId]));
  const referrerOf = new Map(referrers.map(r => [r.id, r]));
  /** @type {RelationPlan[]} */
  const out = [];
  for (const u of [...users].sort((a, b) => a.id - b.id)) {
    if (existing.has(u.id)) continue;
    const boundReferrerId = bindingOf.get(u.id) ?? null;
    const referrer = boundReferrerId === null ? undefined : referrerOf.get(boundReferrerId);
    /** @type {RelationPlan} */
    const base = { userId: u.id, phone: u.phone, fromCompanyId: u.companyId, boundReferrerId };
    if (referrer) {
      out.push(
        referrer.companyId === null
          ? { ...base, to: { companyId: null, referrerId: referrer.id }, pendingUnitFor: referrer.id }
          : { ...base, to: { companyId: referrer.companyId, referrerId: referrer.id } }
      );
    } else if (u.companyId !== null) {
      out.push({ ...base, to: { companyId: u.companyId, referrerId: null } });
    } else {
      out.push({ ...base, to: null });
    }
  }
  return out;
}

/** @param {any} conn @param {string} sql @param {any[]} [params] */
async function rows(conn, sql, params) {
  const [r] = await conn.query(sql, params);
  return Array.isArray(r) ? r : [];
}

/** @param {any} conn @returns {Promise<MigReferrer[]>} */
async function loadReferrers(conn) {
  return (await rows(conn, '/* referrers */ SELECT id, name, company_id, active FROM referrers ORDER BY id')).map(r => ({
    id: Number(r.id),
    name: String(r.name),
    companyId: r.company_id === null || r.company_id === undefined ? null : Number(r.company_id),
    active: Number(r.active) === 1,
  }));
}

/** @param {any} conn */
async function loadAll(conn) {
  const companies = (await rows(conn, '/* companies */ SELECT id, name, slug, kind, active FROM companies ORDER BY id')).map(c => ({
    id: Number(c.id),
    name: String(c.name),
    slug: String(c.slug),
    kind: String(c.kind ?? 'institution'),
    active: Number(c.active) === 1,
  }));
  const referrers = await loadReferrers(conn);
  const users = (await rows(conn, '/* users */ SELECT id, phone, company_id FROM users WHERE disabled_at IS NULL ORDER BY id')).map(u => ({
    id: Number(u.id),
    phone: u.phone ?? null,
    companyId: u.company_id === null || u.company_id === undefined ? null : Number(u.company_id),
  }));
  const bindings = (await rows(conn, '/* bindings */ SELECT user_id, referrer_id FROM referrer_bindings')).map(b => ({
    userId: Number(b.user_id),
    referrerId: Number(b.referrer_id),
  }));
  const existing = new Set((await rows(conn, '/* relations */ SELECT user_id FROM service_relations')).map(r => Number(r.user_id)));
  return { companies, referrers, users, bindings, existing };
}

/**
 * 一位家長一行：原歸屬、原推薦人 → 新單位 · 新推薦人。
 * @param {RelationPlan} p @param {Map<number, string>} companyName @param {Map<number, string>} referrerName
 */
function formatLine(p, companyName, referrerName) {
  const from = `归属 ${p.fromCompanyId === null ? '未归属' : companyName.get(p.fromCompanyId) ?? `#${p.fromCompanyId}`}　推荐人 ${
    p.boundReferrerId === null ? '—' : referrerName.get(p.boundReferrerId) ?? `#${p.boundReferrerId}`
  }`;
  let to;
  if (p.to === null) to = '没有服务关系（森心康直属）';
  else {
    const unit =
      p.pendingUnitFor !== undefined
        ? `（新建）${referrerName.get(p.pendingUnitFor) ?? `#${p.pendingUnitFor}`}`
        : companyName.get(/** @type {number} */ (p.to.companyId)) ?? `#${p.to.companyId}`;
    to = `${unit} · ${p.to.referrerId === null ? '还没标注' : referrerName.get(p.to.referrerId) ?? `#${p.to.referrerId}`}`;
  }
  return `#${p.userId} ${p.phone ? maskPhone(p.phone) : '（无手机号）'}　${from}　→ ${to}`;
}

/**
 * 整支流程。`execute: false`（預演）只送 SELECT。
 * @param {any} conn
 * @param {{ execute: boolean, log: (line: string) => void, therapistUnitIds: number[] }} opts
 * @returns {Promise<{ unitsCreated: number, therapistUnits: number, attached: number, direct: number, skippedExisting: number, planned: number }>}
 */
export async function runServiceRelationsMigration(conn, { execute, log, therapistUnitIds }) {
  const data = await loadAll(conn);
  const companyName = new Map(data.companies.map(c => [c.id, c.name]));
  const referrerName = new Map(data.referrers.map(r => [r.id, r.name]));

  // 指名改類型的單位都要在（打錯編號就整支停，什麼都不寫）。
  for (const id of therapistUnitIds) {
    if (!companyName.has(id)) throw new Error(`找不到要改为个人治疗师的合作单位 #${id}`);
  }
  const toConvert = data.companies.filter(c => therapistUnitIds.includes(c.id) && c.kind !== 'therapist');
  for (const c of toConvert) {
    const count = data.referrers.filter(r => r.companyId === c.id && r.active).length;
    log(`合作单位「${c.name}」(#${c.id}) 改为个人治疗师${count === 1 ? '' : `（⚠️ 现在有 ${count} 位启用中的推荐人，个人治疗师应该恰好一位）`}`);
  }

  const units = planReferrerUnits(data.referrers, data.companies);
  for (const u of units) log(`推荐人「${u.name}」(#${u.referrerId}) 没有单位：建个人治疗师单位（代号 ${u.slug}）`);

  const plan = planServiceRelations(data);
  for (const p of plan) log(formatLine(p, companyName, referrerName));
  const direct = plan.filter(p => p.to === null).length;
  const planned = plan.length - direct;
  log('');
  log(`要挂上 ${planned} 位、森心康直属 ${direct} 位、已经有服务关系不动 ${data.existing.size} 位。`);

  const result = { unitsCreated: 0, therapistUnits: 0, attached: 0, direct, skippedExisting: data.existing.size, planned };
  if (!execute) return result;

  for (const c of toConvert) {
    const [r] = await conn.query("UPDATE companies SET kind = 'therapist' WHERE id = ? AND kind <> 'therapist'", [c.id]);
    result.therapistUnits += Number(r?.affectedRows) || 0;
  }

  for (const u of units) {
    await conn.beginTransaction();
    try {
      const [ins] = await conn.query("INSERT INTO companies (name, slug, kind) VALUES (?, ?, 'therapist')", [u.name, u.slug]);
      const [upd] = await conn.query('UPDATE referrers SET company_id = ? WHERE id = ? AND company_id IS NULL', [Number(ins.insertId), u.referrerId]);
      // 預演之後有人替他設了單位：這個單位不建。
      if ((Number(upd?.affectedRows) || 0) !== 1) {
        await conn.rollback();
        continue;
      }
      await conn.commit();
      result.unitsCreated++;
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  // 建好單位之後重讀推薦人再排一次：綁到沒單位推薦人的家長，現在有單位編號了。
  const finalPlan = planServiceRelations({ ...data, referrers: await loadReferrers(conn) });
  for (const p of finalPlan) {
    if (p.to === null || p.to.companyId === null) continue;
    await conn.beginTransaction();
    try {
      const [ins] = await conn.query('INSERT IGNORE INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?)', [
        p.userId,
        p.to.companyId,
        p.to.referrerId,
      ]);
      // 已經有了（預演之後家長自己點連結掛上了）：不覆蓋、不寫紀錄。
      if ((Number(ins?.affectedRows) || 0) === 1) {
        await conn.query(
          "INSERT INTO service_relation_changes (user_id, to_company_id, to_referrer_id, actor, reason) VALUES (?, ?, ?, 'system', 'migration')",
          [p.userId, p.to.companyId, p.to.referrerId]
        );
        result.attached++;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    }
  }

  const [left] = await rows(conn, '/* referrers_without_unit */ SELECT COUNT(*) AS n FROM referrers WHERE company_id IS NULL');
  log(`建了 ${result.unitsCreated} 个单位、改类型 ${result.therapistUnits} 个、挂上 ${result.attached} 位。还没有单位的推荐人：${Number(left?.n) || 0} 位。`);
  return result;
}
