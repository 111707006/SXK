/**
 * SXK-ASQ　森心康三岁综合筛查量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康三岁综合筛查量表_SXK-ASQ.html`（sha256 21d46213b501…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ASQ: ToolkitBank = {
  id: 'sxk-asq',
  code: 'SXK-ASQ',
  title: '森心康三岁综合筛查量表',
  source: { file: '02_分项发展/森心康三岁综合筛查量表_SXK-ASQ.html', sha256: '21d46213b50159cc6f7c786fffb76e83ce73e0e137fdaa0311eceb7a237b8a4b' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'CO',
      name: '沟通',
      items: [
        { no: 1, text: '会说三到四个词的句子', startMonth: 30 },
        { no: 2, text: '能依两步骤指令行动', startMonth: 30 },
        { no: 3, text: '会问「这是什么」', startMonth: 30 },
        { no: 4, text: '别人大致听得懂他说的话', startMonth: 33 },
        { no: 5, text: '会用「我」称呼自己', startMonth: 33 },
        { no: 6, text: '能说出刚发生的事', startMonth: 36 },
      ],
    },
    {
      key: 'GM',
      name: '粗大动作',
      items: [
        { no: 1, text: '能双脚同时离地跳', startMonth: 30 },
        { no: 2, text: '能自己上下楼梯', startMonth: 30 },
        { no: 3, text: '能单脚站一两秒', startMonth: 30 },
        { no: 4, text: '能踢固定的球', startMonth: 30 },
        { no: 5, text: '能跑步并控制方向', startMonth: 30 },
        { no: 6, text: '能从矮处往下跳', startMonth: 33 },
      ],
    },
    {
      key: 'FM',
      name: '精细动作',
      items: [
        { no: 1, text: '会照着画直线或圆圈', startMonth: 30 },
        { no: 2, text: '能叠六块以上积木', startMonth: 30 },
        { no: 3, text: '会转开瓶盖', startMonth: 30 },
        { no: 4, text: '会把珠子串起来', startMonth: 30 },
        { no: 5, text: '会自己拿笔涂鸦成形', startMonth: 30 },
        { no: 6, text: '会用剪刀剪开纸', startMonth: 33 },
      ],
    },
    {
      key: 'PS',
      name: '解决问题',
      items: [
        { no: 1, text: '会依颜色或形状分类', startMonth: 30 },
        { no: 2, text: '懂得「大／小」', startMonth: 30 },
        { no: 3, text: '会照顺序做两件事', startMonth: 30 },
        { no: 4, text: '会拼三片以上拼图', startMonth: 30 },
        { no: 5, text: '会用工具拿到构不到的东西', startMonth: 30 },
        { no: 6, text: '懂得「多／少」', startMonth: 33 },
      ],
    },
    {
      key: 'PE',
      name: '个人社会',
      items: [
        { no: 1, text: '会自己用汤匙吃完一餐', startMonth: 30 },
        { no: 2, text: '白天大小便能自己表示', startMonth: 30 },
        { no: 3, text: '会自己脱简单衣物', startMonth: 30 },
        { no: 4, text: '会和其他孩子在同一空间玩', startMonth: 30 },
        { no: 5, text: '会说自己的名字', startMonth: 30 },
        { no: 6, text: '会等一下下', startMonth: 33 },
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
