/**
 * SXK-LDS　森心康学习障碍量表（国高中版）
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`06_学习障碍/森心康学习障碍量表_国高中版_SXK-LDS.html`（sha256 0c09f36552fd…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_LDS: ToolkitBank = {
  id: 'sxk-lds',
  code: 'SXK-LDS',
  title: '森心康学习障碍量表（国高中版）',
  source: { file: '06_学习障碍/森心康学习障碍量表_国高中版_SXK-LDS.html', sha256: '0c09f36552fd4d445cc2b159ef747de2d44c25582fe270440409b5e52ef5a486' },
  options: [
    { value: 0, label: '从未' },
    { value: 1, label: '偶尔' },
    { value: 2, label: '经常' },
    { value: 3, label: '总是' },
  ],
  sections: [
    {
      key: 'read',
      name: '阅读方面',
      items: [
        { no: 1, text: '读得慢，考试常常来不及看完题目', startMonth: null },
        { no: 2, text: '读完长篇文章后抓不住内容，也记不太住', startMonth: null },
        { no: 3, text: '朗读时会念错、漏字，或把字音前后颠倒', startMonth: null },
        { no: 4, text: '不会用快速浏览的方式找重点，只能一字一字读', startMonth: null },
        { no: 5, text: '背学科名词或外语单词特别吃力', startMonth: null },
        { no: 6, text: '课堂上讨论得很好，写出来的作业却差很多', startMonth: null },
      ],
    },
    {
      key: 'math',
      name: '数学方面',
      items: [
        { no: 1, text: '基本的加减乘除做得不流畅', startMonth: null },
        { no: 2, text: '应用题看懂了，却列不出算式', startMonth: null },
        { no: 3, text: '弄不懂代数符号代表什么意思', startMonth: null },
        { no: 4, text: '测量、估算和比例这类概念掌握得不牢', startMonth: null },
        { no: 5, text: '计算时常出错，而且错的地方没有规律', startMonth: null },
        { no: 6, text: '算钱、安排时间这类生活中的数字应用有困难', startMonth: null },
      ],
    },
    {
      key: 'write',
      name: '书写方面',
      items: [
        { no: 1, text: '写字慢，课堂上的板书抄不完', startMonth: null },
        { no: 2, text: '写长文时结构松散，前后逻辑跳跃', startMonth: null },
        { no: 3, text: '错别字偏多，英文拼写也常出错', startMonth: null },
        { no: 4, text: '一边想一边写做不到，顾着想就写不下去', startMonth: null },
        { no: 5, text: '口头回答得很好，笔试作答却明显偏弱', startMonth: null },
        { no: 6, text: '写久了手会酸痛，或明显觉得疲累', startMonth: null },
      ],
    },
    {
      key: 'attn',
      name: '注意力方面',
      items: [
        { no: 1, text: '上课专注撑不过十几分钟就开始走神', startMonth: null },
        { no: 2, text: '常忘记交作业，或记错考试日期', startMonth: null },
        { no: 3, text: '很难开始动手写作业，习惯拖到最后', startMonth: null },
        { no: 4, text: '同时有好几件事要做时，分不清该先做哪一个', startMonth: null },
        { no: 5, text: '不等想清楚就抢着回答，很难先停下来思考', startMonth: null },
        { no: 6, text: '情绪起伏大，遇到挫折容易放弃', startMonth: null },
      ],
    },
    {
      key: 'lang',
      name: '语言处理方面',
      items: [
        { no: 1, text: '光靠听老师讲课不容易听懂内容', startMonth: null },
        { no: 2, text: '说话时讲不到重点，容易绕圈子', startMonth: null },
        { no: 3, text: '对语音的分辨与记忆较弱，影响外语学习', startMonth: null },
        { no: 4, text: '遇到生词，不太会从上下文推测意思', startMonth: null },
        { no: 5, text: '课堂讨论时需要比别人更久才组织得出回答', startMonth: null },
        { no: 6, text: '老师口头交代的事情或课堂重点记不住', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', max: 9 },
    { tier: 2, key: '轻微', min: 10, max: 19 },
    { tier: 3, key: '中等', min: 20, max: 29 },
    { tier: 4, key: '显著', min: 30 },
  ],
  sectionTiers: [
    { tier: 1, key: '未见明显', max: 4 },
    { tier: 2, key: '轻微', min: 5, max: 8 },
    { tier: 3, key: '中等', min: 9, max: 12 },
    { tier: 4, key: '显著', min: 13 },
  ],
  preQuestions: [],
};
