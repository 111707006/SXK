/**
 * SXK-ASB　森心康自闭行为量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`03_社交沟通/森心康自闭行为量表_SXK-ASB.html`（sha256 f364a8970b01…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ASB: ToolkitBank = {
  id: 'sxk-asb',
  code: 'SXK-ASB',
  title: '森心康自闭行为量表',
  source: { file: '03_社交沟通/森心康自闭行为量表_SXK-ASB.html', sha256: 'f364a8970b018cc0839192d79123c8c4576f346e804fd08590d3510c636741d4' },
  options: [
    { value: 0, label: '很少或没有' },
    { value: 1, label: '偶尔' },
    { value: 2, label: '经常' },
    { value: 3, label: '总是' },
  ],
  sections: [
    {
      key: 'SE',
      name: '感觉反应',
      items: [
        { no: 1, text: '对声音过度反应或完全无反应', startMonth: null },
        { no: 2, text: '对疼痛反应异常', startMonth: null },
        { no: 3, text: '长时间盯着旋转或闪烁的东西', startMonth: null },
        { no: 4, text: '喜欢闻或舔非食物的东西', startMonth: null },
        { no: 5, text: '对某些材质强烈抗拒', startMonth: null },
        { no: 6, text: '对光线特别敏感', startMonth: null },
        { no: 7, text: '喜欢用眼角余光看东西', startMonth: null },
        { no: 8, text: '对温度变化反应异常', startMonth: null },
        { no: 9, text: '喜欢反复触摸特定表面', startMonth: null },
        { no: 10, text: '听到特定声音会摀耳', startMonth: null },
        { no: 11, text: '对食物质地极度挑剔', startMonth: null },
        { no: 12, text: '喜欢制造并聆听特定声响', startMonth: null },
      ],
    },
    {
      key: 'RE',
      name: '人际关系',
      items: [
        { no: 1, text: '很少主动与人互动', startMonth: null },
        { no: 2, text: '眼神接触短暂或回避', startMonth: null },
        { no: 3, text: '对呼唤没有反应', startMonth: null },
        { no: 4, text: '不会主动分享有趣的事', startMonth: null },
        { no: 5, text: '对他人情绪没有反应', startMonth: null },
        { no: 6, text: '喜欢独处胜过与人相处', startMonth: null },
        { no: 7, text: '很难与同龄孩子建立关系', startMonth: null },
        { no: 8, text: '把大人当工具使用（拉手去拿）', startMonth: null },
        { no: 9, text: '对熟人与陌生人反应无差别', startMonth: null },
        { no: 10, text: '不会寻求安慰', startMonth: null },
        { no: 11, text: '很少模仿他人', startMonth: null },
        { no: 12, text: '对表情或语气变化不敏感', startMonth: null },
      ],
    },
    {
      key: 'BO',
      name: '身体与动作',
      items: [
        { no: 1, text: '出现重复的手部动作', startMonth: null },
        { no: 2, text: '身体前后摇晃或旋转', startMonth: null },
        { no: 3, text: '踮脚走路', startMonth: null },
        { no: 4, text: '走路姿势特别', startMonth: null },
        { no: 5, text: '长时间维持特定姿势', startMonth: null },
        { no: 6, text: '对物品做重复动作（转、拍、排）', startMonth: null },
        { no: 7, text: '动作协调明显笨拙', startMonth: null },
        { no: 8, text: '突然的动作或跑动', startMonth: null },
        { no: 9, text: '喜欢跳跃或撞击', startMonth: null },
        { no: 10, text: '对身体部位有特殊固着', startMonth: null },
        { no: 11, text: '动作模仿困难', startMonth: null },
      ],
    },
    {
      key: 'LA',
      name: '语言沟通',
      items: [
        { no: 1, text: '没有语言或语言明显落后', startMonth: null },
        { no: 2, text: '说话像背诵或重复他人的话', startMonth: null },
        { no: 3, text: '声调平板或异常', startMonth: null },
        { no: 4, text: '代词使用混乱（你我不分）', startMonth: null },
        { no: 5, text: '很少主动说话', startMonth: null },
        { no: 6, text: '说的内容与情境无关', startMonth: null },
        { no: 7, text: '重复问同样的问题', startMonth: null },
        { no: 8, text: '不会用手势辅助表达', startMonth: null },
        { no: 9, text: '听不懂比喻或玩笑', startMonth: null },
        { no: 10, text: '对话无法维持来回', startMonth: null },
        { no: 11, text: '自言自语', startMonth: null },
        { no: 12, text: '用词过于正式或特殊', startMonth: null },
      ],
    },
    {
      key: 'SH',
      name: '自理与适应',
      items: [
        { no: 1, text: '日常流程改变时强烈抗拒', startMonth: null },
        { no: 2, text: '进食种类极度受限', startMonth: null },
        { no: 3, text: '睡眠模式异常', startMonth: null },
        { no: 4, text: '如厕训练明显困难', startMonth: null },
        { no: 5, text: '穿脱衣物学习困难', startMonth: null },
        { no: 6, text: '对危险缺乏警觉', startMonth: null },
        { no: 7, text: '情绪爆发强烈且难安抚', startMonth: null },
        { no: 8, text: '出现自伤行为', startMonth: null },
        { no: 9, text: '对特定物品有强烈依附', startMonth: null },
        { no: 10, text: '转换活动特别困难', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', min: 0, max: 22 },
    { tier: 2, key: '轻微', min: 23, max: 31 },
    { tier: 3, key: '中度', min: 32, max: 40 },
    { tier: 4, key: '明显', min: 41, max: 100 },
  ],
  preQuestions: [
    {
      key: 'regression',
      kind: 'single',
      prompt: '先请教一个问题：孩子有没有出现过能力倒退？',
      options: [
        { value: 'none', label: '没有出现倒退', exclusive: true },
        { value: 'language', label: '语言能力出现倒退（以前会说，现在不说了）' },
        { value: 'social', label: '社交能力出现倒退（以前有回应或对视，现在没有了）' },
      ],
    },
  ],
};
