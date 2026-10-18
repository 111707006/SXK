/**
 * T1 180 題的逐題通過率表：「這個月齡約幾成孩子做得到」（#68，規格 docs/specs/client-changes-2026-10-17.md §3.2；
 * CONTEXT.md「同齡估算」）。發育指數（`developmentIndex.ts`）用它推估同月齡孩子總分的分布。
 *
 * **只給伺服器與測試**：家長端不 import（`test/developmentIndex.structure.test.ts` 從 `src/main.tsx` 走一遍 import 擋）。
 * 這不是 T1 自己的常模 —— T1 是客戶自建的題組，沒有常模；這裡是借來的推估，每題記下借的是哪一種。
 *
 * 【來源，依優先順序】
 * 1. `denver`：題目對得上丹佛 II 項目的，用 Denver II-Jimma 的月齡常模（25／50／75／90％ 的孩子做得到的月齡）。
 *    Abessa TG, Worku BN, Kibebew MW, et al. Adaptation and standardization of a Western tool for assessing child
 *    development in non-Western low-income context. *BMC Public Health*. 2016;16:652. doi:10.1186/s12889-016-3288-2
 *    （PMC4964036，Table 3）。授權 **CC BY 4.0**（https://creativecommons.org/licenses/by/4.0/）。
 *    更動：原表有些小數點寫成逗號（「13,5」）或多一個逗號（「1.,8」），這裡改回小數點；數字本身不改。
 *    原文逐格抄在 `test/fixtures/denver-ii-jimma-table3.tsv`，測試逐格對。
 * 2. `cdc`：其次用 CDC「Learn the Signs. Act Early.」發展里程碑（2022 年修訂版，每一條是 **75％ 以上**的孩子在該月齡
 *    做得到的事；Zubler JM, et al. *Pediatrics*. 2022;149(3):e2021052138）。`milestone` 是 cdc.gov 該月齡頁面的原文
 *    （2026-10-18 讀）。只有一個月齡點，曲線形狀借用這張表丹佛題目的月齡比例（見 `developmentIndex.ts`）。
 * 3. `ai`：都對不上的（D、E 段全部，與各段感覺、情緒、注意力的大多數）由 AI 判斷，直接寫段頭、段尾兩個月齡的機率，
 *    **沒有依據**。
 *
 * 【已知限制】（不寫在畫面上）
 * - 計算假設 36 題彼此獨立：同一個孩子的作答其實高度相關，所以算出來的分布太窄、尾巴太薄，
 *   低分的孩子容易被判得比實際更低。年齡段最大月齡時最明顯：多數題的 p 已接近上限，例如 23 個月
 *   九題「有时」、其餘做得到（63／72）就只有 75；同一份作答在段頭（12 個月）是 100。
 * - 丹佛常模來自衣索比亞 Jimma 的樣本，不是中國孩子；有些項目在當地明顯較早或較晚（原表註 e／f）。
 * - 對應是「大致相同的能力」，不是同一道題：T1 是家長回報，丹佛是施測者當面看；T1 一題常含兩件事
 *   （「…或…」「…、…」），取的是比較對得上、或比較難的那一件，`note` 寫出差別。
 * - `ai` 來源的題沒有依據；「跟得上年級」「與同齡相當」這類題照字面就是多數孩子做得到，給的是 0.75–0.88 的平台。
 */

export type PassRateSource = 'denver' | 'cdc' | 'ai';

interface RowBase {
  /** `t1Data.ts` 的題目 id。 */
  questionId: string;
  /** 對應上的差別、取捨。 */
  note?: string;
}

export interface DenverRow extends RowBase {
  source: 'denver';
  /** Jimma Table 3 的項目代號與英文名稱（去掉註腳字母）。 */
  code: string;
  item: string;
  /** 25／50／75／90％ 的孩子做得到的月齡（Table 3 的四欄）。 */
  ages: readonly [number, number, number, number];
}

export interface CdcRow extends RowBase {
  source: 'cdc';
  /** CDC 里程碑所在的月齡頁面（75％ 以上的孩子做得到）。 */
  ageMonths: number;
  /** cdc.gov 原文。 */
  milestone: string;
}

