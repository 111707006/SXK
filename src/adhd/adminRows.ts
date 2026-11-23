/**
 * 成人 ADHD 後台：列表與導出的一行（設計第 2.3、5 節）。一筆評估一行。
 *
 * 導出的數字**直接讀存下的那份個案 JSON**（客戶頁面 `APP.d.s2.summary` 算好的），不重算；讀不到的格子留空。
 * 前後端共用（列表的型別；導出的欄位只有伺服器用）。
 */

export const ADHD_PAGE_SIZE = 100;

export interface AdhdAdminListItem {
  id: number;
  userId: number;
  subjectName: string;
  phone: string | null;
  companyName: string | null;
  conclusionStatus: string;
  conclusionTitle: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdhdAdminPage {
  rows: AdhdAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/** 九個面向（客戶頁面 `DOMAINS` 的 key 與短名，依頁面順序）。 */
export const OBS_DOMAIN_COLUMNS: readonly { key: string; name: string }[] = [
  { key: 'att', name: '注意容易分散' },
  { key: 'ini', name: '事情难开始' },
  { key: 'org', name: '安排与排序' },
  { key: 'wm', name: '记事与时间感' },
  { key: 'mot', name: '持续投入与完成' },
  { key: 'hyp', name: '坐不住／小动作' },
  { key: 'imp', name: '冲动与打断' },
  { key: 'noi', name: '脑中思绪不停' },
  { key: 'emo', name: '情绪起伏／易生气' },
];

export const EXPORT_HEADER: readonly string[] = [
  '姓名', '电话', '单位', '评估日期', '年龄', '性别', '用药状态', '主要结论',
  'ADHD筛查 达标（/6）', 'ADHD量表 注意（/9）', 'ADHD量表 多动冲动（/9）',
  '症状量表 填写来源', '症状量表 明显／严重（/30）',
  ...OBS_DOMAIN_COLUMNS.map(d => `${d.name}（明显／严重）`),
  '三项资料有提示（/3）', '想改善的事（件）',
];

const obj = (v: unknown): Record<string, any> | null => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, any>) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** 一份個案 JSON → 導出那一行從「年龄」之後的欄位（姓名、電話、單位、日期由呼叫端給）。 */
export function exportCellsOf(payload: unknown): (string | number | null)[] {
  const p = obj(payload);
  const basics = obj(p?.basics);
  const s2 = obj(obj(p?.data)?.s2);
  const sum = obj(s2?.summary);
  const asrs6 = obj(sum?.asrs6);
  const asrs18 = obj(sum?.asrs18);
  const obs = obj(sum?.obs30);
  const domains = (Array.isArray(obs?.domains) ? obs!.domains.map(obj) : []).filter((d: Record<string, any> | null): d is Record<string, any> => d !== null);
  const conv = obj(sum?.convergence);
  const copm = obj(sum?.copm);

  const obsSource = !obs
    ? ''
    : obs.mode === 'observer'
      ? `知情人${str(obs.relation) ? `（${str(obs.relation)}）` : ''}`
      : obs.mode === 'self'
        ? '本人'
        : '';
  const obsTotal = domains.length ? domains.reduce((n, d) => n + (num(d.notableCount) ?? 0), 0) : null;
  const domainCell = (key: string) => {
    const d = domains.find(x => x.key === key);
    const n = num(d?.notableCount);
    const of = num(d?.itemCount);
    return n === null || of === null ? null : `${n}/${of}`;
  };

  return [
    str(basics?.age) || str(basics?.ageYears),
    str(basics?.sex),
    str(basics?.med),
    str(obj(s2?.conclusion)?.title),
    num(asrs6?.shadedCount),
    num(asrs18?.frequentAttention),
    num(asrs18?.frequentHyperactiveImpulsive),
    obsSource,
    obsTotal,
    ...OBS_DOMAIN_COLUMNS.map(d => domainCell(d.key)),
    num(conv?.hits),
    num(copm?.completeCount),
  ];
}
