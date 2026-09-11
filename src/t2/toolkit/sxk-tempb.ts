/**
 * SXK-TEMPb　森心康 3–7 岁气质量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`07_气质/森心康3-7岁气质量表_SXK-TEMPb.html`（sha256 4fdb26aea23f…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_TEMPB: ToolkitBank = {
  id: 'sxk-tempb',
  code: 'SXK-TEMPb',
  title: '森心康 3–7 岁气质量表',
  source: { file: '07_气质/森心康3-7岁气质量表_SXK-TEMPb.html', sha256: '4fdb26aea23fcd8dee01083539bd5f86ab4d6a479c1176d307cd9501dcc31e43' },
  options: [
    { value: 5, label: '非常符合' },
    { value: 4, label: '符合' },
    { value: 3, label: '有点符合' },
    { value: 2, label: '有点不符合' },
    { value: 1, label: '不符合' },
    { value: 0, label: '非常不符合' },
  ],
  sections: [
    {
      key: 'D1',
      name: '活动量',
      items: [
        { no: 1, text: '整天动来动去，很少安静下来', startMonth: null },
        { no: 2, text: '吃饭时身体会一直动', startMonth: null },
        { no: 3, text: '看书或画画时坐不住', startMonth: null },
        { no: 4, text: '出门后精力旺盛不容易累', startMonth: null },
        { no: 5, text: '睡觉时翻来覆去', startMonth: null },
        { no: 6, text: '喜欢跑跳胜过静态活动', startMonth: null },
        { no: 7, text: '等待时会走来走去', startMonth: null },
        { no: 8, text: '被要求坐好时很快就动起来', startMonth: null },
      ],
    },
    {
      key: 'D2',
      name: '规律性',
      items: [
        { no: 1, text: '每天吃饭时间差很多', startMonth: null },
        { no: 2, text: '每天睡觉时间不固定', startMonth: null },
        { no: 3, text: '肚子饿的时间不规律', startMonth: null },
        { no: 4, text: '大小便时间不固定', startMonth: null },
        { no: 5, text: '作息被打乱后不易恢复', startMonth: null },
        { no: 6, text: '午睡时间长短差异大', startMonth: null },
        { no: 7, text: '每天食量起伏大', startMonth: null },
        { no: 8, text: '醒来的时间不固定', startMonth: null },
      ],
    },
    {
      key: 'D3',
      name: '趋避性',
      items: [
        { no: 1, text: '第一次去新地方会退缩', startMonth: null },
        { no: 2, text: '遇到陌生人会躲到大人身后', startMonth: null },
        { no: 3, text: '新玩具要观察很久才碰', startMonth: null },
        { no: 4, text: '第一次尝试新食物会拒绝', startMonth: null },
        { no: 5, text: '新活动一开始就说不要', startMonth: null },
        { no: 6, text: '换新老师或同学会不安', startMonth: null },
        { no: 7, text: '第一次上台或表演会抗拒', startMonth: null },
        { no: 8, text: '新衣服新鞋子一开始不肯穿', startMonth: null },
      ],
    },
    {
      key: 'D4',
      name: '适应度',
      items: [
        { no: 1, text: '换新活动需要很长时间才进入状况', startMonth: null },
        { no: 2, text: '对陌生人需要很久才愿意互动', startMonth: null },
        { no: 3, text: '环境改变后要很久才安定', startMonth: null },
        { no: 4, text: '接受新规则需要反复练习', startMonth: null },
        { no: 5, text: '换照顾者时适应期长', startMonth: null },
        { no: 6, text: '出去玩后回家要很久才收心', startMonth: null },
        { no: 7, text: '新食物要尝试很多次才接受', startMonth: null },
        { no: 8, text: '学期开始时适应特别慢', startMonth: null },
      ],
    },
    {
      key: 'D5',
      name: '反应强度',
      items: [
        { no: 1, text: '开心时反应很大声、很明显', startMonth: null },
        { no: 2, text: '生气时反应很激烈', startMonth: null },
        { no: 3, text: '不舒服时会强烈表达', startMonth: null },
        { no: 4, text: '受挫时哭得很久很大声', startMonth: null },
        { no: 5, text: '兴奋时难以自我控制', startMonth: null },
        { no: 6, text: '惊吓反应特别大', startMonth: null },
        { no: 7, text: '喜欢的东西表现得非常热烈', startMonth: null },
        { no: 8, text: '讨厌的东西表达得非常明确', startMonth: null },
      ],
    },
    {
      key: 'D6',
      name: '情绪本质',
      items: [
        { no: 1, text: '多数时候看起来不太开心', startMonth: null },
        { no: 2, text: '常常抱怨或不满', startMonth: null },
        { no: 3, text: '笑容比同龄孩子少', startMonth: null },
        { no: 4, text: '遇到事情先看到负面', startMonth: null },
        { no: 5, text: '容易觉得别人对他不好', startMonth: null },
        { no: 6, text: '需要哄很久才开心', startMonth: null },
        { no: 7, text: '对新事物先表示厌烦', startMonth: null },
        { no: 8, text: '一天中不愉快的时间较多', startMonth: null },
      ],
    },
    {
      key: 'D7',
      name: '坚持度',
      items: [
        { no: 1, text: '一件事做不好会一直重试不放弃', startMonth: null },
        { no: 2, text: '被打断正在做的事会很不满', startMonth: null },
        { no: 3, text: '想要的东西会坚持很久', startMonth: null },
        { no: 4, text: '拼图或积木会做到完成为止', startMonth: null },
        { no: 5, text: '被拒绝后还会一直要求', startMonth: null },
        { no: 6, text: '学新技能时愿意反复练习', startMonth: null },
        { no: 7, text: '自己决定的事很难被劝退', startMonth: null },
        { no: 8, text: '专注在有兴趣的事上时间很长', startMonth: null },
      ],
    },
    {
      key: 'D8',
      name: '注意分散度',
      items: [
        { no: 1, text: '做事时旁边有动静就分心', startMonth: null },
        { no: 2, text: '哭闹时容易被别的东西转移', startMonth: null },
        { no: 3, text: '听人说话时容易看向别处', startMonth: null },
        { no: 4, text: '吃饭时会被电视或声音吸引', startMonth: null },
        { no: 5, text: '写作业需要人在旁边才不分心', startMonth: null },
        { no: 6, text: '玩到一半会跑去看别的', startMonth: null },
        { no: 7, text: '在人多的地方无法专心', startMonth: null },
        { no: 8, text: '交代的事听到一半就忘', startMonth: null },
      ],
    },
    {
      key: 'D9',
      name: '反应阈',
      items: [
        { no: 1, text: '对声音、光线或气味特别敏锐', startMonth: null },
        { no: 2, text: '衣服稍微不舒服就察觉', startMonth: null },
        { no: 3, text: '环境有一点改变马上发现', startMonth: null },
        { no: 4, text: '食物味道稍有不同就发现', startMonth: null },
        { no: 5, text: '能察觉大人情绪的细微变化', startMonth: null },
        { no: 6, text: '温度稍有变化就有反应', startMonth: null },
        { no: 7, text: '对触感的细微差别很敏感', startMonth: null },
        { no: 8, text: '轻微的疼痛就有明显反应', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '两端之间', max: 0.42 },
    { tier: 2, key: '稍偏', min: 0.42, max: 1 },
    { tier: 3, key: '明显偏', min: 1 },
  ],
  preQuestions: [],
};
