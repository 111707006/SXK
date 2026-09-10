/**
 * 頁首與登入卡上的品牌標記。
 *
 * 專案 A 永遠是內建的字標（「森」）。專案 B 交付給多家合作公司，每一家可以在
 * 「本機構設定」掛自己的 LOGO —— 這是**唯一會顯示在家長端的公司資料**，
 * 機構名稱仍然只給後台看（見 `deploy/schema.sql` 的 `companies.name` 註解）。
 *
 * 【只換方塊裡面，不動方塊本身】
 * 兩個呼叫端的外框樣式不一樣（頁首 40×40 圓角 xl、登入卡 48×48 圓角 2xl，
 * 底色也不同）。外框留在呼叫端，這裡只負責「裡面畫字還是畫圖」。
 *
 * ⚠️ **那個格子是正方形的**，它本來是為了裝一個「森」字。合作公司要提供的因此是
 * **方形的標記**，不是完整的橫式組合（標記＋中英文兩行字）—— 後者塞進來等比縮到
 * 40px 寬，字會糊成一團。2026-09-10 拿美兆的 LOGO 實測就是這樣：圖是對的，
 * 格子不對，所以裁成只留左邊那個 M。
 *
 * 【取不到就畫字，永遠不留空白】
 * 這是家長打開網站看到的第一個東西。五種取不到 LOGO 的情況都退回字標：
 *
 *   1. 專案 A（`logoSource: 'builtin'`）—— 根本不問
 *   2. 家長沒帶進站識別碼進來（書籤、搜尋、別人轉發的乾淨連結）
 *   3. 那家公司還沒設定 LOGO
 *   4. 請求失敗或逾時
 *   5. **圖片網址壞掉** —— 這一種最容易漏：請求成功、值也拿到了，只是圖載不
 *      進來。少了 `onError`，畫面上是一塊空白。
 */
import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { peekCompanySlug } from '../utils/attribution';
import { isAllowedAssetUrl } from '../utils/assetUrl';

/**
 * 模組層級的快取。
 *
 * 頁首與登入卡是**兩個**元件，同一個畫面上可能同時出現。沒有這一層的話，
 * 每次掛載都各發一次請求 —— 拿到的還是同一個答案。
 *
 * `undefined` 代表還沒問過，`null` 代表問過了但沒有。
 */
let cached: string | null | undefined = undefined;
let inflight: Promise<string | null> | null = null;

/** 讓測試與熱重載能把快取清掉。正式流程不呼叫它。 */
export function resetCompanyLogoCache(): void {
  cached = undefined;
  inflight = null;
}

async function fetchCompanyLogo(): Promise<string | null> {
  const slug = peekCompanySlug();
  if (!slug) return null;

  try {
    const resp = await fetch(`/api/company-brand?c=${encodeURIComponent(slug)}`);
    if (!resp.ok) return null;
    const body = await resp.json();
    const url = typeof body?.logoUrl === 'string' ? body.logoUrl.trim() : '';
    // 寫入時後端已經擋過一次。讀出來再擋一次是因為這個值會直接進到
    // `<img src>` —— 資料庫裡的東西不該被當成可信輸入。
    return url && isAllowedAssetUrl(url) ? url : null;
  } catch {
    // 網路不通、JSON 壞掉、逾時 —— 對這顆標記來說都是同一件事：畫字標。
    return null;
  }
}

function loadCompanyLogo(): Promise<string | null> {
  if (cached !== undefined) return Promise.resolve(cached);
  if (!inflight) {
    inflight = fetchCompanyLogo().then(url => {
      cached = url;
      inflight = null;
      return url;
    });
  }
  return inflight;
}

/**
 * 這次要畫的 LOGO 網址；`null` 代表畫字標。
 *
 * 專案 A 直接回 `null` 且**不發任何請求** —— 它一家合作公司都沒有，
 * 而且 `/api/company-brand` 在 A 根本沒註冊，打過去會拿到 404，
 * 每個家長的主控台都紅一條。
 */
function useCompanyLogo(): string | null {
  const enabled = PRODUCT.brand.logoSource === 'company';
  const [url, setUrl] = useState<string | null>(enabled ? (cached ?? null) : null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadCompanyLogo().then(found => {
      if (alive) setUrl(found);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return url;
}

export function BrandMark() {
  const logoUrl = useCompanyLogo();
  // 圖載不進來時翻成 true，這一輪退回字標。**用狀態而不是隱藏那張 img**：
  // 隱藏起來的話方塊裡什麼都沒有，而字標是我們本來就有的退路。
  const [broken, setBroken] = useState(false);

  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        /*
          `object-contain`：格子是正方形的，非正方形的圖要完整顯示而不被裁掉。
          `p-1`：留一點內距，圖才不會頂到圓角。

          `bg-white` + `rounded-[inherit]`：**把方塊底下那層品牌綠蓋掉**。
          那顆綠方塊是森心康自己的標記（A 的綠底配「森」字就是它的字標），
          合作公司的 LOGO 貼在上面等於兩個品牌疊在一起；多數 LOGO 又是白底或
          去背的，邊緣還會露出一圈綠。有自己的 LOGO 時整顆方塊改成白底。
          圓角用 `inherit` —— 兩個呼叫端一個 `rounded-xl` 一個 `rounded-2xl`，
          繼承外框的就不必各傳一次。

          ⚠️ 這個格子是**正方形**的（它本來是為了裝一個「森」字）。企業 LOGO
          多半是橫式的（標記＋中英文兩行字），整張塞進來等比縮到 40px 寬，
          字就糊成一團。合作公司要提供的是**方形的標記**，不是完整的橫式組合。
        */
        className="h-full w-full rounded-[inherit] bg-white object-contain p-1"
        onError={() => setBroken(true)}
      />
    );
  }

  return <span>{PRODUCT.brand.logoMark}</span>;
}
