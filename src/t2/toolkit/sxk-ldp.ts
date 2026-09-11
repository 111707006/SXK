/**
 * SXK-LDP　森心康学习障碍量表（小学版）
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`06_学习障碍/森心康学习障碍量表_小学版_SXK-LDP.html`（sha256 be873edc7304…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_LDP: ToolkitBank = {
  id: 'sxk-ldp',
  code: 'SXK-LDP',
  title: '森心康学习障碍量表（小学版）',
  source: { file: '06_学习障碍/森心康学习障碍量表_小学版_SXK-LDP.html', sha256: 'be873edc730408f40ecb213bf25ea606f07c2791e7cf32f13c91ff00db531641' },
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
        { no: 1, text: '认读拼音时容易出错，掌握得不牢', startMonth: null },
        { no: 2, text: '朗读速度偏慢，习惯一个字一个字地读', startMonth: null },
        { no: 3, text: '阅读时容易漏字、跳行，或把同一行重复读', startMonth: null },
        { no: 4, text: '听别人讲能听懂，自己读同样的内容却理解不了', startMonth: null },
        { no: 5, text: '分不清字形相近的字（如：己／已、末／未）', startMonth: null },
        { no: 6, text: '朗读时常靠猜字，或把词换成别的词念出来', startMonth: null },
      ],
    },
    {
      key: 'math',
      name: '数学方面',
      items: [
        { no: 1, text: '数数不稳，常数错或漏掉数字', startMonth: null },
        { no: 2, text: '记不住加减乘除的基本口诀', startMonth: null },
        { no: 3, text: '弄不清个位、十位、百位各代表什么', startMonth: null },
        { no: 4, text: '难以比较数的大小或把数排出顺序', startMonth: null },
        { no: 5, text: '计算时经常抄错数字或运算符号', startMonth: null },
        { no: 6, text: '对时间、钱数这类数量概念理解困难', startMonth: null },
      ],
    },
    {
      key: 'write',
      name: '书写方面',
      items: [
        { no: 1, text: '握笔姿势不正确，或握得过紧、过于用力', startMonth: null },
        { no: 2, text: '字迹潦草，别人很难认出写的是什么', startMonth: null },
        { no: 3, text: '写字速度很慢，跟不上同学的进度', startMonth: null },
        { no: 4, text: '抄写常出错，多一笔、少一笔或写成反字', startMonth: null },
        { no: 5, text: '口头说得清楚，写出来的作业却差很多', startMonth: null },
        { no: 6, text: '写字容易疲累，或明显抗拒动笔', startMonth: null },
      ],
    },
    {
      key: 'attn',
      name: '注意力方面',
      items: [
        { no: 1, text: '上课时注意力容易涣散，常常走神', startMonth: null },
        { no: 2, text: '常漏看作业的细节，或听漏交代的要求', startMonth: null },
        { no: 3, text: '很难坐住把一份作业从头做完', startMonth: null },
        { no: 4, text: '话还没说完就动手，行动比较冲动', startMonth: null },
        { no: 5, text: '作业本、书包经常乱成一团', startMonth: null },
        { no: 6, text: '常忘记当天要交的功课或该带的课本', startMonth: null },
      ],
    },
    {
      key: 'lang',
      name: '语言处理方面',
      items: [
        { no: 1, text: '会用的词明显比同龄孩子少', startMonth: null },
        { no: 2, text: '一次交代好几个步骤的指令，做起来有困难', startMonth: null },
        { no: 3, text: '分辨相近的音有困难（如：b／p、n／l）', startMonth: null },
        { no: 4, text: '说话比较零乱，不容易组成完整的句子', startMonth: null },
        { no: 5, text: '回答问题要想很久才说得出来', startMonth: null },
        { no: 6, text: '背儿歌、念韵文明显吃力', startMonth: null },
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
