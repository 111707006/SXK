import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 線上干預新畫面（`src/components/training/`，Keep 規格 K11、K12）的結構護欄。專案沒有 jsdom，
 * 畫面上出現什麼只能讀原始碼。頁面堆疊與返回鍵的行為在 `test/trainingLayerStack.test.ts`（假歷史），
 * 資料整形在 `test/trainingData.test.ts`，句子在 `test/trainingCopy.test.ts`。
 *
 * 這裡釘的是「畫面照搬樣品，資料與狀態重寫」那一句的後半：
 * 1. 字在 `trainingCopy.ts`，畫面裡沒有手寫的中文（K16）。
 * 2. 資料來自 API 與報告快照，不 import 樣品、不帶樣品的配圖與影片、沒有 toast 佔位按鈕（§1 不做）。
 * 3. 只有 `layerStack.ts` 碰 `history`：各頁一律經 `nav`，返回鍵與畫面上的 ‹ 才會是同一個出口。
 */

const ROOT = path.resolve(__dirname, '..');
const DIR = 'src/components/training';
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const files = fs
  .readdirSync(path.join(ROOT, DIR))
  .filter(f => /\.tsx?$/.test(f))
  .map(f => ({ name: f, source: stripComments(read(`${DIR}/${f}`)) }));

describe('字在 trainingCopy.ts', () => {
  it.each(files.map(f => [f.name, f.source]))('%s 沒有手寫的中文字（標點可以）', (_name, source) => {
    const hits = source.match(/[一-鿿]+/g) ?? [];
    expect(hits).toEqual([]);
  });
});

