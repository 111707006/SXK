/**
 * 服務關係開關（#118，ADR-0020）。**只在專案 A**、預設關。
 *
 * 開著時後台範圍、頁首 Logo、清分對方、連結與兌換碼掛上、改派、換人提示全部改看服務關係
 * （`service_relations`）；關著＝一行不動。要同時開身分開關（#115，登入只看手機號）與 `A_COMPANIES`，
 * 否則起不來：沒有身分開關，同一支手機從另一個單位的連結進來會多開一個帳號，服務關係就掛錯人。
 *
 * 值的解析與 `server.ts` 的 `resolvePaywallSwitch` 同一套 fail-closed：只收 `1`/`true`/`0`/`false`，
 * 不設或空字串＝關，認不得的值起不來（B 也一樣，打錯字不因為是 B 就放過）。
 *
 * `server.ts` 在 `A_PHONE_IDENTITY`（身分開關）之後讀它。
 */

export const SERVICE_RELATIONS_ENV = 'SERVICE_RELATIONS';

export interface ServiceRelationsContext {
  /** `APP_MODE === 'full'`。 */
  projectA: boolean;
  /** `A_COMPANIES` 開著（已經套過「只在 A」）。 */
  aCompanies: boolean;
  /** 身分開關 `A_PHONE_IDENTITY`（#115）開著（已經套過「只在 A」）。 */
  identityByPhone: boolean;
}

export interface ServiceRelationsSwitch {
  enabled: boolean;
  /** 專案 B 設了、不生效時，啟動要印的那一行；其他是 null。 */
  notice: string | null;
}

export function resolveServiceRelationsSwitch(raw: string | undefined, ctx: ServiceRelationsContext): ServiceRelationsSwitch {
  let requested: boolean;
  if (raw === undefined || raw === '' || raw === '0' || raw === 'false') requested = false;
  else if (raw === '1' || raw === 'true') requested = true;
  else {
    throw new Error(`${SERVICE_RELATIONS_ENV} 認不得：${JSON.stringify(raw)}。只收 '1'/'true'（開）或 '0'/'false'（關）。`);
  }
  if (!requested) return { enabled: false, notice: null };
  if (!ctx.projectA) {
    return { enabled: false, notice: `[service-relations] ${SERVICE_RELATIONS_ENV}=1：專案 B 不生效（服務關係只在專案 A），可以拿掉。` };
  }
  const missing = [
    ...(ctx.identityByPhone ? [] : ['身分開關（A_PHONE_IDENTITY=1，#115）']),
    ...(ctx.aCompanies ? [] : ['A_COMPANIES=1']),
  ];
  if (missing.length > 0) {
    throw new Error(`${SERVICE_RELATIONS_ENV}=1 需要同時開 ${missing.join('、')}（ADR-0020）`);
  }
  return { enabled: true, notice: null };
}
