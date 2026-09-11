/**
 * SXK-SPb　森心康感觉处理记录量表（五岁以上）
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`05_感觉与生活自理/森心康感觉处理记录量表_五岁以上_SXK-SPb.html`（sha256 9e27ce8de2f2…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SXK_SPB: ToolkitBank = {
  id: 'sxk-spb',
  code: 'SXK-SPb',
  title: '森心康感觉处理记录量表（五岁以上）',
  source: { file: '05_感觉与生活自理/森心康感觉处理记录量表_五岁以上_SXK-SPb.html', sha256: '9e27ce8de2f25c19c68252932aaa147511ebceaaf5e9180d1ad7b3990b2d5b80' },
  options: [
    { value: 0, label: '很少或没有' },
    { value: 1, label: '偶尔' },
    { value: 2, label: '经常' },
    { value: 3, label: '总是' },
  ],
  sections: [
    {
      key: 'TA',
      name: '触觉',
      items: [
        { no: 1, text: '被轻轻碰到会过度反应（躲开、生气、哭）', startMonth: 60 },
        { no: 2, text: '讨厌某些衣物材质、标签或袜子接缝', startMonth: 60 },
        { no: 3, text: '不喜欢手弄脏（沙、颜料、黏土、胶水）', startMonth: 60 },
        { no: 4, text: '洗脸、剪指甲、剪头发特别抗拒', startMonth: 60 },
        { no: 5, text: '排队或人多时被碰到会不安', startMonth: 60 },
        { no: 6, text: '不喜欢被抱或被牵手', startMonth: 60 },
        { no: 7, text: '赤脚踩草地、沙滩会抗拒', startMonth: 60 },
        { no: 8, text: '对疼痛反应特别大或特别小', startMonth: 60 },
        { no: 9, text: '很喜欢用力挤压、被紧紧抱住', startMonth: 60 },
        { no: 10, text: '不停触摸经过的东西', startMonth: 60 },
        { no: 11, text: '穿衣时坚持只穿某几件', startMonth: 60 },
        { no: 12, text: '洗澡水温稍有变化就抗议', startMonth: 60 },
      ],
    },
    {
      key: 'VE',
      name: '前庭觉',
      items: [
        { no: 1, text: '特别怕高、怕脚离地（溜滑梯、荡秋千）', startMonth: 60 },
        { no: 2, text: '坐车、坐电梯容易不舒服或抗拒', startMonth: 60 },
        { no: 3, text: '头往后仰或倒立时特别恐惧', startMonth: 60 },
        { no: 4, text: '走不平的地面会格外小心或拒绝', startMonth: 60 },
        { no: 5, text: '非常爱旋转、跳动而不觉得晕', startMonth: 60 },
        { no: 6, text: '喜欢从高处往下跳', startMonth: 60 },
        { no: 7, text: '经常动来动去、无法安静坐着', startMonth: 60 },
        { no: 8, text: '转圈后不会晕眩', startMonth: 60 },
        { no: 9, text: '平衡动作明显比同龄吃力', startMonth: 60 },
        { no: 10, text: '上下楼梯需要扶或看脚步', startMonth: 60 },
        { no: 11, text: '单脚站立很难维持', startMonth: 60 },
        { no: 12, text: '跑步时容易跌倒', startMonth: 60 },
      ],
    },
    {
      key: 'PR',
      name: '本体觉',
      items: [
        { no: 1, text: '写字或拿东西力道控制不好（太用力或太轻）', startMonth: 60 },
        { no: 2, text: '经常撞到人或家具', startMonth: 60 },
        { no: 3, text: '动作显得笨拙、不协调', startMonth: 60 },
        { no: 4, text: '喜欢重压、钻进狭小空间', startMonth: 60 },
        { no: 5, text: '坐姿容易软趴，需要靠着或趴着', startMonth: 60 },
        { no: 6, text: '喜欢咬、啃、推重物', startMonth: 60 },
        { no: 7, text: '玩游戏时下手过重不自知', startMonth: 60 },
        { no: 8, text: '拿易碎物品常弄坏', startMonth: 60 },
        { no: 9, text: '爬上爬下时不太注意身体位置', startMonth: 60 },
        { no: 10, text: '模仿动作时姿势不准确', startMonth: 60 },
        { no: 11, text: '长时间维持同一姿势很吃力', startMonth: 60 },
      ],
    },
    {
      key: 'AU',
      name: '听觉',
      items: [
        { no: 1, text: '对突然的声音（吸尘器、烘手机）过度反应', startMonth: 60 },
        { no: 2, text: '在吵杂环境中特别难专注或容易烦躁', startMonth: 60 },
        { no: 3, text: '会摀住耳朵', startMonth: 60 },
        { no: 4, text: '常常叫他没反应，但对小声音又很敏感', startMonth: 60 },
        { no: 5, text: '害怕特定的声音（打雷、气球、警报）', startMonth: 60 },
        { no: 6, text: '需要重复说好几次才听懂', startMonth: 60 },
        { no: 7, text: '自己制造声音或反复听同一段声音', startMonth: 60 },
        { no: 8, text: '背景有声音时无法做事', startMonth: 60 },
        { no: 9, text: '在人多说话时抓不到重点', startMonth: 60 },
        { no: 10, text: '对声音方向判断不准', startMonth: 60 },
      ],
    },
    {
      key: 'VI',
      name: '视觉',
      items: [
        { no: 1, text: '对强光或阳光特别不适', startMonth: 60 },
        { no: 2, text: '在图案复杂的环境中容易分心或不安', startMonth: 60 },
        { no: 3, text: '喜欢盯着旋转、闪烁的东西看', startMonth: 60 },
        { no: 4, text: '找东西时明明在眼前却看不到', startMonth: 60 },
        { no: 5, text: '看书或抄写时容易跳行', startMonth: 60 },
        { no: 6, text: '不喜欢明亮的日光灯', startMonth: 60 },
        { no: 7, text: '喜欢从特殊角度斜看东西', startMonth: 60 },
        { no: 8, text: '对细节的辨识特别吃力', startMonth: 60 },
        { no: 9, text: '眼睛容易疲劳、揉眼', startMonth: 60 },
        { no: 10, text: '视线追随移动物体不顺', startMonth: 60 },
      ],
    },
    {
      key: 'OR',
      name: '口腔与进食',
      items: [
        { no: 1, text: '对食物质地很挑（只吃软的或只吃脆的）', startMonth: 60 },
        { no: 2, text: '尝试新食物非常困难', startMonth: 60 },
        { no: 3, text: '经常咬东西（衣领、笔、手指）', startMonth: 60 },
        { no: 4, text: '刷牙特别抗拒', startMonth: 60 },
        { no: 5, text: '吃饭时常把食物含在嘴里', startMonth: 60 },
        { no: 6, text: '对食物温度很敏感', startMonth: 60 },
        { no: 7, text: '吃东西容易作呕', startMonth: 60 },
        { no: 8, text: '偏好味道极重或极淡的食物', startMonth: 60 },
        { no: 9, text: '用吸管或杯子喝水有困难', startMonth: 60 },
        { no: 10, text: '进食速度明显过快或过慢', startMonth: 60 },
      ],
    },
    {
      key: 'RG',
      name: '调节与专注',
      items: [
        { no: 1, text: '活动一多就明显亢奋、停不下来', startMonth: 60 },
        { no: 2, text: '转换环境后需要很久才能稳定', startMonth: 60 },
        { no: 3, text: '疲劳或情绪起伏时上述表现明显加重', startMonth: 60 },
        { no: 4, text: '需要很长时间才能入睡', startMonth: 60 },
        { no: 5, text: '起床后需要很久才进入状况', startMonth: 60 },
        { no: 6, text: '一天中状态起伏很大', startMonth: 60 },
        { no: 7, text: '在新环境中特别退缩或特别亢奋', startMonth: 60 },
        { no: 8, text: '被打断后很难回到原本的活动', startMonth: 60 },
        { no: 9, text: '同时有多种刺激时会崩溃', startMonth: 60 },
        { no: 10, text: '需要固定的流程才能安定', startMonth: 60 },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '未见明显', min: 0, max: 28 },
    { tier: 2, key: '轻微', min: 29, max: 36 },
    { tier: 3, key: '中度', min: 37, max: 45 },
    { tier: 4, key: '明显', min: 46, max: 100 },
  ],
  preQuestions: [
    {
      key: 'impact',
      kind: 'multi',
      prompt: '先请教一个问题：这些反应有没有影响到日常参与？',
      options: [
        { value: 'none', label: '没有明显影响日常参与', exclusive: true },
        { value: 'adl', label: '影响生活自理（穿衣、洗澡、剪指甲、刷牙、进食）' },
        { value: 'group', label: '影响学习或园所／学校参与' },
        { value: 'play', label: '影响游戏、同伴互动或外出活动' },
      ],
    },
  ],
};
