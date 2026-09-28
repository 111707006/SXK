/**
 * 展示環境的固定驗證碼（2026-09-28：Render 的 `sxk-demo`，資料庫是跟著服務一起跑的 MariaDB）。
 *
 * 【為什麼要有】
 * 展示環境的資料是假的、每次重啟都回到同一份（`deploy/demo/`），不接阿里雲簡訊 ——
 * 看展示的人要能登入，又不必每個人都去申請一組簡訊金鑰。設了 `DEMO_LOGIN_CODE`（六位數字）時：
 * 索取驗證碼**不送簡訊**、那一組就是這個固定值；其餘（存雜湊、核對、過期、一次性、第一次即建帳號）
 * 走的是正式那一條，一行都沒分岔。
 *
 * 【怎麼保證它不會出現在正式站】
 * 固定驗證碼＝任何人輸入任何手機號都登得進去。所以**只在資料庫是本機（127.0.0.1／localhost）時收**：
 * 正式站 A、B 與舊的 Render 服務連的都是遠端的 RDS，同時設了這兩個值，程序直接起不來
 * （與 `APP_MODE`、`MEDIA_UPSTREAM` 同一個 fail-closed 的作法）—— 不是「悄悄忽略」，
 * 因為悄悄忽略的那一天，就是有人以為展示碼還有效、而其實它在另一台機器上生效的那一天。
 */

const LOCAL_DB_HOSTS = new Set(['127.0.0.1', 'localhost']);

export function resolveDemoLoginCode(raw: string | undefined, mysqlHost: string | undefined): string | null {
  const code = raw?.trim();
  if (!code) return null;
  if (!/^\d{6}$/.test(code)) {
    throw new Error(`DEMO_LOGIN_CODE 必须是 6 位数字：${JSON.stringify(code)}`);
  }
  const host = mysqlHost?.trim() ?? '';
  if (!LOCAL_DB_HOSTS.has(host)) {
    throw new Error(
      `DEMO_LOGIN_CODE 只能用在资料库跑在本机的展示环境（MYSQL_HOST=127.0.0.1），这里是 ${JSON.stringify(host)}。` +
        '固定验证码等于任何人都能登入任何手机号 —— 正式站绝对不可以设。'
    );
  }
  return code;
}
