/**
 * 本機構設定 —— 企業微信通知位置（issue #11）與家長端 LOGO。
 *
 * 通知：家長送出預約後，通知會送到他所屬公司的這個位置。沒設定時退回全域設定，
 * 並在伺服器日誌記一行；兩者都沒有時通知會失敗，而那個失敗會在日誌大聲喊。
 *
 * LOGO：家長端頁首與登入卡上那顆方塊。**這是唯一會顯示在家長端的公司資料**
 * —— 機構名稱仍然只給後台看。留空時家長看到的是建置內建的字標。
 *
 * 【兩個欄位分開送】
 * 只送使用者真的改過的那一個。兩欄一起送的話，一個只想換 LOGO 的動作會把
 * webhook 一併覆蓋成當時輸入框裡的值 —— 而那個失敗要等到下一位家長送出預約、
 * 通知沒送到，才會有人發現。
 */
import { useCallback, useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { adminApi } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { Button, ErrorNote, Field, Panel, Spinner, TextInput, toErrorView, useAsyncData } from '../ui';

export default function CompanySettingsPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.company(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);

  const [url, setUrl] = useState('');
  const [logo, setLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const company = data?.company ?? null;

  // 每次讀回來都以伺服器的值為準。**這裡不清掉「已保存」** —— save() 成功後會
  // 呼叫 reload()，而 company 每次抓取都是新的物件參考，所以這個 effect 必定重跑；
  // 在這裡 setSaved(false) 等於讓確認訊息被它自己觸發的那次重載清掉，使用者看到
  // 的是「按了之後閃一下就沒了」，只好再按一次。訊息改由使用者編輯輸入框時清除。
  useEffect(() => {
    setUrl(company?.wecomWebhookUrl ?? '');
    setLogo(company?.logoUrl ?? '');
  }, [company]);

  /** 把輸入框的值正規化成後端要的形狀：空字串等同「不設定」。 */
  const asValue = (raw: string) => (raw.trim() ? raw.trim() : null);

  /** 只把真的改過的欄位放進 patch。沒改的鍵不送，後端就不會寫它。 */
  function pendingPatch(): { wecomWebhookUrl?: string | null; logoUrl?: string | null } {
    const patch: { wecomWebhookUrl?: string | null; logoUrl?: string | null } = {};
    if (asValue(url) !== (company?.wecomWebhookUrl ?? null)) patch.wecomWebhookUrl = asValue(url);
    if (asValue(logo) !== (company?.logoUrl ?? null)) patch.logoUrl = asValue(logo);
    return patch;
  }

  async function save() {
    const patch = pendingPatch();
    // 什麼都沒改就不要發請求 —— 後端會回「没有要更新的设定」，那對按了保存的
    // 人來說像是一個錯誤，但他其實什麼也沒做錯。
    if (Object.keys(patch).length === 0) {
      setSaved(true);
      return;
    }
    setBusy(true);
    setSaveFailure(null);
    setSaved(false);
    try {
      await adminApi.updateCompanySettings(patch);
      setSaved(true);
      reload();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="本机构设定"
      description="家长送出专家预约后，通知会送到这里。留空则退回系统的全域通知位置，并在伺服器日誌记录这件事。"
    >
      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : !company ? (
        // 全域管理員選到「未歸屬」時會走到這裡。那不是一家公司，
        // 沒有通知位置可以設定 —— 說清楚，不要显示一个存不进去的空表单。
        <p className="py-8 text-center text-xs leading-relaxed text-brand-charcoal/55">
          「未归属的家长」不是一家合作公司，因此没有机构设定可以调整。
          <br />
          请从右上角切换到一家合作公司。
        </p>
      ) : (
        <div className="max-w-xl space-y-4">
          <dl className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            <div className="flex gap-2">
              <dt className="text-brand-charcoal/45">机构名称</dt>
              <dd className="font-bold text-brand-forest">{company.name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-brand-charcoal/45">进站识别码</dt>
              <dd className="font-mono text-brand-charcoal/80">{company.slug}</dd>
            </div>
          </dl>

          <Field
            label="企业微信群机器人 Webhook"
            hint="必须是 https:// 开头。在企业微信群组「添加群机器人」后取得，留空表示改用全域设定。"
          >
            <TextInput
              value={url}
              onChange={e => {
                setUrl(e.target.value);
                setSaved(false);
              }}
              placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…"
            />
          </Field>

          <Field
            label="家长端 LOGO"
            hint="家长端页首与登入卡上那颗方块。必须是 https:// 开头的图片网址，或站内的 / 路径（例如 /logo-abc.png）。留空则显示系统内建的字标。"
          >
            <TextInput
              value={logo}
              onChange={e => {
                setLogo(e.target.value);
                setSaved(false);
              }}
              placeholder="https://example.com/logo.png"
            />
          </Field>

          {/*
            即時預覽。存進去之前先讓人看到那張圖到底能不能載入 ——
            網址打錯的症狀是家長端一塊空白，而後台看起來一切正常。
          */}
          {logo.trim() && (
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-brand-forest">
                <img
                  src={logo.trim()}
                  alt=""
                  className="h-full w-full object-contain"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                    const note = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (note) note.hidden = false;
                  }}
                  onLoad={e => {
                    (e.currentTarget as HTMLImageElement).style.display = '';
                    const note = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (note) note.hidden = true;
                  }}
                />
                <span hidden className="text-[9px] font-bold text-white/70">
                  载入失败
                </span>
              </div>
              <p className="text-[10px] leading-relaxed text-brand-charcoal/45">
                预览。这颗方块在家长端是 40×40（页首）与 48×48（登入卡），
                建议用正方形、去背的图。
              </p>
            </div>
          )}

          {saveFailure && <ErrorNote message={saveFailure} />}
          {saved && <p className="text-[11px] font-bold text-brand-moss">已保存。</p>}

          <Button onClick={() => void save()} busy={busy}>
            <Save size={12} />
            保存
          </Button>

          <p className="text-[10px] leading-relaxed text-brand-charcoal/40">
            家长的归属在注册那一刻写入，之后不会因为从别家公司的连结进站而改变。
            因此这个位置收到的，就是从贵机构连结注册的那些家长的预约。
          </p>
        </div>
      )}
    </Panel>
  );
}
