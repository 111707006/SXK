/**
 * SXK-ADL　森心康生活自理功能量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`05_感觉与生活自理/森心康生活自理功能量表_SXK-ADL.html`（sha256 f8b071e25b7c…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ADL: ToolkitBank = {
  id: 'sxk-adl',
  code: 'SXK-ADL',
  title: '森心康生活自理功能量表',
  source: { file: '05_感觉与生活自理/森心康生活自理功能量表_SXK-ADL.html', sha256: 'f8b071e25b7cff33732a14501629f99beedd1316a448d35c05492ad4f732581e' },
  options: [
    { value: 7, label: '完全自己做', definition: '从头到尾自己完成，不需要有人在旁边' },
    { value: 6, label: '需要有人在旁', definition: '自己做得到，但要有人看着或提醒；或需要辅具、需要比同龄久' },
    { value: 5, label: '需要口头引导', definition: '需要有人一步一步说，但大人不用动手碰他' },
    { value: 4, label: '需要起头或收尾', definition: '大人帮忙开始或收尾，中间他自己做' },
    { value: 3, label: '需要一起做', definition: '大人和他一起做，两个人都出力' },
    { value: 2, label: '大人做为主', definition: '主要由大人完成，他只做其中一两个步骤' },
    { value: 1, label: '完全由大人做', definition: '他没有参与' },
  ],
  sections: [
    {
      key: 'SC',
      name: '自我照顾',
      items: [
        { no: 1, text: '进食（把食物送进嘴里并咽下）', startMonth: 15 },
        { no: 2, text: '穿脱上衣', startMonth: 30 },
        { no: 3, text: '穿脱裤子与鞋袜', startMonth: 30 },
        { no: 4, text: '梳洗整理（洗脸、刷牙、梳头）', startMonth: 36 },
        { no: 5, text: '如厕动作（脱穿裤子、清洁）', startMonth: 36 },
        { no: 6, text: '洗澡（清洗身体各部位）', startMonth: 42 },
      ],
    },
    {
      key: 'SP',
      name: '括约肌控制',
      items: [
        { no: 1, text: '膀胱控制（白天不尿湿）', startMonth: 30 },
        { no: 2, text: '肠道控制（大便能自己表示与完成）', startMonth: 30 },
      ],
    },
    {
      key: 'MO',
      name: '移动与转位',
      items: [
        { no: 1, text: '床椅转位（自己坐上或离开椅子）', startMonth: 15 },
        { no: 2, text: '平地行走或移动 50 公尺', startMonth: 18 },
        { no: 3, text: '如厕转位（自己上下马桶）', startMonth: 30 },
        { no: 4, text: '上下楼梯', startMonth: 30 },
      ],
    },
    {
      key: 'CC',
      name: '沟通与认知',
      items: [
        { no: 1, text: '理解他人的话或指令', startMonth: 15 },
        { no: 2, text: '表达自己的需求与想法', startMonth: 18 },
        { no: 3, text: '与人互动（打招呼、轮流、合作）', startMonth: 24 },
        { no: 4, text: '注意力维持在一件事上', startMonth: 30 },
        { no: 5, text: '解决日常小问题', startMonth: 36 },
        { no: 6, text: '记住并完成交代的事', startMonth: 36 },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '独立性良好', min: 72 },
    { tier: 2, key: '少数活动需协助', min: 58, max: 71 },
    { tier: 3, key: '部分活动需协助', min: 45, max: 57 },
    { tier: 4, key: '多数活动需协助', min: 0, max: 44 },
  ],
  preQuestions: [],
  minItems: 2,
};
