/**
 * 備案號。
 *
 * 中國大陸的已備案網站必須在頁面底部標示 ICP 備案號並連回工信部查詢頁。阿里雲
 * 會抽查 —— **備案過了卻沒掛號碼，處理是要求整改乃至關停接入**，也就是說這一段
 * 不是裝飾，它跟網域能不能繼續解析是同一件事。
 *
 * 上線滿 30 日還要辦公安網備，拿到的號碼一併掛在這裡。
 *
 * 【為什麼沒設就整段不渲染】
 * 一個寫死佔位號碼的 footer 比沒有 footer 更糟：那是在網站上公開掛一個不屬於
 * 自己的備案號。未設定是一個正常狀態（本機開發、境外部署都沒有備案號），
 * 所以這裡什麼都不畫，而不是畫一個「備案號待補」。
 *
 * 【⚠️ 這兩個值是建置期常數】
 * `import.meta.env` 在 `vite build` 時就被替換成字面值，所以它們要設在**執行
 * 建置的那台機器**上，不是伺服器的 `.env`：
 *
 *   VITE_ICP_BEIAN="浙ICP备2024012345号-1" VITE_APP_MODE=full pnpm run build
 *
 * 設在伺服器的 `.env` 裡不會有任何效果，而畫面上看不出差別 —— 那正是這種錯誤
 * 難查的原因，所以寫在這裡。
 */

const ICP = (import.meta.env.VITE_ICP_BEIAN as string | undefined)?.trim();
const POLICE = (import.meta.env.VITE_POLICE_BEIAN as string | undefined)?.trim();

/** 工信部備案查詢。全國統一，不隨省份變。 */
const MIIT_URL = 'https://beian.miit.gov.cn/';

/**
 * 公安網備的查詢連結要帶純數字的備案編號。
 *
 * 號碼長得像「浙公网安备 33010502001234 号」，取中間那串數字。取不到就退成
 * 純文字不加連結 —— 連到一個查不到東西的頁面，不如不連。
 */
function policeQueryUrl(raw: string): string | null {
  const digits = raw.match(/\d{6,}/)?.[0];
  return digits ? `https://beian.mps.gov.cn/#/query/webSearch?code=${digits}` : null;
}

export function BeianFooter() {
  if (!ICP && !POLICE) return null;

  const policeUrl = POLICE ? policeQueryUrl(POLICE) : null;

  return (
    <div className="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-[10px] pt-1">
      {ICP && (
        <a
          href={MIIT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-brand-forest transition-colors"
        >
          {ICP}
        </a>
      )}
      {POLICE && (
        policeUrl ? (
          <a
            href={policeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-brand-forest transition-colors"
          >
            {POLICE}
          </a>
        ) : (
          <span>{POLICE}</span>
        )
      )}
    </div>
  );
}
