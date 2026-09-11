/**
 * SXK-ASR　森心康社交沟通行为量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`03_社交沟通/森心康社交沟通行为量表_SXK-ASR.html`（sha256 a8c68d8d88cb…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_ASR: ToolkitBank = {
  id: 'sxk-asr',
  code: 'SXK-ASR',
  title: '森心康社交沟通行为量表',
  source: { file: '03_社交沟通/森心康社交沟通行为量表_SXK-ASR.html', sha256: 'a8c68d8d88cb8b29838c8a935d8a545ede86cc01377c4ac40c6d634c8011038a' },
  options: [
    { value: 0, label: '与年龄相符' },
    { value: 1, label: '轻度不同' },
    { value: 2, label: '中度不同' },
    { value: 3, label: '明显不同' },
  ],
  sections: [
    {
      key: 'SC',
      name: '社交与沟通',
      items: [
        { no: 1, text: '与人的关系', startMonth: null, anchors: ['与同龄孩子相当，主动亲近人，也接受别人靠近', '偶尔回避眼神或身体接触，需要多一点时间才熟络', '常显得疏离，需要大人主动多次才有回应', '几乎不主动与人来往，需要强烈介入才勉强有反应'] },
        { no: 2, text: '模仿能力', startMonth: null, anchors: ['会自发模仿动作与说话，与年龄相当', '简单动作能模仿，复杂一点的需要提示', '要反复示范并给予协助才模仿得出来', '极少模仿他人的动作或声音'] },
        { no: 3, text: '情绪反应', startMonth: null, anchors: ['情绪的种类与强度与情境相称', '偶尔反应过强或过弱，但大致可以理解', '情绪常与情境不符，或转换得很突然', '情绪反应与情境明显脱节，难以被安抚或引导'] },
        { no: 4, text: '语言沟通', startMonth: null, anchors: ['语言的量与用法与年龄相当', '语言略少，或偶有仿说、代词混用', '语言明显落后，或多为仿说、内容重复', '几乎没有功能性语言，或语言无法用于沟通'] },
        { no: 5, text: '非语言沟通', startMonth: null, anchors: ['会用眼神、手势、表情表达需求', '手势与表情较少，需要提示才使用', '很少主动用非语言方式表达，多用拉手带路', '几乎不使用手势与表情，需求靠哭闹或自行取得'] },
      ],
    },
    {
      key: 'SN',
      name: '感觉反应',
      items: [
        { no: 1, text: '视觉反应', startMonth: null, anchors: ['视觉使用与年龄相当，会看人也会看物', '偶尔需要提醒才看向该看的地方', '常回避目光，或异常盯视光影、物品边缘', '视觉使用明显异常，极少与人对视'] },
        { no: 2, text: '听觉反应', startMonth: null, anchors: ['对声音的反应与年龄相当', '偶尔对呼唤反应慢，或对某些声音较敏感', '常对呼唤没反应，或对特定声音过度反应／完全忽略', '听觉反应明显异常，日常声音引发强烈反应或完全无反应'] },
        { no: 3, text: '味嗅触觉反应', startMonth: null, anchors: ['对触碰、气味、味道的反应与年龄相当', '对某些质地或气味略为挑剔', '明显回避或过度追求特定触感、气味、味道', '反应极端，已影响进食、穿衣或日常照护'] },
      ],
    },
    {
      key: 'BH',
      name: '行为与适应',
      items: [
        { no: 1, text: '身体运用', startMonth: null, anchors: ['动作协调，与年龄相当', '偶尔出现踮脚、甩手等动作，可被引开', '重复动作较频繁，或姿势明显异常', '持续出现刻板动作，打断时反应强烈'] },
        { no: 2, text: '物品运用', startMonth: null, anchors: ['会依物品的功能玩，玩法有变化', '偏好特定玩具，玩法比同龄单调', '常固定于某个部件或某种玩法（转轮子、排队）', '只以固定方式操作物品，无法引导出其他玩法'] },
        { no: 3, text: '对改变的适应', startMonth: null, anchors: ['换活动或换环境时能顺利转换', '需要预告或多一点时间才能转换', '对改变明显抗拒，转换时容易情绪起伏', '常规被打断即强烈崩溃，难以恢复'] },
        { no: 4, text: '活动量水平', startMonth: null, anchors: ['活动量与年龄、情境相当', '偶尔过动或过于安静，可被引导', '活动量明显偏高或偏低，已影响参与', '极度好动难以静下，或极度被动少有主动行为'] },
      ],
    },
    {
      key: 'GN',
      name: '情绪与整体',
      items: [
        { no: 1, text: '紧张与恐惧', startMonth: null, anchors: ['害怕的对象与程度与情境相称', '偶尔过度紧张，或对该怕的事不太怕', '常出现与情境不符的恐惧，或明显缺乏危险意识', '恐惧反应极端，或完全无视明显的危险'] },
        { no: 2, text: '能力发展的均匀度', startMonth: null, anchors: ['各方面能力发展相当均匀', '某一两项略强或略弱', '各领域落差明显，强弱不一', '能力极不均匀，某方面突出而其他明显落后'] },
        { no: 3, text: '整体印象', startMonth: null, anchors: ['整体表现与同龄孩子没有明显差异', '有一些不太一样的地方，但不影响日常', '整体上明显与同龄孩子不同', '整体表现与同龄孩子有很大差距'] },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', min: 0, max: 20 },
    { tier: 2, key: '轻微', min: 21, max: 29 },
    { tier: 3, key: '中度', min: 30, max: 38 },
    { tier: 4, key: '明显', min: 39, max: 100 },
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
