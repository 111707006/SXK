/**
 * SXK-GM　森心康粗大动作发展量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康粗大动作发展量表_SXK-GM.html`（sha256 c36635752619…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_GM: ToolkitBank = {
  id: 'sxk-gm',
  code: 'SXK-GM',
  title: '森心康粗大动作发展量表',
  source: { file: '02_分项发展/森心康粗大动作发展量表_SXK-GM.html', sha256: 'c36635752619a97354db16bdb3944b6e46904956d0a9a691026f2a0d4c7d897e' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'P1',
      name: '卧位与翻身',
      items: [
        { no: 1, text: '趴着时能抬头并短暂撑住', startMonth: 2 },
        { no: 2, text: '仰躺时会踢腿挥手', startMonth: 2 },
        { no: 3, text: '趴着时用前臂撑起上身', startMonth: 3 },
        { no: 4, text: '能从仰躺翻成侧躺', startMonth: 4 },
        { no: 5, text: '能仰躺翻成趴着', startMonth: 5 },
        { no: 6, text: '能趴着翻成仰躺', startMonth: 6 },
        { no: 7, text: '趴着时能用手撑起胸部离地', startMonth: 6 },
        { no: 8, text: '趴着时能转身改变方向', startMonth: 8 },
      ],
    },
    {
      key: 'P2',
      name: '坐姿控制',
      items: [
        { no: 1, text: '被扶坐时头能稳住', startMonth: 3 },
        { no: 2, text: '靠着支撑能坐一下', startMonth: 5 },
        { no: 3, text: '能自己坐稳一小段时间', startMonth: 7 },
        { no: 4, text: '坐着时双手能自由活动', startMonth: 8 },
        { no: 5, text: '坐着时能转身拿东西不倒', startMonth: 9 },
        { no: 6, text: '能自己从躺姿坐起来', startMonth: 9 },
        { no: 7, text: '能长时间坐着玩不需支撑', startMonth: 10 },
        { no: 8, text: '坐姿端正不易前倾后仰', startMonth: 18 },
      ],
    },
    {
      key: 'P3',
      name: '爬行与站立',
      items: [
        { no: 1, text: '能用肚子贴地往前移动', startMonth: 7 },
        { no: 2, text: '能手膝并用爬行', startMonth: 9 },
        { no: 3, text: '扶着东西能站起来', startMonth: 9 },
        { no: 4, text: '扶着家具能横向移动', startMonth: 10 },
        { no: 5, text: '能自己放手站立几秒', startMonth: 11 },
        { no: 6, text: '能爬上矮的台阶或沙发', startMonth: 12 },
        { no: 7, text: '能自己从站姿蹲下再站起', startMonth: 14 },
        { no: 8, text: '站立时能弯腰捡东西', startMonth: 14 },
      ],
    },
    {
      key: 'P4',
      name: '走跑跳',
      items: [
        { no: 1, text: '能自己走稳几步', startMonth: 12 },
        { no: 2, text: '能走稳不常跌倒', startMonth: 15 },
        { no: 3, text: '能跑起来', startMonth: 18 },
        { no: 4, text: '能双脚同时离地跳', startMonth: 24 },
        { no: 5, text: '能从矮处往下跳', startMonth: 30 },
        { no: 6, text: '能跑步时转弯或急停', startMonth: 36 },
        { no: 7, text: '能跳过地上的小障碍', startMonth: 42 },
        { no: 8, text: '能单脚连续往前跳', startMonth: 48 },
      ],
    },
    {
      key: 'P5',
      name: '平衡与协调',
      items: [
        { no: 1, text: '扶着能上下楼梯', startMonth: 18 },
        { no: 2, text: '能自己上楼梯（两脚一阶）', startMonth: 24 },
        { no: 3, text: '能踢固定的球', startMonth: 24 },
        { no: 4, text: '能单脚站一两秒', startMonth: 30 },
        { no: 5, text: '能双脚交替上楼梯', startMonth: 36 },
        { no: 6, text: '能接住抛来的大球', startMonth: 42 },
        { no: 7, text: '能单脚站五秒以上', startMonth: 48 },
        { no: 8, text: '能沿着直线走十步', startMonth: 48 },
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
