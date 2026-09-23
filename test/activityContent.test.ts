import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { DocxBlock } from '../scripts/t2/docx';
import {
  ACTIVITY_CONTENT_MODULE,
  GUIDE_DOCX,
  HANDBOOK_DOCX,
  contentMismatches,
  parseGuideScripts,
  parseHandbook,
  readActivityContent,
  renderActivityContentModule,
} from '../scripts/t2/activityContent';
import { sameToolkitContent } from '../scripts/t2/extract';
import {
  CONTENT_BEGIN,
  CONTENT_END,
  CONTENT_MIGRATION,
  contentBlockOf,
  renderActivityContentSql,
} from '../scripts/t2/activityContentSql';
import { ACT300 } from '../src/t2/act300';
import { ACTIVITY_CONTENT } from '../src/t2/activityContent';
import { ACTIVITY_SEED, parseAgeRange } from '../src/t2/activitySeed';
import { GUIDE_PREP_KEYS } from '../src/t2/types';
import { readSteps } from '../src/utils/activitySteps';
import { readGuide } from '../src/utils/activityGuide';

/**
 * 活動內容的抽取（Keep 規格 K03，§4.1、§4.2、附錄「內容欄位對照」）。
 *
 * 【為什麼需要這些】
 * 300 張卡與 20 支腳本是**抽**出來的，不是抄的：客戶的手冊（`NEWT2/…总册.docx`）與模組一
 * 腳本（`NEWT2/…模组一_身体动一动.docx`）是從 `NEWT2/T2视频_20260923.zip` 原封不動取出來的
 * 兩份檔（位元組相同；zip 本身 27 MB、含 19 支 mp4，不進 git）。抽錯了不會有型別錯誤 ——
 * 「简单／难一点」切錯一半、步驟少一步、旁白混進拍攝提示，全部都是合法的字串。
 * 這裡把每一條讀法釘住（前半用造出來的小段落，錯誤的形狀要丟例外），再把兩份檔整批掃一次，
 * 最後兩條是地基：`src/t2/activityContent.ts` 與遷移檔的 UPDATE 都必須是腳本重跑的結果。
 */

const ROOT = path.resolve(__dirname, '..');

const p = (text: string): DocxBlock => ({ kind: 'p', text });
const table = (...rows: string[][]): DocxBlock => ({ kind: 'table', rows });

/** 手冊的一張卡，照客戶手冊的排法（標題列是一張 1×3 的表，小提醒是一張 2×1 的表）。 */
function card(no: string, over: { steps?: string[]; easierHarder?: string; need?: string } = {}): DocxBlock[] {
  return [
    table([`${no}　我们来爬行`, '6个月–3岁', '亲子']),
    p(`需要什么　${over.need ?? '一块干净的地板或垫子'}`),
    p('练什么　　练手脚交替的爬行动作，是走路和协调的基础。'),
    p('怎么玩'),
    ...(over.steps ?? ['1. 大人趴下来当示范，一起手膝着地。', '2. 让孩子爬过来拿。']),
    p(over.easierHarder ?? '简单／难一点　简单：爬 30 厘米就够；难一点：爬过整个房间，或绕个弯。'),
    table(['💡 小提醒　别急着让孩子跳过爬行去学走。'], ['📖 想深入练：物理治疗册 模组四（爬行与四点跪）']),
    p(''),
  ].map(b => (typeof b === 'string' ? p(b) : b));
}

