/**
 * SXK-AB　森心康注意力及行为观察量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`04_注意力与执行功能/森心康注意力及行为观察量表_SXK-AB.html`（sha256 1496000a9cd0…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_AB: ToolkitBank = {
  id: 'sxk-ab',
  code: 'SXK-AB',
  title: '森心康注意力及行为观察量表',
  source: { file: '04_注意力与执行功能/森心康注意力及行为观察量表_SXK-AB.html', sha256: '1496000a9cd0cc19693ecb5939dfb30cebd6a5c8286dcf89024644ace8f6b9df' },
  options: [
    { value: 0, label: '很少或没有' },
    { value: 1, label: '偶尔' },
    { value: 2, label: '经常' },
    { value: 3, label: '总是' },
  ],
  sections: [
    {
      key: 'SU',
      name: '持续专注',
      items: [
        { no: 1, text: '做一件事撑不了多久就想换别的', startMonth: 36 },
        { no: 2, text: '听人说话时常常放空、没在听', startMonth: 36 },
        { no: 3, text: '需要一再提醒才能把一件事做完', startMonth: 36 },
        { no: 4, text: '做到一半就跑去做别的事', startMonth: 36 },
        { no: 5, text: '安静的活动（拼图、看书）维持不了几分钟', startMonth: 36 },
        { no: 6, text: '需要动脑的作业特别容易半途而废', startMonth: 48 },
        { no: 7, text: '交代的事听完就忘', startMonth: 48 },
        { no: 8, text: '写作业或练习时间明显比同龄久', startMonth: 60 },
      ],
    },
    {
      key: 'DI',
      name: '抗干扰',
      items: [
        { no: 1, text: '旁边一有动静就被吸引过去', startMonth: 36 },
        { no: 2, text: '在人多的地方几乎无法专心', startMonth: 36 },
        { no: 3, text: '环境稍微吵就做不下去', startMonth: 36 },
        { no: 4, text: '东西常常掉了、忘了、找不到', startMonth: 48 },
        { no: 5, text: '一边做事一边被无关的念头带走', startMonth: 48 },
        { no: 6, text: '同时有两件事时完全乱掉', startMonth: 48 },
        { no: 7, text: '容易因为粗心出错，而不是不会做', startMonth: 60 },
        { no: 8, text: '做作业时需要人陪在旁边才不分心', startMonth: 60 },
      ],
    },
    {
      key: 'IM',
      name: '冲动控制',
      items: [
        { no: 1, text: '想要的东西马上就要拿到', startMonth: 30 },
        { no: 2, text: '不等别人讲完就抢着说', startMonth: 36 },
        { no: 3, text: '排队或轮流对他很困难', startMonth: 36 },
        { no: 4, text: '没想清楚后果就行动', startMonth: 36 },
        { no: 5, text: '被制止后还是会再做一次', startMonth: 36 },
        { no: 6, text: '插话或打断别人的活动', startMonth: 36 },
        { no: 7, text: '情绪一来就先动手或先大叫', startMonth: 36 },
        { no: 8, text: '答题时抢快而不看清楚', startMonth: 60 },
      ],
    },
    {
      key: 'HY',
      name: '活动量',
      items: [
        { no: 1, text: '吃饭时坐不住', startMonth: 30 },
        { no: 2, text: '睡前特别难静下来', startMonth: 30 },
        { no: 3, text: '坐着时手脚一直动、扭来扭去', startMonth: 36 },
        { no: 4, text: '很难安静地玩或做静态活动', startMonth: 36 },
        { no: 5, text: '像装了马达一样停不下来', startMonth: 36 },
        { no: 6, text: '爬上爬下、跑来跑去不看场合', startMonth: 36 },
        { no: 7, text: '话特别多、停不下来', startMonth: 36 },
        { no: 8, text: '该坐好的场合会离开座位', startMonth: 48 },
      ],
    },
    {
      key: 'EF',
      name: '组织与执行',
      items: [
        { no: 1, text: '做事没有顺序，想到哪做到哪', startMonth: 48 },
        { no: 2, text: '多步骤的事情容易漏掉其中几步', startMonth: 48 },
        { no: 3, text: '遇到困难就卡住，不会换方法', startMonth: 48 },
        { no: 4, text: '需要大人帮忙才能开始一件事', startMonth: 48 },
        { no: 5, text: '同一个错误反复出现', startMonth: 48 },
        { no: 6, text: '时间感差，常常来不及或拖到最后', startMonth: 60 },
        { no: 7, text: '书包、房间、桌面长期杂乱', startMonth: 60 },
        { no: 8, text: '计划好的事情常常没做到', startMonth: 60 },
      ],
    },
    {
      key: 'OD',
      name: '对立与情绪',
      items: [
        { no: 1, text: '挫折忍受度低，一不顺就爆发', startMonth: 36 },
        { no: 2, text: '与同伴容易起冲突', startMonth: 36 },
        { no: 3, text: '对大人的要求习惯性反抗', startMonth: 36 },
        { no: 4, text: '被纠正时会顶嘴或生气', startMonth: 36 },
        { no: 5, text: '情绪起伏大且不容易预期', startMonth: 36 },
        { no: 6, text: '因为上述表现被老师或家人反复提醒', startMonth: 36 },
        { no: 7, text: '情绪过后需要很久才能平复', startMonth: 36 },
        { no: 8, text: '把错误归到别人身上', startMonth: 48 },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', min: 0, max: 33 },
    { tier: 2, key: '轻微', min: 34, max: 41 },
    { tier: 3, key: '中度', min: 42, max: 50 },
    { tier: 4, key: '明显', min: 51, max: 100 },
  ],
  preQuestions: [
    {
      key: 'settings',
      kind: 'multi',
      prompt: '先请教一个问题：这些表现出现在哪些场合？',
      options: [
        { value: 'home', label: '在家中出现' },
        { value: 'school', label: '在学校／幼儿园出现' },
        { value: 'other', label: '在其他场合出现（安亲班、才艺班、亲戚家等）' },
      ],
    },
  ],
};
