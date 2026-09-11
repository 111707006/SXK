/**
 * SXK-SOC　森心康社会能力发展量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康社会能力发展量表_SXK-SOC.html`（sha256 ca830960770c…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_SOC: ToolkitBank = {
  id: 'sxk-soc',
  code: 'SXK-SOC',
  title: '森心康社会能力发展量表',
  source: { file: '02_分项发展/森心康社会能力发展量表_SXK-SOC.html', sha256: 'ca830960770c3bc0a1fc60658638c83733cb27245458ab24558bb7f78a0a005f' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'S1',
      name: '人际注意',
      items: [
        { no: 1, text: '会注视大人的脸', startMonth: 1 },
        { no: 2, text: '被逗时会露出笑容', startMonth: 2 },
        { no: 3, text: '会用眼神跟着走动的人', startMonth: 3 },
        { no: 4, text: '叫名字会回头', startMonth: 9 },
        { no: 5, text: '会看大人的表情决定要不要做', startMonth: 12 },
        { no: 6, text: '会跟随大人指的方向看', startMonth: 12 },
        { no: 7, text: '会主动看向说话的人', startMonth: 9 },
        { no: 8, text: '能与人维持一段眼神交流', startMonth: 12 },
      ],
    },
    {
      key: 'S2',
      name: '情绪互动',
      items: [
        { no: 1, text: '被抱起会安静下来', startMonth: 2 },
        { no: 2, text: '会认得熟悉的人', startMonth: 7 },
        { no: 3, text: '分离时会有情绪，回来能安抚', startMonth: 12 },
        { no: 4, text: '会主动伸手要抱', startMonth: 9 },
        { no: 5, text: '会用表情回应别人的表情', startMonth: 9 },
        { no: 6, text: '会安慰难过的人', startMonth: 36 },
        { no: 7, text: '能说出自己的感受', startMonth: 36 },
        { no: 8, text: '能察觉别人不开心', startMonth: 42 },
      ],
    },
    {
      key: 'S3',
      name: '模仿与学习',
      items: [
        { no: 1, text: '会模仿简单动作（拍手、再见）', startMonth: 9 },
        { no: 2, text: '会模仿大人做家事', startMonth: 15 },
        { no: 3, text: '会模仿声音或词', startMonth: 12 },
        { no: 4, text: '会照着大人的样子玩玩具', startMonth: 15 },
        { no: 5, text: '会模仿同伴的玩法', startMonth: 24 },
        { no: 6, text: '会学大人说话的语气', startMonth: 24 },
        { no: 7, text: '会照着示范完成两步骤动作', startMonth: 30 },
        { no: 8, text: '能观察后自己尝试新方法', startMonth: 42 },
      ],
    },
    {
      key: 'S4',
      name: '游戏参与',
      items: [
        { no: 1, text: '玩躲猫猫会有反应', startMonth: 9 },
        { no: 2, text: '对同龄孩子有兴趣、会靠近看', startMonth: 12 },
        { no: 3, text: '会和其他孩子在同一空间各玩各的', startMonth: 24 },
        { no: 4, text: '会和其他孩子一起玩、有互动', startMonth: 36 },
        { no: 5, text: '会轮流（可能需提醒）', startMonth: 36 },
        { no: 6, text: '能主动邀请别人一起玩', startMonth: 48 },
        { no: 7, text: '能和同伴合作完成一件事', startMonth: 54 },
        { no: 8, text: '有固定会一起玩的伙伴', startMonth: 54 },
      ],
    },
    {
      key: 'S5',
      name: '规则与自我',
      items: [
        { no: 1, text: '听到「不可以」会停下来', startMonth: 12 },
        { no: 2, text: '会说自己的名字', startMonth: 30 },
        { no: 3, text: '会等一下下（短暂等待）', startMonth: 30 },
        { no: 4, text: '会遵守简单规则', startMonth: 42 },
        { no: 5, text: '输了游戏能大致接受', startMonth: 54 },
        { no: 6, text: '能在团体中遵守规则', startMonth: 54 },
        { no: 7, text: '会说谢谢、对不起', startMonth: 36 },
        { no: 8, text: '能说出自己喜欢与不喜欢的事', startMonth: 36 },
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
