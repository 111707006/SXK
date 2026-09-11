/**
 * SXK-LANG　森心康语言能力发展量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康语言能力发展量表_SXK-LANG.html`（sha256 a10e4e7e59d2…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_LANG: ToolkitBank = {
  id: 'sxk-lang',
  code: 'SXK-LANG',
  title: '森心康语言能力发展量表',
  source: { file: '02_分项发展/森心康语言能力发展量表_SXK-LANG.html', sha256: 'a10e4e7e59d229bd62e2d97b4852725f2d6e5e4740505a85aafc8e3e53bc36de' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'RC',
      name: '听觉理解',
      items: [
        { no: 1, text: '听到声音会转头找', startMonth: 3 },
        { no: 2, text: '叫名字会回应', startMonth: 9 },
        { no: 3, text: '听得懂「不可以」并停下', startMonth: 12 },
        { no: 4, text: '听得懂「过来」「给我」', startMonth: 14 },
        { no: 5, text: '能依单一指令行动', startMonth: 15 },
        { no: 6, text: '能指认常见物品', startMonth: 18 },
        { no: 7, text: '能指认身体部位', startMonth: 18 },
        { no: 8, text: '听得懂「大／小」', startMonth: 24 },
        { no: 9, text: '能依两步骤指令行动', startMonth: 30 },
        { no: 10, text: '听得懂位置词（上面、里面、后面）', startMonth: 36 },
        { no: 11, text: '听得懂「谁／哪里／什么」的提问', startMonth: 36 },
        { no: 12, text: '听得懂「为什么／怎么办」', startMonth: 48 },
        { no: 13, text: '听完一小段话能回答细节', startMonth: 48 },
        { no: 14, text: '听得懂三步骤指令', startMonth: 54 },
        { no: 15, text: '能理解因果关系的说法', startMonth: 54 },
        { no: 16, text: '听得懂比较复杂的长句', startMonth: 60 },
      ],
    },
    {
      key: 'EX',
      name: '口语表达',
      items: [
        { no: 1, text: '会发出咕咕声或啊啊声', startMonth: 3 },
        { no: 2, text: '会发出连续的声音玩声音', startMonth: 9 },
        { no: 3, text: '会说有意义的第一个词', startMonth: 14 },
        { no: 4, text: '会说五个以上的词', startMonth: 16 },
        { no: 5, text: '会说十个以上的词', startMonth: 18 },
        { no: 6, text: '会用词表达需求（要、不要）', startMonth: 18 },
        { no: 7, text: '会把两个词组起来', startMonth: 24 },
        { no: 8, text: '会说自己的名字', startMonth: 30 },
        { no: 9, text: '会说三到四个词的句子', startMonth: 33 },
        { no: 10, text: '会用「我」「你」等称呼', startMonth: 36 },
        { no: 11, text: '会用「在／的／了」等虚词', startMonth: 42 },
        { no: 12, text: '能讲出刚刚发生的一件事', startMonth: 42 },
        { no: 13, text: '会用形容词描述', startMonth: 48 },
        { no: 14, text: '能描述图片中的情节', startMonth: 48 },
        { no: 15, text: '能按顺序讲完一个短故事', startMonth: 54 },
        { no: 16, text: '会用「因为／所以」', startMonth: 54 },
        { no: 17, text: '能说出反义词', startMonth: 54 },
        { no: 18, text: '能讲述未来要做的事', startMonth: 60 },
      ],
    },
    {
      key: 'AR',
      name: '语音清晰度',
      items: [
        { no: 1, text: '会模仿大人的语音', startMonth: 12 },
        { no: 2, text: '发音时嘴型有变化', startMonth: 15 },
        { no: 3, text: '家人能听懂大部分内容', startMonth: 24 },
        { no: 4, text: '能正确说出常见字词的音', startMonth: 30 },
        { no: 5, text: '说话音量适中', startMonth: 36 },
        { no: 6, text: '不熟的人能听懂大部分内容', startMonth: 42 },
        { no: 7, text: '说话速度适中', startMonth: 42 },
        { no: 8, text: '少有明显的语音替代（如把ㄍ说成ㄉ）', startMonth: 48 },
        { no: 9, text: '少有语音省略', startMonth: 48 },
        { no: 10, text: '说话流畅少有卡顿', startMonth: 48 },
        { no: 11, text: '不会重复第一个字或音', startMonth: 48 },
        { no: 12, text: '长句子也能说清楚', startMonth: 54 },
      ],
    },
    {
      key: 'PR',
      name: '沟通功能与语用',
      items: [
        { no: 1, text: '会用哭以外的方式表达需求', startMonth: 9 },
        { no: 2, text: '会用手势表达', startMonth: 12 },
        { no: 3, text: '会主动叫人引起注意', startMonth: 15 },
        { no: 4, text: '会用语言拒绝或表示不要', startMonth: 24 },
        { no: 5, text: '会打招呼或说再见', startMonth: 24 },
        { no: 6, text: '会说谢谢、对不起', startMonth: 36 },
        { no: 7, text: '会提问（这是什么、为什么）', startMonth: 36 },
        { no: 8, text: '能和大人来回对话三轮以上', startMonth: 42 },
        { no: 9, text: '会主动开启话题', startMonth: 48 },
        { no: 10, text: '会等对方说完再说', startMonth: 48 },
        { no: 11, text: '话题偏离时能被拉回', startMonth: 48 },
        { no: 12, text: '会依对象调整说话方式', startMonth: 60 },
        { no: 13, text: '能察觉对方没听懂并重说', startMonth: 60 },
        { no: 14, text: '会用语言解决冲突', startMonth: 60 },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显问题', min: 85 },
    { tier: 2, key: '轻微落后', min: 70, max: 84 },
    { tier: 3, key: '中度落后', min: 55, max: 69 },
    { tier: 4, key: '明显落后', min: 0, max: 54 },
  ],
  preQuestions: [],
  minItems: 3,
};