export interface AiRow extends RowBase {
  source: 'ai';
  /** 年齡段最小月齡、最大月齡時約幾成孩子做得到。 */
  atMin: number;
  atMax: number;
}

export type PassRateRow = DenverRow | CdcRow | AiRow;

const denver = (questionId: string, code: string, item: string, ages: DenverRow['ages'], note?: string): DenverRow =>
  ({ questionId, source: 'denver', code, item, ages, ...(note ? { note } : {}) });
const cdc = (questionId: string, ageMonths: number, milestone: string, note?: string): CdcRow =>
  ({ questionId, source: 'cdc', ageMonths, milestone, ...(note ? { note } : {}) });
const ai = (questionId: string, atMin: number, atMax: number, note?: string): AiRow =>
  ({ questionId, source: 'ai', atMin, atMax, ...(note ? { note } : {}) });

export const T1_PASS_RATES: readonly PassRateRow[] = [
  // ---- A 段 12–23 個月 ----
  denver('t1_a_01', 'GM17', 'Walk well', [11.3, 13.1, 14.9, 16.7]),
  denver('t1_a_02', 'GM19', 'Runs', [14.4, 16.6, 18.9, 21.2], '「很少跌倒」丹佛不另外看'),
  denver('t1_a_03', 'GM16', 'Stoop and recover', [11.6, 13.2, 14.8, 16.4]),
  denver('t1_a_04', 'GM20', 'Walk up steps', [13.9, 16.9, 19.6, 22.3], '題目是「上楼梯，或把球往前踢」，取較早的上樓梯（踢球 GM21 較晚）'),
  ai('t1_a_05', 0.8, 0.85, '質地挑食常見，多數不嚴重'),
  ai('t1_a_06', 0.8, 0.85),
  ai('t1_a_07', 0.92, 0.93),
  ai('t1_a_08', 0.85, 0.88),
  denver('t1_a_09', 'PS11', 'Imitate activities', [9.7, 11.6, 13.4, 15.2]),
  cdc('t1_a_10', 12, 'Looks for things he sees you hide, like a toy under a blanket'),
  cdc('t1_a_11', 15, 'Tries to use things the right way, like a phone, cup, or book'),
  denver('t1_a_12', 'FM14', 'Put block in cup', [8.7, 10.2, 11.7, 13.1], '「或形状配对」較難，取放積木'),
  cdc('t1_a_13', 9, 'Looks when you call her name'),
  ai('t1_a_14', 0.65, 0.85, '專注時間隨月齡拉長'),
  ai('t1_a_15', 0.8, 0.95, '跟隨指點約 1 歲前後出現'),
  ai('t1_a_16', 0.45, 0.75, '等待是較晚的自我控制'),
  cdc('t1_a_17', 18, 'Looks at a few pages in a book with you', 'CDC 是一起看；「自己翻页」較難（30 個月 Turns book pages, one at a time）'),
  denver('t1_a_18', 'FM15', 'Scribbles', [10.7, 13.4, 16.0, 18.6]),
  denver('t1_a_19', 'FM17', 'Tower of 2 cubes', [12.6, 15.6, 18.3, 21.0], '「2–4 块」取 2 塊'),
  cdc('t1_a_20', 15, 'Copies other children while playing, like taking toys out of a container when another child does'),
  denver('t1_a_21', 'LA13', 'Dada/Mama/baba, specific', [8.8, 10.2, 11.6, 12.9]),
  denver('t1_a_22', 'LA16', '3 words', [13.5, 15.6, 17.7, 19.8], '「还会说出几个单词」取 3 個詞'),
  cdc('t1_a_23', 18, 'Follows one-step directions without any gestures, like giving you the toy when you say, “Give it to me.”'),
  cdc('t1_a_24', 15, 'Points to ask for something or to get help'),
  denver('t1_a_25', 'PS7', 'Play clapping game', [6.9, 8.1, 9.4, 10.6]),
  denver('t1_a_26', 'PS9', 'Wave bye-bye/Say good-bye', [8.2, 10.0, 11.8, 13.6]),
  ai('t1_a_27', 0.85, 0.92),
  cdc('t1_a_28', 15, 'Shows you an object she likes'),
  ai('t1_a_29', 0.85, 0.88),
  ai('t1_a_30', 0.8, 0.85),
  ai('t1_a_31', 0.95, 0.96),
  ai('t1_a_32', 0.8, 0.82),
  denver('t1_a_33', 'PS12', 'Drink from cup or glass', [9.7, 11.8, 13.9, 16.0]),
  denver('t1_a_34', 'PS14', 'Eats using spoon/fork/fingers', [11.7, 14.5, 17.2, 20.0]),
  cdc('t1_a_35', 18, 'Helps you dress him by pushing arm through sleeve or lifting up foot'),
  denver('t1_a_36', 'PS8', 'Indicate wants', [6.1, 8.1, 10.1, 12.2]),

  // ---- B 段 24–47 個月 ----
  denver('t1_b_01', 'GM19', 'Runs', [14.4, 16.6, 18.9, 21.2], '「很少跌倒」丹佛不另外看'),
  denver('t1_b_02', 'GM22', 'Jump up', [24.0, 27.0, 31.0, 35.0]),
  denver('t1_b_03', 'GM20', 'Walk up steps', [13.9, 16.9, 19.6, 22.3], '丹佛只看上樓；「上下」的下樓較晚'),
  denver('t1_b_04', 'GM25', 'Balance each foot 1 s', [23.4, 28.9, 33.0, 37.1], '取單腳站（踢球、丟球較早）'),
  ai('t1_b_05', 0.65, 0.8),
  ai('t1_b_06', 0.88, 0.9),
  ai('t1_b_07', 0.8, 0.9),
  ai('t1_b_08', 0.9, 0.92),
  cdc('t1_b_09', 30, 'Shows he knows at least one color, like pointing to a red crayon when you ask, “Which one is red?”', '丹佛 LA27 Name 1 color 要說出顏色名，比「认得」難，所以用 CDC'),
  denver('t1_b_10', 'PS16', 'Feed doll', [14.4, 19.5, 24.5, 29.7]),
  ai('t1_b_11', 0.55, 0.9, '簡單拼圖約 2–3 歲'),
  ai('t1_b_12', 0.25, 0.85, '丹佛 LA29 Count 1 block 只問一塊，不對等；點數到三約 3 歲前後'),
  cdc('t1_b_13', 60, 'Pays attention for 5 to 10 minutes during activities. For example, during story time or making arts and crafts (screen time does not count)'),
  ai('t1_b_14', 0.5, 0.75),
  ai('t1_b_15', 0.3, 0.65),
  ai('t1_b_16', 0.7, 0.8),
  ai('t1_b_17', 0.55, 0.85),
  denver('t1_b_18', 'FM20', 'Imitate vertical line', [25.9, 32.4, 37.7, 43.0], '「直线或圆圈」取直線（照樣畫圓 FM23 較晚）'),
  ai('t1_b_19', 0.45, 0.8),
  cdc('t1_b_20', 48, 'Says some words from a song, story, or nursery rhyme'),
  denver('t1_b_21', 'LA19', 'Combine words', [18.7, 21.3, 23.9, 26.4]),
  denver('t1_b_22', 'LA23', 'Speech, half understandable', [20.5, 24.2, 27.8, 31.5]),
  cdc('t1_b_23', 30, 'Follows two-step instructions like “Put the toy down and close the door.”'),
  cdc('t1_b_24', 30, 'Names things in a book when you point and ask, “What is this?”'),
  cdc('t1_b_25', 9, 'Looks when you call her name', '「眼神接触自然」CDC 不另外列'),
  cdc('t1_b_26', 30, 'Plays next to other children and sometimes plays with them'),
  ai('t1_b_27', 0.35, 0.75),
  cdc('t1_b_28', 24, 'Notices when others are hurt or upset, like pausing or looking sad when someone is crying'),
  ai('t1_b_29', 0.65, 0.8),
  ai('t1_b_30', 0.8, 0.97),
  ai('t1_b_31', 0.6, 0.8),
  cdc('t1_b_32', 30, 'Follows simple routines when told, like helping to pick up toys when you say, “It’s clean-up time.”'),
  cdc('t1_b_33', 24, 'Eats with a spoon', '「洒得不多」較嚴'),
  denver('t1_b_34', 'PS15', 'Remove garment', [15.5, 20.4, 24.5, 28.6]),
  ai('t1_b_35', 0.35, 0.85, '題目註明 3 歲後；不滿 3 歲多半答「有时」'),
  denver('t1_b_36', 'PS18', 'Wash mouth with help', [20.4, 24.8, 29.1, 33.4], '「配合洗手」較早（CDC 18 個月 Puts hands out for you to wash them）'),

  // ---- C 段 48–71 個月 ----
  denver('t1_c_01', 'GM30', 'Balance each foot 5 s', [39.2, 44.8, 50.2, 55.8], '取單腳站 5 秒（單腳跳 GM27 較早）'),
  cdc('t1_c_02', 48, 'Catches a large ball most of the time', 'CDC 是大球，不一定反彈'),
  ai('t1_c_03', 0.85, 0.9),
  ai('t1_c_04', 0.75, 0.88, '看家裡有沒有車可騎'),
  ai('t1_c_05', 0.8, 0.88),
  ai('t1_c_06', 0.82, 0.88),
  ai('t1_c_07', 0.82, 0.88),
  ai('t1_c_08', 0.82, 0.88),
  cdc('t1_c_09', 60, 'Counts to 10', 'CDC 是唱數到 10；「点数数量」略難'),
  ai('t1_c_10', 0.75, 0.93),
  denver('t1_c_11', 'LA33', 'Understand 4 prepositions', [30.8, 37.5, 44.0, 50.7]),
  cdc('t1_c_12', 30, 'Shows simple problem-solving skills, like standing on a small stool to reach something'),
  ai('t1_c_13', 0.45, 0.75, 'CDC 5 歲是 5–10 分鐘；10–15 分鐘較難'),
  ai('t1_c_14', 0.6, 0.8),
  ai('t1_c_15', 0.55, 0.7),
  cdc('t1_c_16', 60, 'Follows rules or takes turns when playing games with other children'),
  denver('t1_c_17', 'FM29', 'Copy □', [52.3, 58.2, 64.0, 69.8], '圓、十字、方形三樣都要，取最難的方形（Copy O FM23、Copy + FM25 較早）'),
  ai('t1_c_18', 0.4, 0.8, '看有沒有教過；學齡前識字差異大'),
  ai('t1_c_19', 0.4, 0.8),
  ai('t1_c_20', 0.7, 0.85),
  cdc('t1_c_21', 48, 'Talks about at least one thing that happened during her day, like “I played soccer.”'),
  denver('t1_c_22', 'LA32', 'Speech all understandable', [28.4, 36.3, 44.0, 51.8]),
  ai('t1_c_23', 0.6, 0.85),
  cdc('t1_c_24', 60, 'Tells a story she heard or made up with at least two events. For example, a cat was stuck in a tree and a firefighter saved it'),
  denver('t1_c_25', 'PS23', 'Play social games', [31.8, 41.6, 51.2, 60.9], '取「合作游戏」；有能叫得出名字的玩伴（PS20）較早'),
  cdc('t1_c_26', 60, 'Follows rules or takes turns when playing games with other children'),
  cdc('t1_c_27', 48, 'Pretends to be something else during play (teacher, superhero, dog)'),
  ai('t1_c_28', 0.75, 0.9),
  ai('t1_c_29', 0.5, 0.7),
  ai('t1_c_30', 0.65, 0.85),
  ai('t1_c_31', 0.85, 0.88),
  ai('t1_c_32', 0.7, 0.8),
  denver('t1_c_33', 'PS22', 'Dress, no help', [43.9, 50.5, 57.0, 63.5]),
  ai('t1_c_34', 0.8, 0.92),
  denver('t1_c_35', 'PS13', 'Help in house', [12.9, 15.9, 18.4, 20.9]),
  cdc('t1_c_36', 36, 'Avoids touching hot objects, like a stove, when you warn her', '「过马路」的規則較晚'),

  // ---- D 段 72–119 個月（全部 ai：CDC 里程碑只到 5 歲，丹佛只到 6 歲）----
  ai('t1_d_01', 0.85, 0.85, '「与同龄相当」照字面多數做得到'),
  ai('t1_d_02', 0.55, 0.9, '6 歲多半還在學，10 歲大多會'),
  ai('t1_d_03', 0.7, 0.85),
  ai('t1_d_04', 0.85, 0.87),
  ai('t1_d_05', 0.85, 0.87),
  ai('t1_d_06', 0.85, 0.87),
  ai('t1_d_07', 0.85, 0.88),
  ai('t1_d_08', 0.8, 0.95),
  ai('t1_d_09', 0.82, 0.82, '「跟得上年级」照字面多數做得到'),
  ai('t1_d_10', 0.85, 0.9),
  ai('t1_d_11', 0.7, 0.88),
  ai('t1_d_12', 0.6, 0.95, '看鐘錶約小一、小二學'),
  ai('t1_d_13', 0.7, 0.78),
  ai('t1_d_14', 0.6, 0.7, '作業拖拉在學齡孩子很常見'),
  ai('t1_d_15', 0.6, 0.7),
  ai('t1_d_16', 0.65, 0.8),
  ai('t1_d_17', 0.82, 0.82),
  ai('t1_d_18', 0.75, 0.85),
  ai('t1_d_19', 0.55, 0.8),
  ai('t1_d_20', 0.8, 0.82),
  ai('t1_d_21', 0.65, 0.88),
  ai('t1_d_22', 0.75, 0.88),
  ai('t1_d_23', 0.7, 0.88),
  ai('t1_d_24', 0.78, 0.82),
  ai('t1_d_25', 0.75, 0.85),
  ai('t1_d_26', 0.75, 0.9),
  ai('t1_d_27', 0.6, 0.88),
  ai('t1_d_28', 0.45, 0.7),
  ai('t1_d_29', 0.5, 0.72),
  ai('t1_d_30', 0.85, 0.85),
  ai('t1_d_31', 0.65, 0.8),
  ai('t1_d_32', 0.7, 0.82),
  ai('t1_d_33', 0.75, 0.95),
  ai('t1_d_34', 0.45, 0.75),
  ai('t1_d_35', 0.5, 0.75),
  ai('t1_d_36', 0.55, 0.75),

  // ---- E 段 120–180 個月（全部 ai）----
  ai('t1_e_01', 0.85, 0.85, '「与同龄相当」照字面多數做得到'),
  ai('t1_e_02', 0.75, 0.85),
  ai('t1_e_03', 0.78, 0.85),
  ai('t1_e_04', 0.82, 0.82),
  ai('t1_e_05', 0.87, 0.88),
  ai('t1_e_06', 0.86, 0.88),
  ai('t1_e_07', 0.65, 0.8),
  ai('t1_e_08', 0.7, 0.8),
  ai('t1_e_09', 0.75, 0.75),
  ai('t1_e_10', 0.5, 0.75),
  ai('t1_e_11', 0.82, 0.82),
  ai('t1_e_12', 0.65, 0.75),
  ai('t1_e_13', 0.65, 0.75),
  ai('t1_e_14', 0.5, 0.65, '拖延在青少年很常見'),
  ai('t1_e_15', 0.4, 0.7),
  ai('t1_e_16', 0.6, 0.8),
  ai('t1_e_17', 0.75, 0.75),
  ai('t1_e_18', 0.8, 0.82),
  ai('t1_e_19', 0.65, 0.8),
  ai('t1_e_20', 0.35, 0.65),
  ai('t1_e_21', 0.55, 0.8),
  ai('t1_e_22', 0.75, 0.92),
  ai('t1_e_23', 0.78, 0.78),
  ai('t1_e_24', 0.85, 0.9),
  ai('t1_e_25', 0.75, 0.8),
  ai('t1_e_26', 0.7, 0.85),
  ai('t1_e_27', 0.7, 0.6, '年紀越大，網路社交偏多的孩子越多'),
  ai('t1_e_28', 0.8, 0.7, '青春期與大人的衝突變多'),
  ai('t1_e_29', 0.65, 0.75),
  ai('t1_e_30', 0.85, 0.8),
  ai('t1_e_31', 0.65, 0.55, '青春期較不願意跟大人談'),
  ai('t1_e_32', 0.9, 0.85),
  ai('t1_e_33', 0.55, 0.8),
  ai('t1_e_34', 0.45, 0.75),
  ai('t1_e_35', 0.55, 0.9),
  ai('t1_e_36', 0.6, 0.7),
];
