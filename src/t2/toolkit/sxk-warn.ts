/**
 * SXK-WARN　儿童心理行为发育问题预警征象筛查
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`01_综合筛查与官方工具/SXK-WARN_儿童心理行为发育问题预警征象筛查.html`（sha256 75baa344aae5…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_WARN: ToolkitBank = {
  id: 'sxk-warn',
  code: 'SXK-WARN',
  title: '儿童心理行为发育问题预警征象筛查',
  source: { file: '01_综合筛查与官方工具/SXK-WARN_儿童心理行为发育问题预警征象筛查.html', sha256: '75baa344aae59dcb37b6e5801f87f64e3043ec5452a5253506f7eb299ab6c181' },
  options: [
    { value: 0, label: '未见异常' },
    { value: 1, label: '阳性' },
  ],
  sections: [
    {
      key: 'm3',
      name: '3 月龄',
      ageBand: { key: '3', lo: 3, hi: 5 },
      items: [
        { no: 1, text: '对很大声音没有反应', startMonth: null },
        { no: 2, text: '逗引时不发音或不会微笑', startMonth: null },
        { no: 3, text: '不注视人脸，不追视移动人或物品', startMonth: null },
        { no: 4, text: '俯卧时不会抬头', startMonth: null },
      ],
    },
    {
      key: 'm6',
      name: '6 月龄',
      ageBand: { key: '6', lo: 6, hi: 7 },
      items: [
        { no: 1, text: '发音少，不会笑出声', startMonth: null },
        { no: 2, text: '不会伸手抓物', startMonth: null },
        { no: 3, text: '紧握拳松不开', startMonth: null },
        { no: 4, text: '不能扶坐', startMonth: null },
      ],
    },
    {
      key: 'm8',
      name: '8 月龄',
      ageBand: { key: '8', lo: 8, hi: 11 },
      items: [
        { no: 1, text: '听到声音无应答', startMonth: null },
        { no: 2, text: '不会区分生人和熟人', startMonth: null },
        { no: 3, text: '双手间不会传递玩具', startMonth: null },
        { no: 4, text: '不会独坐', startMonth: null },
      ],
    },
    {
      key: 'm12',
      name: '12 月龄',
      ageBand: { key: '12', lo: 12, hi: 17 },
      items: [
        { no: 1, text: '呼唤名字无反应', startMonth: null },
        { no: 2, text: '不会模仿“再见”或“欢迎”动作', startMonth: null },
        { no: 3, text: '不会用拇食指对捏小物品', startMonth: null },
        { no: 4, text: '不会扶物站立', startMonth: null },
      ],
    },
    {
      key: 'm18',
      name: '18 月龄',
      ageBand: { key: '18', lo: 18, hi: 23 },
      items: [
        { no: 1, text: '不会有意识叫“爸爸”或“妈妈”', startMonth: null },
        { no: 2, text: '不会按要求指人或物', startMonth: null },
        { no: 3, text: '与人无目光交流', startMonth: null },
        { no: 4, text: '不会独走', startMonth: null },
      ],
    },
    {
      key: 'm24',
      name: '24 月龄',
      ageBand: { key: '24', lo: 24, hi: 29 },
      items: [
        { no: 1, text: '不会说3个物品的名称', startMonth: null },
        { no: 2, text: '不会按吩咐做简单事情', startMonth: null },
        { no: 3, text: '不会用勺吃饭', startMonth: null },
        { no: 4, text: '不会扶栏上楼梯/台阶', startMonth: null },
      ],
    },
    {
      key: 'm30',
      name: '30 月龄',
      ageBand: { key: '30', lo: 30, hi: 35 },
      items: [
        { no: 1, text: '不会说2—3个字的短语', startMonth: null },
        { no: 2, text: '兴趣单一、刻板', startMonth: null },
        { no: 3, text: '不会示意大小便', startMonth: null },
        { no: 4, text: '不会跑', startMonth: null },
      ],
    },
    {
      key: 'm36',
      name: '36 月龄',
      ageBand: { key: '36', lo: 36, hi: 47 },
      items: [
        { no: 1, text: '不会说自己的名字', startMonth: null },
        { no: 2, text: '不会玩“拿棍当马骑”等假想游戏', startMonth: null },
        { no: 3, text: '不会模仿画圆', startMonth: null },
        { no: 4, text: '不会双脚跳', startMonth: null },
      ],
    },
    {
      key: 'm48',
      name: '4 岁',
      ageBand: { key: '48', lo: 48, hi: 59 },
      items: [
        { no: 1, text: '不会说带形容词的句子', startMonth: null },
        { no: 2, text: '不能按要求等待或轮流', startMonth: null },
        { no: 3, text: '不会独立穿衣', startMonth: null },
        { no: 4, text: '不会单脚站立', startMonth: null },
      ],
    },
    {
      key: 'm60',
      name: '5 岁',
      ageBand: { key: '60', lo: 60, hi: 71 },
      items: [
        { no: 1, text: '不能简单叙说事情经过', startMonth: null },
        { no: 2, text: '不知道自己的性别', startMonth: null },
        { no: 3, text: '不会用筷子吃饭', startMonth: null },
        { no: 4, text: '不会单脚跳', startMonth: null },
      ],
    },
    {
      key: 'm72',
      name: '6 岁',
      ageBand: { key: '72', lo: 72, hi: 83 },
      items: [
        { no: 1, text: '不会表达自己的感受或想法', startMonth: null },
        { no: 2, text: '不会玩角色扮演的集体游戏', startMonth: null },
        { no: 3, text: '不会画方形', startMonth: null },
        { no: 4, text: '不会奔跑', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '初筛未见异常', max: 0 },
    { tier: 3, key: '初筛异常', min: 1 },
  ],
  preQuestions: [
    {
      key: 'regression',
      kind: 'multi',
      prompt: '询问家长，了解儿童是否出现语言功能和社会交往能力障碍或倒退。',
      options: [
        { value: 'none', label: '未见异常', exclusive: true },
        { value: 'language', label: '语言功能障碍或倒退' },
        { value: 'social', label: '社会交往能力障碍或倒退' },
      ],
    },
  ],
};
