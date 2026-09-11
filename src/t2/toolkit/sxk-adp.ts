/**
 * SXK-ADP　森心康适应能力发展量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康适应能力发展量表_SXK-ADP.html`（sha256 7239a77b10d1…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ADP: ToolkitBank = {
  id: 'sxk-adp',
  code: 'SXK-ADP',
  title: '森心康适应能力发展量表',
  source: { file: '02_分项发展/森心康适应能力发展量表_SXK-ADP.html', sha256: '7239a77b10d186ff3fbc5ec98c0f77af0e4ceee0514456170a0cb31e9da6b9c7' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'A1',
      name: '视觉与追踪',
      items: [
        { no: 1, text: '眼睛能盯着移动的东西看', startMonth: 1 },
        { no: 2, text: '眼睛能跟着东西过中线', startMonth: 2 },
        { no: 3, text: '会寻找声音的来源', startMonth: 3 },
        { no: 4, text: '看到东西会伸手去碰', startMonth: 4 },
        { no: 5, text: '能同时注意两样东西', startMonth: 6 },
        { no: 6, text: '会注视掉落的东西', startMonth: 8 },
        { no: 7, text: '能在杂乱中找到指定物品', startMonth: 24 },
        { no: 8, text: '能看出图片中的细节差异', startMonth: 42 },
      ],
    },
    {
      key: 'A2',
      name: '物体操作',
      items: [
        { no: 1, text: '能短暂抓住放进手心的小物', startMonth: 2 },
        { no: 2, text: '会把东西从一手换到另一手', startMonth: 7 },
        { no: 3, text: '会把东西放进容器里', startMonth: 10 },
        { no: 4, text: '会用拇指食指捏起小东西', startMonth: 10 },
        { no: 5, text: '能叠起两三块积木', startMonth: 15 },
        { no: 6, text: '会翻书页', startMonth: 15 },
        { no: 7, text: '能叠六块以上积木', startMonth: 30 },
        { no: 8, text: '会把珠子串起来', startMonth: 30 },
      ],
    },
    {
      key: 'A3',
      name: '问题解决',
      items: [
        { no: 1, text: '东西被藏起来会去找', startMonth: 9 },
        { no: 2, text: '会把盖子打开找里面的东西', startMonth: 10 },
        { no: 3, text: '会用工具拿到构不到的东西', startMonth: 15 },
        { no: 4, text: '会拼简单拼图（三片）', startMonth: 24 },
        { no: 5, text: '会照顺序做两件事', startMonth: 30 },
        { no: 6, text: '遇到困难会尝试别的方法', startMonth: 36 },
        { no: 7, text: '会拼六片以上拼图', startMonth: 42 },
        { no: 8, text: '能说出简单的解决办法', startMonth: 54 },
      ],
    },
    {
      key: 'A4',
      name: '概念理解',
      items: [
        { no: 1, text: '会配对相同的东西', startMonth: 15 },
        { no: 2, text: '知道常见物品的用途', startMonth: 18 },
        { no: 3, text: '懂得「大／小」', startMonth: 24 },
        { no: 4, text: '会依颜色或形状分类', startMonth: 30 },
        { no: 5, text: '懂得「多／少」', startMonth: 30 },
        { no: 6, text: '会数到十', startMonth: 42 },
        { no: 7, text: '认得基本颜色', startMonth: 42 },
        { no: 8, text: '懂「上面／下面」「前面／后面」', startMonth: 42 },
      ],
    },
    {
      key: 'A5',
      name: '生活应用',
      items: [
        { no: 1, text: '会假装玩（喂娃娃、开玩具车）', startMonth: 18 },
        { no: 2, text: '知道危险的东西不能碰', startMonth: 30 },
        { no: 3, text: '会照生活流程行动（洗手吃饭）', startMonth: 30 },
        { no: 4, text: '会把玩具收回原位', startMonth: 36 },
        { no: 5, text: '能记住并完成交代的事', startMonth: 36 },
        { no: 6, text: '能说出自己家的信息（姓名、家人）', startMonth: 42 },
        { no: 7, text: '会看情况添减衣服', startMonth: 54 },
        { no: 8, text: '会用简单的方法记住事情', startMonth: 54 },
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
