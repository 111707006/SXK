/**
 * 換人提示的字（#120，家長端；進 `test/parentWording.structure.test.ts` 的用字掃描）。
 * 名字是推薦人（治療師）的名字，沒有推薦人時是單位名（`displayNameOf`）。
 */
export const SERVICE_SWITCH_COPY = {
  title: '要换一位老师吗？',
  question: (current: string, to: string) => `你目前由 ${current} 服务，要换成 ${to} 吗？`,
  hint: '换了之后，报告、订单、训练记录都会保留。',
  switchTo: (to: string) => `换成 ${to}`,
  keep: '不换',
  done: (to: string) => `已经换成 ${to}。`,
  failed: '暂时无法更换，请稍后再试。',
  unchanged: '这次没有更换，现在的老师不变。',
} as const;

/** 選「换」之後的那一句：伺服器真的換了才說「已经换成」。 */
export function switchResultMessage(ok: boolean, changed: boolean, toName: string): string {
  if (!ok) return SERVICE_SWITCH_COPY.failed;
  return changed ? SERVICE_SWITCH_COPY.done(toName) : SERVICE_SWITCH_COPY.unchanged;
}