describe('手冊的一張卡怎麼讀', () => {
  it('標籤拿掉、原文不動：需要什么／练什么／怎么玩／简单与难一点／小提醒／想深入练', () => {
    const [c] = parseHandbook([p('模组一　身体动一动'), ...card('001')], 1);
    expect(c).toEqual({
      no: 1,
      title: '我们来爬行',
      ageLabel: '6个月–3岁',
      people: '亲子',
      need: '一块干净的地板或垫子',
      trains: '练手脚交替的爬行动作，是走路和协调的基础。',
      steps: ['大人趴下来当示范，一起手膝着地。', '让孩子爬过来拿。'],
      easier: '爬 30 厘米就够',
      harder: '爬过整个房间，或绕个弯。',
      tip: '别急着让孩子跳过爬行去学走。',
      deeper: '物理治疗册 模组四（爬行与四点跪）',
    });
  });

  it('卡與卡之間的模組介紹、空段落不算內容', () => {
    const cards = parseHandbook(
      [...card('001'), p(''), p('模组二　平衡与协调'), p('活动 021–040　|　动作体能'), p('平衡不是站着不动。'), ...card('002')],
      2,
    );
    expect(cards.map(c => c.no)).toEqual([1, 2]);
  });

  it.each([
    ['少了「练什么」', () => card('001').filter(b => !(b.kind === 'p' && b.text.startsWith('练什么')))],
    ['步驟跳號', () => card('001', { steps: ['1. 一', '3. 三'] })],
    ['一步都沒有', () => card('001', { steps: [] })],
    ['「简单／难一点」少了難一點', () => card('001', { easierHarder: '简单／难一点　简单：爬 30 厘米就够。' })],
    ['「需要什么」後面是空的', () => card('001', { need: '' })],
  ])('形狀不對就丟例外，不靜靜略過：%s', (_, blocks) => {
    expect(() => parseHandbook(blocks(), 1)).toThrow();
  });

  it('卡的張數或編號不對就丟例外', () => {
    expect(() => parseHandbook(card('001'), 2)).toThrow();
    expect(() => parseHandbook([...card('001'), ...card('003')], 2)).toThrow();
  });
});

/** 模組一腳本的一支，照客戶腳本的排法。 */
function script(no: string, over: { intro?: string; say?: string } = {}): DocxBlock[] {
  return [
    table([`活动 ${no}　我们来爬行`, '影片长度 2–3 分钟'], ['适合年龄 6个月–3岁　｜　人物配置 亲子　｜　模组一 身体动一动 · 动作体能']),
    p('一、片头旁白（可直接念）'),
    table([over.intro ?? '「今天这个活动叫「我们来爬行」。」']),
    p('二、这个活动在练什么'),
    p('1. 爬行时左手和右脚一起往前，这叫「跨侧协调」。'),
    p('2. 手掌撑在地上承重。'),
    p('三、开拍前的准备'),
    p('场地　清出两到三米见方的地面。'),
    p('器材　一块干净的地板或垫子。'),
    p('安全检查　给孩子穿长裤保护膝盖。'),
    p('大人位置　大人趴在孩子正前方约一米处。'),
    p('四、分镜与操作步骤'),
    p('▎镜头一 · 大人示范姿势'),
    p(`旁白　${over.say ?? '「来，我们一起趴下来。」'}`),
    p('画面　拍大人四点跪的正确姿势'),
    p('▎镜头二 · 摆出目标'),
    p('旁白　「你看，小车车在这里。」'),
    p('画面　特写玩具放在孩子前方'),
    p('五、孩子可能的反应与应对'),
    p('如果　孩子趴着不动，只是看着你'),
    p('→ 把玩具挪到他手边一点点。'),
    p('六、大人最常做错的三件事'),
    p('1. 把玩具放太远。'),
    p('七、做不到就降一阶 · 太简单就升一阶'),
    p('降一阶　距离缩到 20–30 厘米。'),
    p('升一阶　爬过整个房间。'),
    p('八、怎么看出有进步'),
    p('✓ 一开始能爬多远？'),
    p('九、收尾旁白'),
    table(['「爬行本身就是很重要的训练。」']),
    p('十、拍摄提示'),
    p('▸ 主镜位放在孩子侧面。'),
    p(''),
  ];
}

