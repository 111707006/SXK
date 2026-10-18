import { RATER_NOTE_MAX } from '../t2/raterV2';
import type { Rater } from '../t2/types';

/**
 * 填表人選「其他」時的選填說明（#70，開關 `T2_RATER_V2`）：例「阿姨」。不填也能交卷；去頭尾空白在交卷時做
 * （`raterPayload`），字數伺服器再數一次。開關關著、或選的不是「其他」，什麼都不畫。
 */
export default function T2RaterNoteInput({ v2, rater, value, onChange, disabled, id }: {
  v2: boolean;
  rater: Rater | null;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  id: string;
}) {
  if (!v2 || rater !== 'other') return null;
  return (
    <label className="block space-y-1" htmlFor={id}>
      <span className="text-xs text-brand-charcoal/80">是谁填写？（选填，最多 {RATER_NOTE_MAX} 个字）</span>
      <input
        id={id}
        type="text"
        value={value}
        maxLength={RATER_NOTE_MAX}
        disabled={disabled}
        placeholder="例如：阿姨"
        onChange={e => onChange(e.target.value)}
        className="w-full max-w-xs px-3 py-2 rounded-xl border border-brand-stone/50 bg-white text-xs text-brand-charcoal focus:outline-none focus:border-brand-moss"
      />
    </label>
  );
}
