/**
 * 匿名裝置識別碼。
 *
 * 專案 B 走匿名流程（不註冊即可作答），資料靠這個 id 認回來；專案 A 登入後
 * 仍會一併帶上，讓同一台裝置的舊資料能銜接。
 *
 * 抽成共用模組的理由：這個 localStorage 鍵名原本只存在 `App.tsx` 的一個閉包裡，
 * 其他地方要用就得再打一次字串。維度 ID 那次事故就是這樣來的 —— 同一個字串
 * 散在多處、改一處漏一處，而 `tsc` 一條都擋不住。
 */

const DEVICE_ID_KEY = 'senxinkang_device_id';

/** 取得裝置 id，沒有就建立並存下來。 */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/**
 * 只讀取，不建立。
 *
 * 給「有就帶上、沒有也不強求」的場合用（例如送出專家預約時附上裝置 id）——
 * 這種地方不該有副作用，也不該因為使用者剛好清過 localStorage 就失敗。
 */
export function peekDeviceId(): string | null {
  return localStorage.getItem(DEVICE_ID_KEY);
}
