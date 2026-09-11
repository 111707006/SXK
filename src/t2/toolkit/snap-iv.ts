/**
 * SNAP-IV　SNAP-IV 评量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`04_注意力与执行功能/SNAP-IV评量表_森心康院内实施版.html`（sha256 d025fe019f69…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const SNAP_IV: ToolkitBank = {
  id: 'snap-iv',
  code: 'SNAP-IV',
  title: 'SNAP-IV 评量表',
  source: { file: '04_注意力与执行功能/SNAP-IV评量表_森心康院内实施版.html', sha256: 'd025fe019f6942161e2d7b3638395b735b9e8a0dc9110b796a7c859867fef070' },
  options: [
    { value: 0, label: '完全没有' },
    { value: 1, label: '有一点点' },
    { value: 2, label: '蛮多的' },
    { value: 3, label: '非常多' },
  ],
  sections: [
    {
      key: 'IA',
      name: '注意力不足',
      items: [
        { no: 1, sourceNo: 1, text: '无法专注于细节的部分，或在做学校作业或其他活动时，出现粗心的错误', startMonth: null },
        { no: 2, sourceNo: 2, text: '很难持续专注于工作或游戏活动', startMonth: null },
        { no: 3, sourceNo: 3, text: '看起来好像没有在听别人对他（她）说话的内容', startMonth: null },
        { no: 4, sourceNo: 4, text: '没有办法遵循指示，也无法完成学校作业或家事（并不是由于对立性行为或无法了解指示的内容）', startMonth: null },
        { no: 5, sourceNo: 5, text: '组织规划工作及活动有困难', startMonth: null },
        { no: 6, sourceNo: 6, text: '逃避，或表达不愿意，或有困难于需要持续性动脑的工作（例如学校作业或家庭作业）', startMonth: null },
        { no: 7, sourceNo: 7, text: '会弄丢工作上或活动所必须的东西（例如学校作业、铅笔、书、工具或玩具）', startMonth: null },
        { no: 8, sourceNo: 8, text: '很容易受外在刺激影响而分心', startMonth: null },
        { no: 9, sourceNo: 9, text: '在日常生活中忘东忘西的', startMonth: null },
      ],
    },
    {
      key: 'HI',
      name: '过动与冲动',
      items: [
        { no: 1, sourceNo: 10, text: '在座位上玩弄手脚或不好好坐着', startMonth: null },
        { no: 2, sourceNo: 11, text: '在教室或其他必须持续坐着的场合，会任意离开座位', startMonth: null },
        { no: 3, sourceNo: 12, text: '在不适当的场合，乱跑或爬高爬低', startMonth: null },
        { no: 4, sourceNo: 13, text: '很难安静地玩或参与休闲活动', startMonth: null },
        { no: 5, sourceNo: 14, text: '总是一直在动或是像被马达所驱动', startMonth: null },
        { no: 6, sourceNo: 15, text: '话很多', startMonth: null },
        { no: 7, sourceNo: 16, text: '在问题还没问完前就急着回答', startMonth: null },
        { no: 8, sourceNo: 17, text: '在游戏中或团体活动中，无法排队或等待轮流', startMonth: null },
        { no: 9, sourceNo: 18, text: '打断或干扰别人（例如：插嘴或打断别人的游戏）', startMonth: null },
      ],
    },
    {
      key: 'OD',
      name: '对立违抗',
      items: [
        { no: 1, sourceNo: 19, text: '发脾气', startMonth: null },
        { no: 2, sourceNo: 20, text: '与大人争论', startMonth: null },
        { no: 3, sourceNo: 21, text: '主动地反抗或拒绝大人的要求与规定', startMonth: null },
        { no: 4, sourceNo: 22, text: '故意地做一些事去干扰别人', startMonth: null },
        { no: 5, sourceNo: 23, text: '因自己犯的错或不适当的行为而怪罪别人', startMonth: null },
        { no: 6, sourceNo: 24, text: '易怒的或很容易被别人激怒', startMonth: null },
        { no: 7, sourceNo: 25, text: '生气的及怨恨的', startMonth: null },
        { no: 8, sourceNo: 26, text: '恶意的或有报复心的', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '低于参考点', max: 1.2 },
    { tier: 2, key: '高于关注参考点', min: 1.2, max: 1.8 },
    { tier: 3, key: '高于诊断参考点', min: 1.8 },
  ],
  preQuestions: [],
};
