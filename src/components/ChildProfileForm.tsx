import React, { useState } from 'react';
import { Child, Gender } from '../types';
import { User, Calendar, Smile, AlertCircle, Sparkles } from 'lucide-react';
import { calculateAgeMonth, formatAge, getBirthDateFromAgeMonth } from '../utils/dateUtils';

interface ChildProfileFormProps {
  currentChild: Child | null;
  onSave: (child: Child) => void;
}

const SAMPLE_CHILDREN: { name: string; ageMonth: number; gender: Gender }[] = [
  { name: '森森', ageMonth: 42, gender: 'boy' },
  { name: '心心', ageMonth: 28, gender: 'girl' },
  { name: '康康', ageMonth: 54, gender: 'boy' },
];

export default function ChildProfileForm({ currentChild, onSave }: ChildProfileFormProps) {
  const [name, setName] = useState(currentChild?.name || '');
  const [birthDate, setBirthDate] = useState<string>(() => {
    if (currentChild?.birthDate) return currentChild.birthDate;
    if (currentChild?.ageMonth) return getBirthDateFromAgeMonth(currentChild.ageMonth);
    return '2023-07-08'; // Default ~3 years old in 2026
  });
  const [gender, setGender] = useState<Gender>(currentChild?.gender || 'boy');
  const [error, setError] = useState('');

  // Calculate age real-time
  const calculatedAgeMonth = calculateAgeMonth(birthDate);

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
    if (calculatedAgeMonth < 12 || calculatedAgeMonth > 180) {
      setError('系统筛查与量表适用范围为12-180个月（1-15岁），请选择正确的出生日期');
      return;
    }
    setError('');
    onSave({ 
      name: name.trim(), 
      birthDate,
      ageMonth: calculatedAgeMonth, 
      gender 
    });
  };

  const handleSelectSample = (sample: { name: string; ageMonth: number; gender: Gender }) => {
    const sampleBirthDate = getBirthDateFromAgeMonth(sample.ageMonth);
    setName(sample.name);
    setBirthDate(sampleBirthDate);
    setGender(sample.gender);
    onSave({
      name: sample.name,
      birthDate: sampleBirthDate,
      ageMonth: sample.ageMonth,
      gender: sample.gender
    });
  };

  return (
    <div className="bg-white rounded-3xl border border-brand-stone p-6 md:p-8 max-w-2xl mx-auto shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-brand-sage/70 rounded-2xl text-brand-moss">
          <User size={24} />
        </div>
        <div className="text-left">
          <h2 className="text-xl font-bold font-sans text-brand-forest">快捷登记受测儿童信息</h2>
          <p className="text-xs text-brand-charcoal/70 mt-0.5">登记出生日期，系统将自动换算实足月龄，匹配最佳神经发育筛查量表</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 p-3.5 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-100 text-left">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-left">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-brand-charcoal flex items-center gap-1.5">
              儿童姓名 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="child-name-input"
                type="text"
                placeholder="例如: 森森"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 bg-brand-cream/30 border border-brand-stone/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-moss/20 focus:border-brand-moss text-brand-charcoal transition"
              />
              <User className="absolute left-3.5 top-3.5 text-brand-charcoal/40" size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-brand-charcoal flex items-center gap-1.5">
              出生日期 <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                id="child-birthdate-input"
                type="date"
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(e.target.value);
                  setError('');
                }}
                className="w-full pl-10 pr-4 py-3 bg-brand-cream/30 border border-brand-stone/60 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-moss/20 focus:border-brand-moss text-brand-charcoal transition"
              />
              <Calendar className="absolute left-3.5 top-3.5 text-brand-charcoal/40" size={16} />
            </div>
            
            {birthDate && (
              <div className="flex items-center gap-1.5 bg-brand-sage/10 rounded-xl p-2.5 border border-brand-stone/40 animate-fade-in">
                <Sparkles size={12} className="text-brand-moss" />
                <p className="text-[11px] text-brand-forest font-bold leading-none">
                  年龄：
                  <span className="text-brand-clay text-xs ml-0.5">{formatAge(calculatedAgeMonth)}</span>
                  <span className="text-brand-charcoal/60 font-medium ml-1">({calculatedAgeMonth} 个月)</span>
                </p>
              </div>
            )}
            <p className="text-[10px] text-brand-charcoal/50 leading-relaxed">系统适用范围为1岁至15岁 (12-180个月)</p>
          </div>
        </div>

        <div className="space-y-2 text-left">
          <label className="text-xs font-semibold text-brand-charcoal block">儿童性别</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              id="gender-btn-boy"
              type="button"
              onClick={() => setGender('boy')}
              className={`p-3.5 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 transition ${
                gender === 'boy'
                  ? 'border-brand-clay bg-brand-sand/50 text-brand-clay font-semibold shadow-sm'
                  : 'border-brand-stone/30 bg-brand-cream/20 hover:bg-brand-cream/50 text-brand-charcoal/70'
              }`}
            >
              <span>👦 男孩</span>
            </button>
            <button
              id="gender-btn-girl"
              type="button"
              onClick={() => setGender('girl')}
              className={`p-3.5 rounded-2xl border text-sm font-medium flex items-center justify-center gap-2 transition ${
                gender === 'girl'
                  ? 'border-rose-400 bg-rose-50/50 text-rose-700 font-semibold shadow-sm'
                  : 'border-brand-stone/30 bg-brand-cream/20 hover:bg-brand-cream/50 text-brand-charcoal/70'
              }`}
            >
              <span>👧 女孩</span>
            </button>
          </div>
        </div>

        <button
          id="profile-submit-btn"
          type="submit"
          className="w-full py-3.5 bg-brand-forest hover:bg-brand-forest/90 text-white rounded-2xl text-sm font-semibold active:scale-[0.98] transition shadow-md shadow-brand-forest/10"
        >
          确认登记并开始评估
        </button>
      </form>

      <div className="mt-8 pt-6 border-t border-brand-stone/60">
        <h3 className="text-xs font-semibold text-brand-charcoal/60 mb-3 flex items-center gap-1.5 justify-start">
          <Smile size={14} className="text-brand-moss" /> 或者是选择一份精心准备的数据样例进行深度体验：
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SAMPLE_CHILDREN.map((sc, idx) => (
            <button
              id={`sample-child-btn-${idx}`}
              key={idx}
              type="button"
              onClick={() => handleSelectSample(sc)}
              className="p-3 bg-brand-cream/20 hover:bg-brand-sage/30 hover:border-brand-moss border border-brand-stone/60 rounded-xl text-left transition cursor-pointer"
            >
              <div className="text-xs font-bold text-brand-forest">
                {sc.name} ({sc.gender === 'boy' ? '男' : '女'})
              </div>
              <div className="text-[10px] text-brand-charcoal/60 mt-1">{formatAge(sc.ageMonth)} | {sc.ageMonth} 个月</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
