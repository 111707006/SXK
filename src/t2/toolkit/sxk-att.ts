/**
 * SXK-ATT　森心康注意力及多动量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`04_注意力与执行功能/森心康注意力及多动量表_SXK-ATT.html`（sha256 b2eca3e63f12…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ATT: ToolkitBank = {
  id: 'sxk-att',
  code: 'SXK-ATT',
  title: '森心康注意力及多动量表',
  source: { file: '04_注意力与执行功能/森心康注意力及多动量表_SXK-ATT.html', sha256: 'b2eca3e63f122e3cfd9868d1588ffb789ac5c812d78b8049f4e0bb923b046e1c' },
  options: [
    { value: 0, label: '很少或没有' },
    { value: 1, label: '偶尔' },
    { value: 2, label: '经常' },
    { value: 3, label: '总是' },
  ],
  sections: [
    {
      key: 'CL',
      name: '课堂情境',
      items: [
        { no: 1, text: '上课时东张西望', startMonth: 48 },
        { no: 2, text: '需要老师个别提醒才跟上', startMonth: 48 },
        { no: 3, text: '听讲时容易放空', startMonth: 48 },
        { no: 4, text: '课堂活动中离开座位', startMonth: 48 },
        { no: 5, text: '小组活动难以参与', startMonth: 48 },
        { no: 6, text: '听不完整老师的指令', startMonth: 48 },
        { no: 7, text: '课堂转换时特别慢', startMonth: 48 },
        { no: 8, text: '上课时与同学讲话', startMonth: 48 },
      ],
    },
    {
      key: 'HW',
      name: '作业情境',
      items: [
        { no: 1, text: '写作业需要人陪', startMonth: 60 },
        { no: 2, text: '作业时间远超同学', startMonth: 60 },
        { no: 3, text: '写到一半跑去做别的', startMonth: 60 },
        { no: 4, text: '题目看错或漏题', startMonth: 60 },
        { no: 5, text: '需要反覆确认要求', startMonth: 60 },
        { no: 6, text: '抄写时频繁抬头', startMonth: 60 },
        { no: 7, text: '订正同样的错误', startMonth: 60 },
        { no: 8, text: '作业拖到最后才做', startMonth: 60 },
      ],
    },
    {
      key: 'HM',
      name: '居家情境',
      items: [
        { no: 1, text: '交代的家务忘记做', startMonth: 36 },
        { no: 2, text: '吃饭时坐不住', startMonth: 36 },
        { no: 3, text: '洗澡睡觉流程需一直催', startMonth: 36 },
        { no: 4, text: '在家跑跳停不下来', startMonth: 36 },
        { no: 5, text: '东西随手放找不到', startMonth: 36 },
        { no: 6, text: '看电视或平板难以中断', startMonth: 36 },
        { no: 7, text: '早上准备出门特别慢', startMonth: 36 },
        { no: 8, text: '答应的事做不到', startMonth: 36 },
      ],
    },
    {
      key: 'IP',
      name: '人际情境',
      items: [
        { no: 1, text: '插话或打断别人', startMonth: 36 },
        { no: 2, text: '排队等待困难', startMonth: 36 },
        { no: 3, text: '与同伴冲突频繁', startMonth: 36 },
        { no: 4, text: '玩游戏不遵守规则', startMonth: 36 },
        { no: 5, text: '抢玩具或抢先', startMonth: 36 },
        { no: 6, text: '别人说话时没在听', startMonth: 36 },
        { no: 7, text: '情绪反应过大', startMonth: 36 },
        { no: 8, text: '难以察觉别人的反应', startMonth: 36 },
      ],
    },
    {
      key: 'SM',
      name: '自我管理',
      items: [
        { no: 1, text: '无法预估完成一件事要多久', startMonth: 48 },
        { no: 2, text: '计划好的事情做不到', startMonth: 48 },
        { no: 3, text: '情绪一来就失控', startMonth: 48 },
        { no: 4, text: '需要大人在旁才能自制', startMonth: 48 },
        { no: 5, text: '知道规则但做不到', startMonth: 48 },
        { no: 6, text: '挫折后很难重新开始', startMonth: 48 },
        { no: 7, text: '不会主动求助', startMonth: 48 },
        { no: 8, text: '对自己的表现缺乏觉察', startMonth: 48 },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', min: 0, max: 25 },
    { tier: 2, key: '轻微', min: 26, max: 33 },
    { tier: 3, key: '中度', min: 34, max: 42 },
    { tier: 4, key: '明显', min: 43, max: 100 },
  ],
  preQuestions: [
    {
      key: 'duration',
      kind: 'single',
      prompt: '先请教一个问题：这些表现出现多久了？',
      options: [
        { value: 'lt3m', label: '不到 3 个月（最近才开始）' },
        { value: '3to6m', label: '3–6 个月' },
        { value: 'gt6m', label: '超过 6 个月' },
        { value: 'always', label: '一直以来都是这样' },
      ],
    },
  ],
};
