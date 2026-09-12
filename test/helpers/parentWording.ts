/**
 * 家長端禁字清單的轉接：清單本身 2026-09-12 搬到 `src/utils/parentWording.ts`。
 *
 * 搬家的理由：#55 的報告驗證器要在**正式路徑**上擋禁字（AI 回來的 JSON、模板產出的
 * 段落），不能只在測試裡擋。同一份清單兩份副本就是兩份各自漏字的機會 ——
 * 所以清單留在 `src/`，這一檔只轉出去，讓既有的兩支測試（`parentWording.structure.test.ts`、
 * `reportWording.http.test.ts`）的 import 路徑不動。
 */
export { ALLOWED_PHRASES, BANNED_WORDS, findBannedWords } from '../../src/utils/parentWording';
