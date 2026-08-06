/**
 * 本機構設定 —— 目前只有企業微信通知位置（issue #11）。
 *
 * 家長送出預約後，通知會送到他所屬公司的這個位置。沒設定時退回全域設定，
 * 並在伺服器日誌記一行；兩者都沒有時通知會失敗，而那個失敗會在日誌大聲喊。
 * 這一頁存在的意義就是讓合作公司自己把這件事補上。
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
  }, [company]);

  async function save() {
    setBusy(true);
    setSaveFailure(null);
    setSaved(false);
    try {
      await adminApi.updateCompanyWebhook(url.trim() ? url.trim() : null);
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
