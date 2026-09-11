/**
 * CHEXI　CHEXI 儿童执行功能量表
 *
 * 由 `scripts/t2-extract-toolkit.ts` 從 `NEWT2/森心康评估工具包_20260908.zip` 產生，**請勿手改** —— 改了下一次重跑就會被蓋掉，
 * 而且 `test/toolkit.structure.test.ts` 會比對這一份與腳本重跑的結果。
 * 來源檔：`04_注意力与执行功能/CHEXI儿童执行功能量表_森心康实施版.html`（sha256 97f82b8b54cd…）。
 * 分段只抄報告那一套（＝紙本「分數解讀」），`postMessage` 與中控台的兩套一個數字都沒有。
 */

import type { ToolkitBank } from './types';

export const CHEXI: ToolkitBank = {
  id: 'chexi',
  code: 'CHEXI',
  title: 'CHEXI 儿童执行功能量表',
  source: { file: '04_注意力与执行功能/CHEXI儿童执行功能量表_森心康实施版.html', sha256: '97f82b8b54cd0ff01b47ddd7615dad3bea3a2fb9be3564072de0e01bb94dab17' },
  options: [
    { value: 1, label: '完全不正确' },
    { value: 2, label: '不正确' },
    { value: 3, label: '部分正确' },
    { value: 4, label: '正确' },
    { value: 5, label: '完全正确' },
  ],
  sections: [
    {
      key: 'wm',
      name: '工作记忆',
      items: [
        { no: 1, sourceNo: 1, text: '難以記住一些冗長的指示。', startMonth: null },
        { no: 2, sourceNo: 3, text: '難以記得自己在活動中途做過什麼。', startMonth: null },
        { no: 3, sourceNo: 6, text: '當有數件事情要他（她）去做，他（她）只會記得第一件或最後一件事情。', startMonth: null },
        { no: 4, sourceNo: 7, text: '當他（她）被問題困擾著時，難以想出另一個方法來解答。', startMonth: null },
        { no: 5, sourceNo: 9, text: '很容易忘記別人要他／她拿什麼東西回來。', startMonth: null },
        { no: 6, sourceNo: 19, text: '難以理解用言語表達的指示，除非同時向他（她）示範怎樣做。', startMonth: null },
        { no: 7, sourceNo: 21, text: '難以預先想好未來的事或從經驗中學習。', startMonth: null },
        { no: 8, sourceNo: 23, text: '難以做一些需要動腦筋的事，例如：倒數。', startMonth: null },
        { no: 9, sourceNo: 24, text: '難以在做著其他事情時仍不忘之前要牢記的東西。', startMonth: null },
      ],
    },
    {
      key: 'pl',
      name: '计划力',
      items: [
        { no: 1, sourceNo: 12, text: '難以計劃好一項活動（例如：記得帶齊實地考察的裝備或上學所需要的東西）。', startMonth: null },
        { no: 2, sourceNo: 14, text: '難以進行一些需要多個步驟的活動（例如：年紀較幼的小孩在沒有提示下穿好衣服鞋襪；年紀較長的小孩獨自做完所有功課）。', startMonth: null },
        { no: 3, sourceNo: 17, text: '難以把一些已發生的事情述說得令其他人容易明白。', startMonth: null },
        { no: 4, sourceNo: 20, text: '難以應付一些包含多個步驟的任務或活動。', startMonth: null },
      ],
    },
    {
      key: 'ib',
      name: '抑制力',
      items: [
        { no: 1, sourceNo: 5, text: '有傾向在做事之前沒先想一想後果。', startMonth: null },
        { no: 2, sourceNo: 10, text: '當一些特別事情即將發生時（例如：出外參觀、參加派對）會異常興奮。', startMonth: null },
        { no: 3, sourceNo: 13, text: '難以抑制他（她）的活躍，儘管早已作出吩咐亦如是。', startMonth: null },
        { no: 4, sourceNo: 16, text: '難以在不適宜笑的場合忍笑。', startMonth: null },
        { no: 5, sourceNo: 18, text: '即使被喝令停止亦難以在活動中立即停下來。例如：他（她）在被喝停後總要多跳幾下或是多玩電腦一會兒。', startMonth: null },
        { no: 6, sourceNo: 22, text: '在一班小朋友當中會表現得比其他人更瘋狂（例如：生日派對上或群體活動中）。', startMonth: null },
      ],
    },
    {
      key: 'rg',
      name: '调节力',
      items: [
        { no: 1, sourceNo: 2, text: '他（她）似乎很少能自我激勵去做一些自己不喜歡做的事。', startMonth: null },
        { no: 2, sourceNo: 4, text: '難以對一些欠缺吸引力的任務堅持到底，除非有人承諾會給予獎勵。', startMonth: null },
        { no: 3, sourceNo: 8, text: '當有些事必須要完成的時候，他（她）常常會被其他更吸引的事分了心。', startMonth: null },
        { no: 4, sourceNo: 11, text: '顯然難以去做一些他（她）認為沉悶的事。', startMonth: null },
        { no: 5, sourceNo: 15, text: '他（她）一定要覺得任務有吸引力才能全神貫注。', startMonth: null },
      ],
    },
  ],
  tiers: [
    { tier: 1, key: '相对较低', max: 33 },
    { tier: 2, key: '中等', min: 34, max: 66 },
    { tier: 3, key: '相对偏高', min: 67 },
  ],
  preQuestions: [],
};
