/**
 * SXK-VOC　森心康 0–3 词汇量检核表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`02_分项发展/森心康0-3词汇量检核表_SXK-VOC.html`（sha256 34c5ba4efab2…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_VOC: ToolkitBank = {
  id: 'sxk-voc',
  code: 'SXK-VOC',
  title: '森心康 0–3 词汇量检核表',
  source: { file: '02_分项发展/森心康0-3词汇量检核表_SXK-VOC.html', sha256: '34c5ba4efab281a130794118dc74c562a20224d6219eeaffd6fb75f915306b55' },
  options: [
    { value: 2, label: '已经会' },
    { value: 1, label: '偶尔会' },
    { value: 0, label: '还不会' },
  ],
  sections: [
    {
      key: 'V1',
      name: '理解词汇',
      items: [
        { no: 1, text: '听到自己的名字有反应', startMonth: 8 },
        { no: 2, text: '听得懂「不可以」', startMonth: 10 },
        { no: 3, text: '听得懂「爸爸」「妈妈」', startMonth: 10 },
        { no: 4, text: '能指认三种常见物品', startMonth: 15 },
        { no: 5, text: '听得懂常见动作词（吃、喝、抱）', startMonth: 15 },
        { no: 6, text: '听得懂十个以上的词', startMonth: 15 },
        { no: 7, text: '能指认五个以上物品', startMonth: 18 },
        { no: 8, text: '能指认身体部位', startMonth: 18 },
        { no: 9, text: '能指认图片中的物品', startMonth: 18 },
        { no: 10, text: '听得懂家中常见地点', startMonth: 20 },
      ],
    },
    {
      key: 'V2',
      name: '表达词汇',
      items: [
        { no: 1, text: '会用声音表达需求', startMonth: 9 },
        { no: 2, text: '会说第一个有意义的词', startMonth: 14 },
        { no: 3, text: '会说三个以上的词', startMonth: 16 },
        { no: 4, text: '会说五个以上的词', startMonth: 17 },
        { no: 5, text: '会说十个以上的词', startMonth: 18 },
        { no: 6, text: '会说二十个以上的词', startMonth: 21 },
        { no: 7, text: '会说五十个以上的词', startMonth: 24 },
        { no: 8, text: '会把两个词组起来', startMonth: 24 },
        { no: 9, text: '会说一百个以上的词', startMonth: 30 },
        { no: 10, text: '会说三个词的句子', startMonth: 33 },
      ],
    },
    {
      key: 'V3',
      name: '词类广度',
      items: [
        { no: 1, text: '会说人的称呼（爸爸、妈妈、阿姨）', startMonth: 14 },
        { no: 2, text: '会说食物的名称', startMonth: 18 },
        { no: 3, text: '会说日常用品的名称', startMonth: 18 },
        { no: 4, text: '会说身体部位的名称', startMonth: 20 },
        { no: 5, text: '会说动物的名称', startMonth: 20 },
        { no: 6, text: '会说动作词（抱、吃、走）', startMonth: 20 },
        { no: 7, text: '会说形容词（大、热、好吃）', startMonth: 26 },
        { no: 8, text: '会说方位词（上面、里面）', startMonth: 30 },
        { no: 9, text: '会说「我」「你」', startMonth: 30 },
        { no: 10, text: '会说数字或数量词', startMonth: 30 },
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
