/**
 * 量表详解的家長端字（量表详解規格 §4、§5）：量表給家長看的名稱與一句說明、作答種類、面向狀態的白話、總覽句。
 * 這一檔在家長用字掃描裡；客戶的面向說明與練法不在這裡（題庫 `texts` 原文 → `kitv3/textAdapt.ts` 改寫）。
 *
 * 不寫常模、不寫「相当于几岁」、不寫題目的起始月齡（規格 D2、待問 S-1）。
 */

/** 量表給家長看的名稱與「這份在看什麼」一句。名稱含禁字的換白話名（規格 D5、待問 S-3）。 */
export const SCALE_DISPLAY: Readonly<Record<string, { name: string; oneLiner: string }>> = {
  'SXK-GM': { name: '粗大动作发展问卷', oneLiner: '看孩子用大肌肉做的动作：从抬头、翻身、坐、爬、走，到跑跳与平衡。' },
  'SXK-SOC': { name: '社会能力发展问卷', oneLiner: '看孩子和人互动的能力：注意别人、轮流、分享、跟同伴玩，到理解规则与别人的感受。' },
  'SXK-ADP': { name: '适应能力发展问卷', oneLiner: '看孩子认识周围、解决小问题、记住与学习新东西的能力。' },
  'SXK-PLC': { name: '语言前能力发展问卷', oneLiner: '看孩子开口说话以前的沟通基础：看人、听声音、用手势和声音表达、轮流互动。' },
  'SXK-LANG': { name: '语言能力发展问卷', oneLiner: '看孩子听懂、表达、发音与用语言和人沟通的能力。' },
  'SXK-VOC': { name: '0–3 岁词汇与沟通问卷', oneLiner: '看孩子听懂与说出的词、手势与句子，是不是一步一步在增加。' },
  'SXK-ASQ3': { name: '分龄发育综合问卷', oneLiner: '用这个月龄的一组题，一次看沟通、粗大动作、精细动作、解决问题与个人社交五个方面。' },
  // ── 頻率族（D-4）。「自闭行为量表」「社交沟通行为量表」照原名會讓家長以為在判定；換成講它看什麼（待問 S-3）。
  'SXK-ASB': { name: '社交与行为观察问卷', oneLiner: '看孩子在感觉反应、和人相处、身体动作、语言沟通、自理与适应上，有哪些行为比较常出现。' },
  'SXK-ASR': { name: '社交沟通表现问卷', oneLiner: '看孩子和人互动、沟通、玩的方式，以及兴趣与情绪，和同龄孩子比起来像不像。' },
  'SXK-AB': { name: '注意力与行为观察问卷', oneLiner: '看孩子专注、分心、冲动、活动量、做事的组织与情绪，在日常里出现得多不多。' },
  'SXK-ATT': { name: '注意力情境问卷', oneLiner: '看孩子在课堂、写作业、在家、外出等不同情境里，专注与活动量的样子。' },
  'SNAP-IV': { name: 'SNAP-IV 注意力问卷', oneLiner: '看孩子在专注、活动量与冲动、配合与情绪三方面的表现，最近一周出现得多不多。' },
  'CHEXI': { name: '儿童执行功能问卷', oneLiner: '看孩子记住指令、规划步骤、调节自己与停下来的能力。' },
  'SXK-LDP': { name: '学习能力问卷（小学）', oneLiner: '看孩子在识字、阅读理解、书写、数学、语言与专注上，学习时哪里比较吃力。' },
  'SXK-LDS': { name: '学习能力问卷（中学）', oneLiner: '看孩子在识字、阅读理解、书写、数学、语言与学习组织上，哪里比较吃力。' },
  'SXK-SP': { name: '感觉处理问卷', oneLiner: '看孩子对声音、光线、触碰、动作、味道等感觉的反应，以及这些反应对日常的影响。' },
  'SXK-SPb': { name: '感觉处理问卷（学龄）', oneLiner: '看孩子对声音、光线、触碰、动作、味道等感觉的反应，以及这些反应对上学与日常的影响。' },
  'SXK-ADL': { name: '生活自理问卷', oneLiner: '看孩子吃饭、穿衣、如厕、洗漱、移动与日常照顾自己的事，能自己做到多少。' },
};

/** 面向名稱踩禁字的換一個講法（24 支裡只有這一個；`t2ScaleDetail.test.ts` 掃全部面向名稱）。 */
export const FACET_NAME_ALIAS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'SNAP-IV': { IA: '专注与注意力' },
};

/** 達成率族（已经会／偶尔会／还不会）。 */
export const ACHIEVEMENT_KINDS = ['已经会', '偶尔会', '还不会'] as const;

/** 面向狀態的白話（好 → 壞），依那一支頁面分段的段數挑。 */
export const ACHIEVEMENT_PLAIN: Readonly<Record<3 | 4, readonly string[]>> = {
  4: ['已经稳定', '大部分会了，还有几项不稳', '还在发展中，需要多练', '需要优先关注'],
  3: ['已经稳定', '还有几项不稳', '需要优先关注'],
};

