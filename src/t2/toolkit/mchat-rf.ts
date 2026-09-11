/**
 * M-CHAT-R/F　改良版嬰幼兒自閉症篩查表（附後續問題修訂版）
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`01_综合筛查与官方工具/M-CHAT-RF_森心康院内实施版.html`（sha256 7127537ac29c…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const MCHAT_RF: ToolkitBank = {
  id: 'mchat-rf',
  code: 'M-CHAT-R/F',
  title: '改良版嬰幼兒自閉症篩查表（附後續問題修訂版）',
  source: { file: '01_综合筛查与官方工具/M-CHAT-RF_森心康院内实施版.html', sha256: '7127537ac29c8399dff301c061075a6a28fc3559356abb523e941030a6991cb5' },
  options: [
    { value: 'yes', label: '是' },
    { value: 'no', label: '否' },
  ],
  sections: [
    {
      key: 'all',
      name: '',
      items: [
        { no: 1, text: '如果你指向房間內的某樣物件，你的子女會注視著它嗎？（例如，你指著一個玩具或動物時，你的孩子會看著這個玩具或動物嗎？）', startMonth: null, riskAnswer: 'no' },
        { no: 2, text: '你有沒有想過你的子女可能是聾的？', startMonth: null, riskAnswer: 'yes' },
        { no: 3, text: '你的子女會玩假想遊戲嗎？（例如，假裝從空的杯子喝水，假裝打電話，假裝餵洋娃娃或毛公仔）', startMonth: null, riskAnswer: 'no' },
        { no: 4, text: '你的子女喜歡攀爬嗎？（例如，攀爬傢俱、遊樂場設施、或樓梯）', startMonth: null, riskAnswer: 'no' },
        { no: 5, text: '你的子女會在自己的眼睛附近作出一些異常的手指擺動嗎？（例如，你的子女會在自己眼睛附近擺動手指嗎？）', startMonth: null, riskAnswer: 'yes' },
        { no: 6, text: '你的子女會用一隻手指指著物件以表達需要或尋求協助嗎？（例如，指著他/她觸碰不到的小食或玩具）', startMonth: null, riskAnswer: 'no' },
        { no: 7, text: '你的子女會用一根手指指著有趣的東西向你展示嗎？（例如，指向天空中的飛機或馬路上的貨車）', startMonth: null, riskAnswer: 'no' },
        { no: 8, text: '你的子女對其他孩子感興趣嗎？（例如，你的子女會注視其他孩子、對他們笑或走近他們嗎？）', startMonth: null, riskAnswer: 'no' },
        { no: 9, text: '你的子女會純粹因與你分享而不是求幫助，而從別處把東西拿過來給你看，或是會把東西舉著讓你看嗎?（例如，給你看一朵花，一隻動物毛公仔，或是一輛玩具貨車）', startMonth: null, riskAnswer: 'no' },
        { no: 10, text: '當你叫子女的名字時，他/她會有反應嗎?（例如，當你叫子女的名字時，他/她會抬頭，說話或咿呀學語，或停止他/她正在做的事嗎?）', startMonth: null, riskAnswer: 'no' },
        { no: 11, text: '當你向子女微笑時，他/她會向你回以微笑嗎?', startMonth: null, riskAnswer: 'no' },
        { no: 12, text: '你的子女會因日常的噪音感到不安嗎?（例如，你的子女會因為吸塵機或大聲的音樂而尖叫或哭嗎？）', startMonth: null, riskAnswer: 'yes' },
        { no: 13, text: '你的子女會走路嗎?', startMonth: null, riskAnswer: 'no' },
        { no: 14, text: '當你與子女說話時，或與他/她遊戲時，或替他/她穿衣時，他/她會看著你的眼睛嗎?', startMonth: null, riskAnswer: 'no' },
        { no: 15, text: '你的子女會嘗試模仿你做的事嗎?（例如，模仿你揮手再見，鼓掌，或發出有趣的聲音?）', startMonth: null, riskAnswer: 'no' },
        { no: 16, text: '如果你轉頭去看某些東西，你的子女會周圍看看你在看什麼嗎?', startMonth: null, riskAnswer: 'no' },
        { no: 17, text: '你的孩子會嘗試令你去注視他/她嗎?（例如，他/她會因等待你的讚賞而看著你，或是會跟你說「看」、「看我」嗎？）', startMonth: null, riskAnswer: 'no' },
        { no: 18, text: '當你告訴你的子女做某事時，他/她能理解嗎?（例如，如果你不用手指指著，你的子女能理解「把書放在椅子上」或是「把毯拿給我」嗎?）', startMonth: null, riskAnswer: 'no' },
        { no: 19, text: '如果有新的事情發生，你的子女會望著你的臉，去看看你有什麼感覺嗎?（例如：如果他/她聽到一道奇怪或有趣的聲音，或是看到一件新玩具，他/她會看你的臉嗎?）', startMonth: null, riskAnswer: 'no' },
        { no: 20, text: '你的子女喜歡動態活動嗎?（例如，被你搖來搖去或坐在你膝蓋上蹦跳）', startMonth: null, riskAnswer: 'no' },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '低風險', min: 0, max: 2 },
    { tier: 2, key: '中等風險', min: 3, max: 7 },
    { tier: 3, key: '高風險', min: 8, max: 20 },
  ],
  preQuestions: [
    {
      key: 'concern',
      kind: 'boolean',
      prompt: '醫護人員或家長是否對兒童患上自閉症譜系障礙有擔心？',
      options: [
        { value: 'false', label: '否' },
        { value: 'true', label: '是' },
      ],
    },
  ],
};
