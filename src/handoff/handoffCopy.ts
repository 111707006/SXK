/**
 * B→A 交接的家長端用字（docs/specs/b-to-a-handoff.md §5）。B 報告頁那張卡、A 的落地畫面都從這裡拿。
 *
 * ⚠️ 這一檔會進 B 的建置：**不准寫品牌名**（`test/brandIsolation.test.ts`）。接收端叫什麼由
 * `GET /api/handoff/config` 的 `targetName` 給，句子在這裡組 —— 交接沒開啟時那個名字根本不會到 B 的畫面上。
 */

export const HANDOFF_CARD = {
  badge: '深度评估',
  title: (targetName: string) => `到${targetName}做深度评估`,
  body: (targetName: string) =>
    `想更细地了解孩子在哪些方面需要多一些支持、在家可以怎么陪孩子练，可以到${targetName}继续做深度评估。孩子的档案和这次的筛查结果会一起带过去，不用重新登录，也不用重做筛查。`,
  button: (targetName: string) => `到${targetName}做深度评估`,
  going: '正在前往…',
  consent: (targetName: string) => `点击即同意把孩子的筛查结果带到${targetName}`,
  privacy: '隐私保护条款',
  /** 伺服器沒給原因（連不上、回的不是 JSON）時。 */
  failed: '暂时无法前往，请稍后再试。',
} as const;

export const HANDOFF_LANDING = {
  loading: '正在把筛查结果带过来…',
  hint: '请稍候，不要关闭这个页面。',
  /** B 那邊說不行（碼不存在、那個帳號已經刪了）：回登入頁，改用手機驗證碼。連結本身不會過期。 */
  invalid: '这个连结无法使用，请用手机验证码登录。',
  /** 伺服器那一端暫時不通（502／503／網路）：同樣退回登入頁，但說清楚不是家長做錯了什麼。 */
  unavailable: '暂时无法把筛查结果带过来。可以回到原来的报告页再按一次，或用手机验证码登录。',
} as const;

/**
 * 簡訊邀請（`#invite=`）打開 A 的第一個畫面：先請家長同意，按下才把資料帶過來。
 * 按鈕那一條不需要 —— 家長在 B 按下那顆按鈕的時候已經同意過了。
 */
export const HANDOFF_INVITE = {
  badge: '深度评估',
  title: (targetName: string) => `到${targetName}继续做深度评估`,
  body: '孩子在筛查里的档案和结果会一起带过来，不用重新登录，也不用重做筛查。',
  accept: '同意并继续',
  consent: (targetName: string) => `点击即同意把孩子的筛查结果带到${targetName}`,
  privacy: '隐私保护条款',
  decline: '不用了，直接登录',
} as const;