describe('模組一腳本的一支怎麼讀', () => {
  it('標籤與逐字稿外層的「」拿掉，內層的「」照留；畫面描述與拍攝提示不抽', () => {
    const [s] = parseGuideScripts([p('脚本使用说明'), ...script('001')], 1);
    expect(s).toEqual({
      no: 1,
      title: '我们来爬行',
      ageLabel: '6个月–3岁',
      guide: {
        length: '2–3 分钟',
        intro: '今天这个活动叫「我们来爬行」。',
        principles: ['爬行时左手和右脚一起往前，这叫「跨侧协调」。', '手掌撑在地上承重。'],
        prep: {
          场地: '清出两到三米见方的地面。',
          器材: '一块干净的地板或垫子。',
          安全检查: '给孩子穿长裤保护膝盖。',
          大人位置: '大人趴在孩子正前方约一米处。',
        },
        shots: [
          { name: '大人示范姿势', say: '来，我们一起趴下来。' },
          { name: '摆出目标', say: '你看，小车车在这里。' },
        ],
        reactions: [{ if: '孩子趴着不动，只是看着你', then: '把玩具挪到他手边一点点。' }],
        mistakes: ['把玩具放太远。'],
        down: '距离缩到 20–30 厘米。',
        up: '爬过整个房间。',
        progress: ['一开始能爬多远？'],
        outro: '爬行本身就是很重要的训练。',
      },
    });
    const json = JSON.stringify(s);
    expect(json).not.toContain('四点跪的正确姿势');
    expect(json).not.toContain('主镜位');
  });

  it.each([
    ['旁白沒有被「」包住', () => script('001', { say: '来，我们一起趴下来。' })],
    ['外層的「」提早關掉（「甲」「乙」）', () => script('001', { intro: '「甲」「乙」' })],
    ['少了一段（沒有收尾旁白）', () => script('001').filter(b => !(b.kind === 'p' && b.text === '九、收尾旁白'))],
  ])('形狀不對就丟例外：%s', (_, blocks) => {
    expect(() => parseGuideScripts(blocks(), 1)).toThrow();
  });
});