describe('資料與狀態重寫，不搬樣品', () => {
  const all = files.map(f => f.source).join('\n');

  it('不 import 樣品的任何一檔、不帶樣品的圖與影片', () => {
    expect(all).not.toMatch(/prototype/);
    expect(all).not.toMatch(/\.(mp4|jpe?g|png|webp)['"]/);
    expect(all).not.toMatch(/plan-card|hero-poster|cover-|faq-portrait|poster-0/);
  });

  it('沒有 toast 佔位（想练、一起练、分享、更多、筛选都不做）', () => {
    expect(all).not.toMatch(/toast/i);
    expect(all).not.toMatch(/Share2|Ellipsis|Filter\b|ListPlus/);
  });

  it('每週活動與打卡從 API 來；畫面不配對、不重算週次', () => {
    const data = stripComments(read(`${DIR}/useTrainingData.ts`));
    expect(data).toContain('/api/t2/weekly-plan');
    expect(data).toContain('/api/t2/checkins?from=');
    expect(data).toContain('weekPractice(');
    expect(all).not.toContain('matchWeeklyActivities');
    expect(all).not.toContain('planPosition(');
  });

  it('評估結果走報告快照（gridDimensions → dimensionStatus），不自己寫三級的字', () => {
    const data = stripComments(read(`${DIR}/trainingData.ts`));
    expect(data).toContain('gridDimensions(findings)');
    expect(data).toContain('dimensionStatus(d, ageMonth)');
    // 沒有判定的顏色照 tone（v2.1 S02：沒做的帶 T1 紅／黃），與報告九宮格同一個出口
    expect(stripComments(read(`${DIR}/PlanScreen.tsx`))).toContain("STATUS_TEXT[s.kind === 'band' ? s.status : s.tone]");
  });

  it('圖與片只來自活動庫的欄位（posterUrl、步驟的 imageUrl、示範片 videoUrl → clip）', () => {
    const srcs = all.match(/src=\{[^}]+\}/g) ?? [];
    for (const s of srcs) {
      expect(s, s).toMatch(/src=\{(src|photo|clip|loaded \? clip : undefined|a\.posterUrl|activity\.posterUrl|step\.imageUrl|s\.imageUrl)\}/);
    }
    // clip 只從活動的 videoUrl 來
    for (const f of files.filter(x => /\bclip\b/.test(x.source) && /<video/.test(x.source))) {
      expect(f.source, f.name).toMatch(/const clip = hasClip\(a\) \? a\.videoUrl : null;/);
    }
  });
});

describe('導覽只經過 layerStack', () => {
  it.each(files.filter(f => f.name !== 'layerStack.ts').map(f => [f.name, f.source]))('%s 不直接碰 history', (_name, source) => {
    expect(source).not.toMatch(/\bhistory\./);
    expect(source).not.toMatch(/popstate/);
  });

  it('T2Report 只掛 TrainingSection（入口＋蓋在上面的幾層）', () => {
    const report = stripComments(read('src/components/T2Report.tsx'));
    expect(report).toContain("import TrainingSection from './training/TrainingSection'");
    expect(report).not.toContain('T2WeeklyPlan');
    expect(fs.existsSync(path.join(ROOT, 'src/components/T2WeeklyPlan.tsx'))).toBe(false);
  });
});

describe('規格點名的幾件事在畫面上', () => {
  const entry = stripComments(read(`${DIR}/ReportEntry.tsx`));
  const plan = stripComments(read(`${DIR}/PlanScreen.tsx`));

  it('沒有示範片的活動標「示范片制作中 · 先看图文」', () => {
    expect(entry).toMatch(/hasClip\(activity\) \? CLIP_STATE\.has : CLIP_STATE\.none/);
  });

  it('換著玩走 alternateRows（舊週次沒有 alternates 就是空的，不出）', () => {
    expect(entry).toContain('alternateRows(plan)');
  });

  it('片庫、打卡日曆（票 8）的入口是「即将开放」，點不動', () => {
    expect(entry).toMatch(/<TabWord label=\{ENTRY\.tabs\.library\} disabled \/>/);
    expect(entry).toMatch(/<TabWord label=\{ENTRY\.tabs\.calendar\} disabled \/>/);
    expect(entry).not.toMatch(/openPage\(\{ name: '(library|calendar)' \}\)/);
  });

  it('計劃頁的第幾週與「已满 12 周」走 planWeekLabel，12 週的格子走 planGrid', () => {
    expect(plan).toContain('planWeekLabel(position)');
    expect(plan).toContain('planGrid(firstWeekStart)');
  });

  it('打卡讀不出來時不寫 0 次：次數與 x/4 都要先確定 practice 存在', () => {
    expect(entry).toMatch(/practice \? practicedTimes\(/);
    expect(entry).toMatch(/practice \? practice\.sessions : null/);
    expect(plan).toMatch(/\{practice && \(/);
  });

  it('入口的活動卡：「练什么」與「本周已练 N 次」分兩行，不接成「。 · 」（票 7 順手修）', () => {
    expect(entry).not.toMatch(/trains[^\n]*\.join\(' · '\)/);
    expect(entry).toMatch(/\{activity\.trains && \(/);
    expect(entry).toMatch(/\{practiced && \(/);
  });
});

describe('票 7：詳情、播放器、打卡成功、抽屜', () => {
  const src = (name: string) => files.find(f => f.name === name)?.source ?? '';
  const detail = src('DetailScreen.tsx');
  const player = src('PlayerScreen.tsx');
  const checkin = src('CheckinScreen.tsx');
  const reminder = src('ReminderSheet.tsx');
  const sheets = src('DetailSheets.tsx');
  const overlay = src('TrainingOverlay.tsx');

  it('簡單版詳情已經換掉', () => {
    expect(fs.existsSync(path.join(ROOT, DIR, 'SimpleDetailScreen.tsx'))).toBe(false);
    expect(overlay).toMatch(/case 'detail':\s*return <DetailScreen /);
  });

  it('示範片三種行內播放的寫法都加、只先載 metadata（詳情的大圖與播放器）', () => {
    for (const [name, source] of [['DetailScreen', detail], ['PlayerScreen', player]]) {
      expect(source, name).toContain('playsInline');
      expect(source, name).toContain('webkit-playsinline="true"');
      expect(source, name).toContain('x5-playsinline="true"');
      expect(source, name).toContain('preload="metadata"');
    }
  });

  it('詳情的大圖進入畫面、而且這一頁在最上面時才給片子 src（§6.3）', () => {
    expect(detail).toContain('IntersectionObserver');
    expect(detail).toContain('const playing = inView && active;');
    expect(detail).toContain('src={loaded ? clip : undefined}');
    expect(overlay).toContain('<PageContent route={layer.route} active={!hidden} />');
  });

  it('播放器：先試帶聲音播 → 擋就靜音播 → 再擋就等家長點', () => {
    expect(player).toMatch(/v\.muted = false;\s*v\.play\(\)\.catch\(\(\) => \{\s*v\.muted = true;\s*setMuted\(true\);\s*v\.play\(\)\.catch\(\(\) => setNeedsTap\(true\)\);/);
  });

  it('沒有示範片、或選了只看圖文 → 圖文模式', () => {
    expect(player).toContain("mode === 'video' && clip ? <PlayerLoop");
    expect(detail).toContain('followModeFor(readFollowMode(), clip !== null)');
  });

  it('做完了打卡：POST → 重讀打卡 → 打卡成功取代播放器（不多一格歷史）', () => {
    expect(player).toMatch(/await postCheckin\(activity\.id\);\s*void data\.reloadCheckins\(\);\s*nav\.replacePage\(\{\s*name: 'checkin'/);
  });

  it('打卡成功：「回到计划」走 returnToPage；說明句是「会记在打卡日历里」', () => {
    expect(checkin).toContain("nav.returnToPage({ name: 'plan' })");
    expect(checkin).toContain('CHECKIN.optional');
    expect(checkin).toContain('patchCheckin(checkinId, patch)');
  });

  it('只有有腳本的活動才出腳本那幾區（開場白、原理、卡住了、常做錯、邊做邊說、進步）', () => {
    expect(detail).toContain('{guide?.intro && ');
    expect(detail).toContain('{guide && guide.reactions.length > 0 && (');
    expect(detail).toContain('{guide && guide.mistakes.length > 0 && (');
    expect(player).toContain("const shots = activity.guide?.shots.filter(s => s.say) ?? [];");
    expect(checkin).toContain('const progressItems = activity?.guide?.progress ?? [];');
  });

  it('.ics：換短時效連結再用 location.href 開，不做 blob；微信裡改說明', () => {
    expect(reminder).toContain('window.location.href = await fetchIcsLink();');
    expect(reminder).not.toMatch(/createObjectURL|new Blob/);
    expect(reminder).toContain('isWeChatBrowser(navigator.userAgent)');
  });

  it('動作列表裡按 GO：抽屜換成播放器（replacePage），不是關抽屜再推一層', () => {
    expect(sheets).toMatch(/const go = \(\) => nav\.replacePage\(\{ name: 'go'/);
  });

  it('跟練方式存在這支手機上（localStorage），不上伺服器', () => {
    expect(sheets).toContain('writeFollowMode(browserStorage, mode)');
    expect(sheets).not.toContain('practice-prefs');
  });

  it('打卡日曆（票 8）之前，「练过 N」與「看打卡日历」落在「即将开放」', () => {
    expect(overlay).toMatch(/case 'calendar':\s*return <ComingSoonScreen \/>;/);
    expect(detail).toContain("nav.openPage({ name: 'calendar' })");
    expect(checkin).toContain("nav.openPage({ name: 'calendar' })");
  });
});