/** 句中用的短說法（同上順序）。 */
export const ACHIEVEMENT_SHORT: Readonly<Record<3 | 4, readonly string[]>> = {
  4: ['已经稳定', '大部分会了，还有几项不稳', '还在发展中', '需要优先关注'],
  3: ['已经稳定', '还有几项不稳', '需要优先关注'],
};

export const FEW_ITEMS = '题数太少，这次不单独判断';

/** 總覽：有需要練的面向時（規格 §5 第 1 條）。 */
export function achievementOverall(asked: number, counts: readonly [number, number, number], focus: ReadonlyArray<{ name: string; short: string }>): string {
  const [a, b] = focus;
  return `这次 ${asked} 题里已经会 ${counts[0]} 题。`
    + `「${a.name}」${a.short ? `${a.short}，` : ''}是这次最需要练的地方`
    + (b ? `；「${b.name}」${b.short || '也还有几项不稳'}` : '')
    + '。下面把还不稳的题目列出来，可以直接当作练习目标。';
}

/** 總覽：各面向都穩、題庫又沒有那一段的建議時（規格 §5 第 2 條的退路）。 */
export function achievementAllSteady(asked: number, counts: readonly [number, number, number]): string {
  return `这次 ${asked} 题里已经会 ${counts[0]} 题，各方面都比较稳定。维持日常的游戏与活动机会就好，三个月后可以再做一次，看看前后的变化。`;
}

/** 「下一步先练」那一句的說明。 */
export const NEXT_STEP_NOTE = '这是这一面还没稳定的项目里最早的一项，先把它练稳，后面的会比较顺。';

// ── 頻率族（D-4）：選項是「多常出現」，越多越需要留意。

export const CONCERN_KINDS = ['很少或没有', '偶尔', '常出现'] as const;
/** ASR 的選項是「和同龄孩子比起来」，原文「轻度／中度不同」踩禁字。 */
export const ASR_KINDS = ['和同龄孩子相近', '有一点不同', '很不一样'] as const;
/** SNAP-IV 的選項是「多不多」。 */
export const SNAP_KINDS = ['没有', '有一点', '比较多'] as const;
/** CHEXI 的題目是「孩子是不是這樣」。 */
export const CHEXI_KINDS = ['不太像孩子', '有点像', '很像孩子'] as const;

export const CONCERN_PLAIN: Readonly<Record<3 | 4, readonly string[]>> = {
  4: ['没有需要留意的', '有几项需要留意', '比较常出现', '常出现，需要优先关注'],
  3: ['没有需要留意的', '有几项需要留意', '常出现，需要优先关注'],
};
export const CONCERN_SHORT: Readonly<Record<3 | 4, readonly string[]>> = {
  4: ['没有需要留意的', '有几项需要留意', '比较常出现', '常出现'],
  3: ['没有需要留意的', '有几项需要留意', '常出现'],
};

export function concernOverall(asked: number, counts: readonly [number, number, number], focus: ReadonlyArray<{ name: string; short: string }>, kinds: readonly string[]): string {
  const [a, b] = focus;
  return `这次 ${asked} 题里，「${kinds[2]}」的有 ${counts[2]} 题、「${kinds[1]}」的有 ${counts[1]} 题。`
    + `「${a.name}」${a.short ? `${a.short}，` : ''}是这次最需要先关心的地方`
    + (b ? `；「${b.name}」${b.short || '也有几项需要留意'}` : '')
    + '。下面列出比较常出现的情形，可以从这几项开始调整。';
}

export function concernAllSteady(asked: number, counts: readonly [number, number, number], kinds: readonly string[]): string {
  return `这次 ${asked} 题里，「${kinds[2]}」的有 ${counts[2]} 题，各方面没有集中需要留意的地方。维持现在的作息与相处方式就好，三个月后可以再做一次，看看前后的变化。`;
}

/** 頻率族不講「下一步先练」，講這一句。 */
export const FREQUENT_START = '先从这几种情形着手';

// ── 七級（ADL，D-4）。

export const ADL_KINDS = ['自己做到', '需要一点帮忙', '大人做为主'] as const;
export const ADL_PLAIN: Readonly<Record<3 | 4, readonly string[]>> = {
  4: ['已经能自己做', '大部分能自己做', '有几项还需要帮忙', '很多事还需要大人帮忙'],
  3: ['已经能自己做', '有几项还需要帮忙', '很多事还需要大人帮忙'],
};
export const ADL_SHORT = ADL_PLAIN;

export function adlOverall(asked: number, counts: readonly [number, number, number], focus: ReadonlyArray<{ name: string; short: string }>): string {
  const [a, b] = focus;
  return `这次 ${asked} 题里，孩子自己做到 ${counts[0]} 题。`
    + `「${a.name}」${a.short ? `${a.short}，` : ''}是这次最需要练的地方`
    + (b ? `；「${b.name}」${b.short || '也有几项还需要帮忙'}` : '')
    + '。下面列出还需要帮忙的事，可以从最先列出的那一项开始，让孩子多做一点。';
}

export function adlAllSteady(asked: number, counts: readonly [number, number, number]): string {
  return `这次 ${asked} 题里，孩子自己做到 ${counts[0]} 题，各方面都比较稳定。日常里继续给孩子自己动手的机会，三个月后可以再做一次，看看前后的变化。`;
}