describe('客戶的兩份 docx（NEWT2/）整批抽', () => {
  const { cards, scripts, entries } = readActivityContent(ROOT);

  it('手冊 300 張卡都抽得到，編號 001–300 依序', () => {
    expect(cards).toHaveLength(300);
    expect(cards.map(c => c.no)).toEqual(Array.from({ length: 300 }, (_, i) => i + 1));
  });

  it('每張卡的每一欄都有字、前後沒有空白；「怎么玩」4 或 5 步、不帶編號', () => {
    for (const c of cards) {
      for (const field of ['title', 'ageLabel', 'people', 'need', 'trains', 'easier', 'harder', 'tip', 'deeper'] as const) {
        expect(c[field], `${c.no} ${field}`).not.toBe('');
        expect(c[field], `${c.no} ${field}`).toBe(c[field].trim());
      }
      expect([4, 5], `${c.no} 的步數`).toContain(c.steps.length);
      for (const s of c.steps) expect(s, `${c.no}`).not.toMatch(/^\d+\.|^\s|\s$/);
    }
  });

  it('第 001 張逐字對得上手冊', () => {
    expect(cards[0]).toEqual({
      no: 1,
      title: '我们来爬行',
      ageLabel: '6个月–3岁',
      people: '亲子',
      need: '一块干净的地板或垫子',
      trains: '练手脚交替的爬行动作，是走路和协调的基础。',
      steps: ['大人趴下来当示范，一起手膝着地。', '在前方放个玩具或大人张手等他。', '让孩子爬过来拿。', '距离从很短开始，慢慢加长。'],
      easier: '爬 30 厘米就够',
      harder: '爬过整个房间，或绕个弯。',
      tip: '别急着让孩子跳过爬行去学走——爬得多的孩子，手臂力量和协调都更好。动作还不熟的孩子，大人可以用手掌抵住他的脚底给一点助力。',
      deeper: '物理治疗册 模组四（爬行与四点跪）',
    });
  });

  it('有 9 張卡是 5 步（004「学动物走路」是其一），最後一張是「全龄／收官」「全家」', () => {
    expect(cards.filter(c => c.steps.length === 5)).toHaveLength(9);
    expect(cards[3].steps[4]).toBe('每种走几步就换下一种。');
    expect(cards[299]).toMatchObject({ title: '一起长大的每一天', ageLabel: '全龄／收官', people: '全家' });
  });

  it('模組一腳本 20 支，對到 A001–A020；A021 以後沒有腳本', () => {
    expect(scripts.map(s => s.no)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    expect(entries.filter(e => e.guide !== null).map(e => e.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `A${String(i + 1).padStart(3, '0')}`),
    );
  });

  it('每支腳本：原理 8–9 條、準備四項照順序、分鏡 6 個、反應 3 則、常做錯 3 件、進步指標 3 條', () => {
    for (const { no, guide } of scripts) {
      expect([8, 9], `${no}`).toContain(guide.principles.length);
      expect(Object.keys(guide.prep), `${no}`).toEqual([...GUIDE_PREP_KEYS]);
      expect(guide.shots, `${no}`).toHaveLength(6);
      expect(guide.reactions, `${no}`).toHaveLength(3);
      expect(guide.mistakes, `${no}`).toHaveLength(3);
      expect(guide.progress, `${no}`).toHaveLength(3);
      for (const text of [guide.length, guide.intro, guide.down, guide.up, guide.outro]) expect(text).not.toBe('');
      // 逐字稿外層的「」拿掉了
      for (const text of [guide.intro, guide.outro, ...guide.shots.map(s => s.say)]) {
        expect(text, `${no}`).not.toMatch(/^「[\s\S]*」$/);
      }
    }
  });

  it('A001 的腳本逐字對得上', () => {
    const { guide } = scripts[0];
    expect(guide.length).toBe('2–3 分钟');
    expect(guide.intro).toBe(
      '今天这个活动叫「我们来爬行」。别小看爬这件事——它是走路、拿笔、甚至日后坐得住的共同基础。只要一块干净的地板，六个月到三岁的孩子都能玩。',
    );
    expect(guide.shots[0]).toEqual({ name: '大人示范姿势', say: '来，我们一起趴下来。手放在肩膀下面，膝盖放在屁股下面。' });
    expect(guide.reactions[1]).toEqual({
      if: '孩子用肚子贴地爬（匍匐前进）',
      then: '这是正常的过渡。可以用手掌轻轻托住他的肚子，帮他把身体撑起来几秒钟，让他感觉「肚子离地」是什么感觉。',
    });
    expect(guide.progress[0]).toBe('一开始能爬多远？记下来，一周后再量一次。');
  });

  // 「畫面描述」「拍攝提示」是給拍片的人看的（§4.2）。一句都不能混進家長端會讀到的東西。
  it('畫面描述與拍攝提示一句都沒有被抽進腳本', () => {
    const blocks = readActivityContent(ROOT).guideBlocks;
    const excluded = blocks
      .filter((b): b is { kind: 'p'; text: string } => b.kind === 'p' && /^(画面　|▸ )/.test(b.text))
      .map(b => b.text.replace(/^(画面　|▸ )/, ''));
    expect(excluded.length).toBeGreaterThanOrEqual(20 * 6 + 20 * 3); // 每支 6 個畫面描述、3 條以上拍攝提示
    const all = JSON.stringify(scripts.map(s => s.guide));
    for (const text of excluded) expect(all, text).not.toContain(text);
  });

  // 票 K03：標題與適齡跟 act300.ts 比，不一致的列出來 —— 不改任何一邊的原文。
  // 2026-09-23 抽的這一版兩份檔都與 act300 一致；日後客戶換檔、字變了，紅的是這一條，
  // 由人決定要照哪一邊（配對的硬閘 ageMonths 由適齡解析，見下一條）。
  it('標題與適齡跟 act300.ts 逐張一致（手冊 300 張、腳本 20 支）', () => {
    expect(contentMismatches(cards, scripts, ACT300)).toEqual([]);
  });

  it('不一致時會列出來：哪一支、哪一份、哪一欄、兩邊各寫什麼', () => {
    const changed = cards.map(c => (c.no === 7 ? { ...c, title: '走一直线', ageLabel: '2–6岁' } : c));
    expect(contentMismatches(changed, scripts, ACT300)).toEqual([
      { id: 'A007', source: 'handbook', field: 'title', act300: '走直线', found: '走一直线' },
      { id: 'A007', source: 'handbook', field: 'ageLabel', act300: '2–8岁', found: '2–6岁' },
    ]);
  });

  it('適齡原文解析出來的月齡 = 種子的硬閘（§4.1「age_min_month／age_max_month 照舊由它解析」）', () => {
    for (const [i, e] of entries.entries()) {
      expect(parseAgeRange(e.ageLabel), e.id).toEqual(ACTIVITY_SEED[i].ageMonths);
    }
  });

  it('每一欄都塞得進資料表的欄寬（VARCHAR 以字元計）', () => {
    for (const e of entries) {
      expect(e.ageLabel.length, e.id).toBeLessThanOrEqual(32);
      expect(e.people.length, e.id).toBeLessThanOrEqual(16);
      for (const field of ['trains', 'need', 'deeper'] as const) expect(e[field].length, `${e.id} ${field}`).toBeLessThanOrEqual(255);
    }
  });

  // 內容是要在後台改得動的：後台存檔走 readSteps／readGuide，客戶的原文必須原樣過得去，
  // 否則內容團隊改一個字就整支存不進去。
  it('手冊的步驟與腳本都過得了後台的檢查，而且過完一個字都沒變', () => {
    for (const e of entries) {
      const steps = readSteps(e.steps.map(instruction => ({ instruction })));
      expect(steps, e.id).toEqual({ ok: true, steps: e.steps.map(instruction => ({ imageUrl: null, instruction })) });
      if (e.guide) expect(readGuide(e.guide), e.id).toEqual({ ok: true, guide: e.guide });
    }
  });
});

describe('地基：src/t2/activityContent.ts 是腳本從 docx 重跑的結果', () => {
  it('兩份來源檔在 git 裡（不是只在某台機器的 zip 裡）', () => {
    for (const rel of [HANDBOOK_DOCX, GUIDE_DOCX]) expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
  });

  it('逐位元一致（只容忍 git 的 CRLF）', () => {
    const onDisk = fs.readFileSync(path.join(ROOT, ACTIVITY_CONTENT_MODULE), 'utf8');
    expect(
      sameToolkitContent(onDisk, renderActivityContentModule(ROOT)),
      `${ACTIVITY_CONTENT_MODULE} 與重跑結果不同 —— 重跑 npx tsx scripts/t2-extract-activity-content.ts`,
    ).toBe(true);
  });

  it('匯出的常數就是抽出來的那 300 支', () => {
    expect(ACTIVITY_CONTENT).toEqual(readActivityContent(ROOT).entries);
    expect(ACTIVITY_CONTENT.map(e => e.id)).toEqual(ACTIVITY_SEED.map(a => a.id));
  });
});

/**
 * 與 `deploy/migrate.mjs` 同一個切法：先拿掉 `--` 開頭的整行，再照分號切。
 * （那支腳本一載入就連資料庫，不能 import，這裡照抄它的兩行。）
 */
function statementsOf(sql: string): string[] {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(Boolean);
}

/** SQL 字串字面量 → 原字串（`str()` 的反向：兩個單引號是一個、反斜線跳脫）。 */
function unSql(literal: string): string {
  return literal.replace(/''/g, "'").replace(/\\(.)/g, '$1');
}

describe('地基：遷移檔的 UPDATE 是 ACTIVITY_CONTENT 印出來的', () => {
  const migration = fs.readFileSync(path.join(ROOT, CONTENT_MIGRATION), 'utf8');
  const block = contentBlockOf(migration);

  it('兩個標記之間 = renderActivityContentSql(ACTIVITY_CONTENT)', () => {
    expect(block, `遷移檔缺少 ${CONTENT_BEGIN}／${CONTENT_END}`).not.toBeNull();
    expect(block!.trim()).toBe(renderActivityContentSql(ACTIVITY_CONTENT).trim());
  });

  it('一支一句、依編號、只碰自己那一列；migrate.mjs 切得出 300 句、一句都沒被切壞', () => {
    const statements = statementsOf(block!);
    expect(statements).toHaveLength(300);
    statements.forEach((s, i) => {
      expect(s).toMatch(/^UPDATE `activities` SET\n/);
      expect(s.endsWith(`WHERE \`id\` = '${ACTIVITY_CONTENT[i].id}'`), s.slice(-40)).toBe(true);
    });
    expect(block).not.toMatch(/company/i);
  });

  // migrate.mjs --confirm 每次都把每一份遷移從頭跑一遍。後台填過的東西不能被原文蓋回去。
  it('重跑不蓋掉後台填過的：文字與腳本只填 NULL，步驟只填還是空陣列的', () => {
    const statements = statementsOf(block!);
    for (const s of statements) {
      for (const col of ['age_label', 'people', 'need', 'trains', 'easier', 'harder', 'tip', 'deeper']) {
        expect(s).toContain(`\`${col}\` = COALESCE(\`${col}\`, '`);
      }
      expect(s).toMatch(/`steps` = IF\(JSON_LENGTH\(`steps`\) = 0, CAST\('.*' AS JSON\), `steps`\)/);
      // 沒有哪一格是無條件覆寫的
      for (const line of s.split('\n').slice(1, -1)) expect(line).toMatch(/= (COALESCE|IF)\(/);
    }
    expect(statements.filter(s => s.includes('`guide` = COALESCE(`guide`, CAST('))).toHaveLength(20);
  });

  it('JSON 與字串的跳脫是對的：每一句寫進去的值讀回來就是 ACTIVITY_CONTENT 那一支', () => {
    const statements = statementsOf(block!);
    statements.forEach((s, i) => {
      const e = ACTIVITY_CONTENT[i];
      const tip = /`tip` = COALESCE\(`tip`, '((?:[^'\\]|''|\\.)*)'\)/.exec(s);
      expect(unSql(tip![1])).toBe(e.tip);
      const steps = /`steps` = IF\(JSON_LENGTH\(`steps`\) = 0, CAST\('((?:[^'\\]|''|\\.)*)' AS JSON\)/.exec(s);
      expect(JSON.parse(unSql(steps![1]))).toEqual(e.steps.map(instruction => ({ imageUrl: null, instruction })));
      const guide = /`guide` = COALESCE\(`guide`, CAST\('((?:[^'\\]|''|\\.)*)' AS JSON\)\)/.exec(s);
      expect(guide ? JSON.parse(unSql(guide[1])) : null).toEqual(e.guide);
    });
  });

  it('整份遷移：十一個加欄位各自先查再加、驗證句照 migrate.mjs 的命名約定', () => {
    const statements = statementsOf(migration);
    const alters = statements.filter(s => s.startsWith('SET @sql := IF(@has_col = 0, \'ALTER TABLE `activities` ADD COLUMN'));
    expect(alters).toHaveLength(11);
    expect(statements.filter(s => s === 'PREPARE stmt FROM @sql')).toHaveLength(11);
    const checks = statements.filter(s => /^SELECT/i.test(s));
    expect(checks.length).toBeGreaterThanOrEqual(4);
    for (const c of checks) expect(c).toMatch(/ AS \w+_(ok|gone)\b/);
    // 加欄位在 UPDATE 之前、驗證在最後
    const kinds = statements.map(s => (s.startsWith('UPDATE') ? 'U' : /^SELECT/i.test(s) ? 'S' : 'A'));
    expect(kinds.join('').replace(/A+U+S+/, '')).toBe('');
  });
});
