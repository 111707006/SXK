import React, { useState } from 'react';
import { Child, Gender } from '../types';
import { X, User, AlertCircle, Save, Trash2, Sparkles } from 'lucide-react';
import { calculateAgeMonth, formatAge } from '../utils/dateUtils';
import { useToday } from '../utils/useToday';
import { APPLICABLE_RANGE_TEXT } from '../utils/birthDateOptions';
import { T1_AGE_RANGE } from '../t1Data';
import BirthDateSelect from './BirthDateSelect';

interface EditProfileModalProps {
  child: Child;
  onSave: (updatedChild: Child) => void;
  onClose: () => void;
  onResetAll: () => void;
}

export default function EditProfileModal({ child, onSave, onClose, onResetAll }: EditProfileModalProps) {
  const storedBirthDate = child.birthDate || '';
  const [name, setName] = useState(child.name);
  // 只有月齡的舊檔案不反推一個生日填進去 —— 那是猜的，而且會隨著今天一天一天往後
  // 滑；家長哪一天按下保存，那個猜出來的日子就變成孩子永久的生日。
  const [birthDate, setBirthDate] = useState<string>(storedBirthDate);
  const [gender, setGender] = useState<Gender>(child.gender);
  const [error, setError] = useState('');
  const today = useToday();

  // Calculate age real-time；讀不出來是 null，不是某個看起來很正常的數字
  const calculatedAgeMonth = calculateAgeMonth(birthDate, today);
  const birthDateChanged = birthDate !== storedBirthDate;
  const outOfRange =
    calculatedAgeMonth !== null &&
    (calculatedAgeMonth < T1_AGE_RANGE.minMonths || calculatedAgeMonth > T1_AGE_RANGE.maxMonths);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('请输入儿童姓名');
      return;
    }
    if (!birthDate) {
      setError('请选择儿童出生日期');
      return;
    }
    if (calculatedAgeMonth === null) {
      setError('出生日期无法识别，请重新选择（不能晚于今天）');
      return;
    }
    // 適用範圍是用來擋**打錯的生日**的，不是用來擋孩子長大的。實足月齡會隨時間
    // 走，孩子滿 15 歲的那天就會越過上限 —— 若連沒改生日的存檔都一起擋掉，家長
    // 從此連改個名字都做不到，只剩下「重置檔案與所有測評成績」這條毀滅性的路。
    if (outOfRange && birthDateChanged) {
      setError(`系统评估适用范围为${APPLICABLE_RANGE_TEXT}`);
      return;
    }
    setError('');
    onSave({
      name: name.trim(),
      birthDate,
      ageMonth: calculatedAgeMonth,
      gender,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark overlay backdrop */}
      <div 
        className="absolute inset-0 bg-brand-forest/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal content box */}
      <div className="relative bg-white w-full max-w-md rounded-3xl border border-brand-stone p-6 shadow-2xl animate-fade-in z-10 text-left">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-brand-sage/40 rounded-xl text-brand-moss">
              <User size={18} />
            </div>
            <h3 className="text-base font-extrabold text-brand-forest">修改儿童成长档案</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-brand-charcoal/50 hover:text-brand-charcoal transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4.5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-100">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Child Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-charcoal">儿童姓名</label>
            <div className="relative">
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full pl-9 pr-3 py-2.5 bg-brand-cream/20 border border-brand-stone/60 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-brand-moss/20 focus:border-brand-moss text-brand-charcoal transition"
                placeholder="请输入姓名或昵称"
              />
              <User className="absolute left-3 top-3 text-brand-charcoal/40" size={14} />
            </div>
          </div>

          {/* Child Birth Date */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-charcoal">出生日期</label>
            <BirthDateSelect
              idPrefix="edit-birthdate"
              size="sm"
              value={birthDate}
              today={today}
              storedBirthDate={storedBirthDate}
              onChange={(next) => {
                setBirthDate(next);
                setError('');
              }}
            />
            {!storedBirthDate && (
              <p className="text-[10px] text-brand-clay font-bold leading-relaxed mt-1">
                这份档案还没有出生日期，请补上，系统才能自动换算实足月龄
              </p>
            )}
            {birthDate && calculatedAgeMonth !== null && (
              <div className="flex items-center gap-1.5 bg-brand-sage/10 rounded-xl p-2 border border-brand-stone/40 animate-fade-in mt-1.5">
                <Sparkles size={11} className="text-brand-moss" />
                <p className="text-[10px] text-brand-forest font-bold leading-none">
                  年龄：
                  <span className="text-brand-clay text-xs ml-0.5">{formatAge(calculatedAgeMonth)}</span>
                  <span className="text-brand-charcoal/60 font-medium ml-1">({calculatedAgeMonth} 个月)</span>
                </p>
              </div>
            )}
            {birthDate && calculatedAgeMonth === null && (
              <div className="flex items-center gap-1.5 bg-rose-50 rounded-xl p-2 border border-rose-100 animate-fade-in mt-1.5">
                <AlertCircle size={11} className="text-rose-500 shrink-0" />
                <p className="text-[10px] text-rose-700 font-bold leading-none">这个出生日期无法识别，请重新选择</p>
              </div>
            )}
            {outOfRange && !birthDateChanged && (
              <p className="text-[10px] text-brand-clay font-bold leading-relaxed mt-1.5">
                目前的实足月龄已超出量表适用范围，档案仍可修改，但暂时无法开始新的筛查
              </p>
            )}
            <p className="text-[10px] text-brand-charcoal/50 leading-relaxed mt-1">系统适用范围为 {APPLICABLE_RANGE_TEXT}</p>
          </div>

          {/* Gender selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-brand-charcoal">儿童性别</label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setGender('boy')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  gender === 'boy'
                    ? 'border-brand-clay bg-brand-sand/30 text-brand-clay'
                    : 'border-brand-stone/30 bg-brand-cream/10 hover:bg-brand-cream/35 text-brand-charcoal/70'
                }`}
              >
                <span>👦 男孩</span>
              </button>
              <button
                type="button"
                onClick={() => setGender('girl')}
                className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  gender === 'girl'
                    ? 'border-rose-400 bg-rose-50/40 text-rose-700'
                    : 'border-brand-stone/30 bg-brand-cream/10 hover:bg-brand-cream/35 text-brand-charcoal/70'
                }`}
              >
                <span>👧 女孩</span>
              </button>
            </div>
          </div>

          {/* Buttons Footer */}
          <div className="pt-3 flex flex-col gap-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 bg-brand-beige/40 hover:bg-brand-beige/70 border border-brand-stone/50 text-brand-charcoal font-bold rounded-xl text-xs transition active:scale-95 cursor-pointer text-center"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 py-2.5 bg-brand-forest hover:bg-brand-forest/95 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1 shadow-md shadow-brand-forest/10 cursor-pointer"
              >
                <Save size={13} />
                保存修改
              </button>
            </div>

            {/* Separator */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-dashed border-brand-stone/40"></div>
              <span className="flex-shrink mx-2 text-[10px] text-brand-charcoal/40 font-semibold">危险区域</span>
              <div className="flex-grow border-t border-dashed border-brand-stone/40"></div>
            </div>

            {/* Reset data danger action */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onResetAll();
              }}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-[10px] font-extrabold transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 size={11} />
              重置档案与所有测评成绩
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
