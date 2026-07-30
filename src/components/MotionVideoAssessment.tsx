import React, { useState, useRef, useEffect } from 'react';
import { Child, DimensionScore } from '../types';
import {
  CPMV_MODULES, CPMV_ITEMS, CPMV_FLAGS, cpmvGrade,
  CpmvItem
} from '../cpmvData';
import { collectCpmv, buildCpmvSummary, buildCpmvSuggest, CpmvCollectResult } from '../utils/cpmvReport';
import { extractVideoFrames } from '../utils/videoFrames';
import { authHeaders } from '../utils/api';
import {
  Video, Upload, Brain, Loader2, Check, ChevronRight, Database,
  Activity, AlertTriangle, FileText, Sparkles
} from 'lucide-react';

type ItemScore = 0 | 1 | 2 | 'nt' | null;

interface ItemState {
  score: ItemScore;
  flags: Record<string, boolean>;
  observation?: string;
  analyzing?: boolean;
  videoName?: string;
  aiScored?: boolean;
}

interface MotionVideoAssessmentProps {
  child: Child | null;
  existingScores: DimensionScore[];
  dimensionId: string;
  dimensionName: string;
  onSaveResult: (result: DimensionScore, shouldGoBack?: boolean) => void;
}

const MODULE_KEYS = ['A', 'B', 'C', 'D', 'E'];

export default function MotionVideoAssessment({
  child, dimensionId, dimensionName, onSaveResult
}: MotionVideoAssessmentProps) {
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>(() => {
    const init: Record<number, ItemState> = {};
    CPMV_ITEMS.forEach(it => { init[it.id] = { score: null, flags: {} }; });
    return init;
  });
  const [showReport, setShowReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const radarRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const answeredCount = CPMV_ITEMS.filter(it => itemStates[it.id].score !== null).length;

  const setScore = (id: number, s: ItemScore) => {
    setItemStates(prev => ({
      ...prev,
      [id]: { ...prev[id], score: prev[id].score === s ? null : s }
    }));
  };

  const toggleFlag = (id: number, k: string) => {
    setItemStates(prev => {
      const flags = { ...prev[id].flags, [k]: !prev[id].flags[k] };
      if (k === 'worseL' && flags.worseL) flags.worseR = false;
      if (k === 'worseR' && flags.worseR) flags.worseL = false;
      return { ...prev, [id]: { ...prev[id], flags } };
    });
  };

  const handleVideoUpload = async (item: CpmvItem, file: File) => {
    setError(null);
    setItemStates(prev => ({ ...prev, [item.id]: { ...prev[item.id], analyzing: true, videoName: file.name } }));
    try {
      const frames = await extractVideoFrames(file, 8);
      const resp = await fetch('/api/motion-eval', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          frames,
          child,
          item: { name: item.name, cmd: item.cmd, watch: item.watch, ai: item.ai, s2: item.s2, s1: item.s1, s0: item.s0 }
        })
      });
      let data: any = null;
      if (resp.ok) {
        const ct = resp.headers.get('content-type');
        if (ct && ct.includes('application/json')) data = await resp.json();
      }
      setItemStates(prev => {
        const cur = prev[item.id];
        const aiScore = data && (data.score === 0 || data.score === 1 || data.score === 2) ? data.score : cur.score;
        const flags = { ...cur.flags };
        if (data && Array.isArray(data.flags)) data.flags.forEach((f: string) => { flags[f] = true; });
        return {
          ...prev,
          [item.id]: {
            ...cur,
            analyzing: false,
            score: aiScore,
            flags,
            observation: data && data.observation ? data.observation : cur.observation,
            aiScored: !!(data && data.isAiGenerated)
          }
        };
      });
    } catch (err: any) {
      console.warn('Motion video analysis failed:', err);
      setError(`第 ${item.id} 题视频分析失败，请改用手动评分。（${err?.message || '未知错误'}）`);
      setItemStates(prev => ({ ...prev, [item.id]: { ...prev[item.id], analyzing: false } }));
    }
  };

  // Report computation lives in ../utils/cpmvReport (pure + unit-tested).
  const [report, setReport] = useState<CpmvCollectResult | null>(null);
  const [aiNarrative, setAiNarrative] = useState<{ summary: string[]; suggestions: string[] } | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);

  const genReport = async () => {
    const r = collectCpmv(itemStates);
    if (r.testedIds.length === 0) {
      setError('尚未对任何项目评分，请先完成评估（可上传视频由 AI 判读，或手动评分）。');
      return;
    }
    setError(null);
    setReport(r);
    setShowReport(true);
    setAiNarrative(null);

    // Persist a DimensionScore so dashboard/history stay consistent
    const pct = r.pct;
    const status: 'normal' | 'borderline' | 'delay' = pct < 45 ? 'delay' : pct < 75 ? 'borderline' : 'normal';
    const result: DimensionScore = {
      dimensionId,
      dimensionName,
      tierId: 'T3',
      score: r.sum,
      maxScore: r.max,
      status,
      completedAt: new Date().toISOString()
    };
    onSaveResult(result, false);
    setTimeout(() => radarReportRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

    // Phase 3: AI narrative summary/suggestions via qwen3.7-max (falls back to local text)
    setNarrativeLoading(true);
    try {
      const flagsForReq = CPMV_FLAGS
        .filter(f => r.flagStats[f.k].n > 0)
        .map(f => ({ label: f.label, items: r.flagStats[f.k].items }));
      const lowItems = CPMV_ITEMS
        .filter(it => { const s = itemStates[it.id].score; return s === 0 || s === 1; })
        .map(it => it.id);
      const resp = await fetch('/api/motion-report', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          child,
          total: { sum: r.sum, max: r.max, pct: r.pct, tested: r.testedIds.length },
          domains: r.domains.map(d => ({ name: d.name, pct: d.pct })),
          flags: flagsForReq,
          lowItems
        })
      });
      if (resp.ok) {
        const ct = resp.headers.get('content-type');
        if (ct && ct.includes('application/json')) {
          const data = await resp.json();
          if (data && data.isAiGenerated && Array.isArray(data.summary) && data.summary.length) {
            setAiNarrative({ summary: data.summary, suggestions: data.suggestions || [] });
          }
        }
      }
    } catch (e) {
      console.warn('Motion narrative unavailable, using local text:', e);
    } finally {
      setNarrativeLoading(false);
    }
  };

  const radarReportRef = useRef<HTMLDivElement | null>(null);

  // draw radar when report shown
  useEffect(() => {
    if (!showReport || !report || !radarRef.current) return;
    drawRadar(radarRef.current, report.domains.map(d => d.name), report.domains.map(d => d.pct === null ? 0 : d.pct / 100));
  }, [showReport, report]);

  const barColor = (p: number) => p >= 85 ? '#2E7D32' : p >= 60 ? '#C07600' : p >= 35 ? '#C05621' : '#B3402E';

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="bg-brand-forest text-white rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={100} /></div>
        <div className="relative z-10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-brand-sage">T3 · CPMV-20 脑瘫动作影像评估</span>
          <h3 className="text-sm font-bold text-white">骨骼关键点 / AI 动作影像判读（20 项）</h3>
          <p className="text-[11px] text-brand-cream/70 leading-relaxed mt-1">
            逐项上传一段 10–30 秒动作短视频，AI（qwen3-vl）将依量表观察要点自动判读 0/1/2 分；也可直接手动评分。满分 40 分。
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl px-4 py-2.5 text-xs flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* items grouped by module */}
      {MODULE_KEYS.map(mk => {
        const mod = CPMV_MODULES[mk];
        const list = CPMV_ITEMS.filter(it => it.mod === mk);
        return (
          <div key={mk} className="space-y-3">
            <div className="flex items-baseline gap-2 flex-wrap border-b border-brand-stone/50 pb-1.5">
              <span className="text-[11px] font-bold text-brand-moss tracking-wider">模块 {mk}</span>
              <span className="text-sm font-bold text-brand-forest">{mod.name}</span>
              <span className="text-[10px] text-brand-charcoal/50 ml-auto">{mod.age} · {mod.desc}</span>
            </div>

            {list.map(it => {
              const st = itemStates[it.id];
              return (
                <div key={it.id} className="p-4 bg-white border border-brand-stone rounded-2xl space-y-3">
                  <div className="flex gap-2.5">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${st.score !== null ? 'bg-brand-forest text-white' : 'bg-brand-cream border border-brand-stone/40 text-brand-charcoal/60'}`}>{it.id}</span>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-brand-forest">{it.name}</h4>
                        {it.age && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-sage/40 text-brand-forest border border-brand-stone/30">参考 {it.age}</span>}
                        {it.bi && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">双侧 · 取较差侧</span>}
                      </div>
                      <p className="text-[11px] text-brand-charcoal/70"><b className="text-brand-moss">指令：</b>{it.cmd}</p>
                      <p className="text-[10px] text-brand-charcoal/55 leading-relaxed"><b>观察：</b>{it.watch}</p>
                    </div>
                  </div>

                  {/* video upload + AI */}
                  <div className="flex items-center gap-2 flex-wrap pl-9">
                    <input
                      ref={el => { fileInputs.current[it.id] = el; }}
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleVideoUpload(it, f); e.currentTarget.value = ''; }}
                    />
                    <button
                      type="button"
                      disabled={st.analyzing}
                      onClick={() => fileInputs.current[it.id]?.click()}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition ${st.analyzing ? 'bg-slate-200 text-slate-500 cursor-wait' : 'bg-brand-moss/10 text-brand-forest border border-brand-moss/30 hover:bg-brand-moss/20'}`}
                    >
                      {st.analyzing ? <><Loader2 size={13} className="animate-spin" /> AI 判读中...</> : <><Video size={13} /> 上传视频 AI 判读</>}
                    </button>
                    {st.videoName && !st.analyzing && (
                      <span className="text-[10px] text-brand-charcoal/50 flex items-center gap-1 truncate max-w-[160px]">
                        {st.aiScored && <Check size={11} className="text-emerald-500 shrink-0" />}{st.videoName}
                      </span>
                    )}
                  </div>

                  {/* AI observation */}
                  {st.observation && (
                    <div className="pl-9">
                      <div className="bg-amber-50/60 border border-amber-100 rounded-lg px-3 py-2 text-[11px] text-amber-800 leading-relaxed">
                        <b className="flex items-center gap-1 mb-0.5"><Brain size={11} /> AI 影像判读：</b>{st.observation}
                      </div>
                    </div>
                  )}

                  {/* scoring */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-9">
                    {([2, 1, 0] as const).map(sv => (
                      <button
                        key={sv}
                        type="button"
                        onClick={() => setScore(it.id, sv)}
                        className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium text-left transition ${st.score === sv
                          ? (sv === 2 ? 'bg-brand-forest border-brand-forest text-white' : sv === 1 ? 'bg-amber-500 border-amber-500 text-white' : 'bg-rose-500 border-rose-500 text-white')
                          : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/80'}`}
                        title={sv === 2 ? it.s2 : sv === 1 ? it.s1 : it.s0}
                      >
                        <span className="font-black mr-1">{sv}</span>
                        {sv === 2 ? '完成良好' : sv === 1 ? '质量异常' : '无法完成'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setScore(it.id, 'nt')}
                      className={`py-1.5 px-2 rounded-lg border text-[11px] font-medium transition ${st.score === 'nt' ? 'bg-slate-500 border-slate-500 text-white' : 'border-brand-stone/40 bg-brand-cream/15 hover:bg-brand-cream/50 text-brand-charcoal/60'}`}
                    >
                      — 未测
                    </button>
                  </div>

                  {/* flags */}
                  <div className="flex items-center gap-1.5 flex-wrap pl-9">
                    <span className="text-[10px] text-brand-charcoal/50">标记:</span>
                    {CPMV_FLAGS.map(f => (
                      <button
                        key={f.k}
                        type="button"
                        onClick={() => toggleFlag(it.id, f.k)}
                        className={`px-2 py-0.5 rounded-full text-[10px] border transition ${st.flags[f.k]
                          ? (f.side ? 'bg-indigo-50 border-indigo-300 text-indigo-600 font-bold' : 'bg-rose-50 border-rose-300 text-rose-600 font-bold')
                          : 'border-brand-stone/40 text-brand-charcoal/50 hover:border-brand-moss'}`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* progress + generate */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-brand-stone/60 -mx-1 px-1 py-3 flex items-center gap-3">
        <div className="text-[11px] text-brand-charcoal/60 whitespace-nowrap">已评 <b className="text-brand-forest text-sm">{answeredCount}</b> / 20 项</div>
        <div className="flex-1 h-2 bg-brand-sage/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-brand-moss to-brand-forest rounded-full transition-all" style={{ width: `${answeredCount / 20 * 100}%` }} />
        </div>
        <button
          type="button"
          onClick={genReport}
          className="px-5 py-2.5 bg-brand-forest hover:bg-brand-forest/90 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition shrink-0"
        >
          <FileText size={14} /> 生成评估报告 <ChevronRight size={14} />
        </button>
      </div>

      {/* report */}
      {showReport && report && (
        <div ref={radarReportRef} className="space-y-6 pt-2 animate-fade-in">
          <div className="bg-gradient-to-br from-brand-forest to-brand-moss text-white rounded-2xl p-5">
            <div className="text-[11px] tracking-wider text-brand-sage flex items-center gap-1.5"><Sparkles size={13} /> 森心康 · CPMV-20 动作影像评估报告</div>
            <h3 className="text-lg font-black mt-1">脑瘫儿童动作影像评估报告</h3>
            <p className="text-[11px] text-brand-cream/80 mt-1">受测儿：{child?.name}（{child?.gender === 'boy' ? '男' : '女'}）· {child?.ageMonth} 个月</p>
          </div>

          {/* overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { n: `${report.sum}/${report.max}`, l: '实测总分' },
              { n: `${report.pct}%`, l: '得分率' },
              { n: `${report.testedIds.length}/20`, l: '完成项数' },
            ].map((o, i) => (
              <div key={i} className="bg-white border border-brand-stone rounded-xl p-3 text-center">
                <div className="text-xl font-black text-brand-forest">{o.n}</div>
                <div className="text-[10px] text-brand-charcoal/50 mt-0.5">{o.l}</div>
              </div>
            ))}
            <div className="bg-white border border-brand-stone rounded-xl p-3 flex items-center justify-center">
              <span className="px-3 py-1 rounded-full text-white text-[11px] font-bold" style={{ background: cpmvGrade(report.pct).c }}>{cpmvGrade(report.pct).t}</span>
            </div>
          </div>

          {/* radar + domain bars */}
          <div className="bg-white border border-brand-stone rounded-2xl p-5">
            <h4 className="text-xs font-black text-brand-forest mb-3 flex items-center gap-1.5"><Activity size={13} /> 五维功能剖面</h4>
            <div className="grid md:grid-cols-2 gap-4 items-center">
              <canvas ref={radarRef} width={360} height={320} className="max-w-full mx-auto" />
              <div className="space-y-2.5">
                {report.domains.map(d => {
                  const p = d.pct === null ? 0 : d.pct;
                  return (
                    <div key={d.key}>
                      <div className="flex justify-between text-[11px] mb-1"><b className="text-brand-forest">{d.name}</b><span className="text-brand-charcoal/50">{d.pct === null ? '未测' : `${d.sum}/${d.max} · ${d.pct}%`}</span></div>
                      <div className="h-2.5 bg-brand-sage/30 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${p}%`, background: d.pct === null ? '#8A8F8C' : barColor(p) }} /></div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* flags summary */}
          <div className="bg-white border border-brand-stone rounded-2xl p-5">
            <h4 className="text-xs font-black text-brand-forest mb-3">异常运动表现汇总</h4>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
              {CPMV_FLAGS.map(f => (
                <div key={f.k} className="border border-brand-stone/50 rounded-lg p-2 text-center">
                  <div className={`text-lg font-black ${report.flagStats[f.k].n ? (f.side ? 'text-indigo-600' : 'text-rose-500') : 'text-brand-charcoal/30'}`}>{report.flagStats[f.k].n}</div>
                  <div className="text-[10px] text-brand-charcoal/50">{f.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* per-item table */}
          <div className="bg-white border border-brand-stone rounded-2xl p-5 overflow-x-auto">
            <h4 className="text-xs font-black text-brand-forest mb-3">逐项结果</h4>
            <table className="w-full text-[11px]">
              <thead><tr className="text-left text-brand-charcoal/50 border-b border-brand-stone/50"><th className="py-1.5 pr-2">#</th><th className="py-1.5 pr-2">项目</th><th className="py-1.5 pr-2">得分</th><th className="py-1.5">标记</th></tr></thead>
              <tbody>
                {CPMV_ITEMS.map(it => {
                  const s = itemStates[it.id].score;
                  const fl = CPMV_FLAGS.filter(f => itemStates[it.id].flags[f.k]).map(f => f.label).join('、') || '—';
                  return (
                    <tr key={it.id} className="border-b border-brand-stone/30">
                      <td className="py-1.5 pr-2 text-brand-charcoal/50">{it.id}</td>
                      <td className="py-1.5 pr-2 text-brand-charcoal/80">{it.name}</td>
                      <td className={`py-1.5 pr-2 font-bold ${s === 2 ? 'text-emerald-600' : s === 1 ? 'text-amber-600' : s === 0 ? 'text-rose-600' : 'text-brand-charcoal/40'}`}>{s === 'nt' ? '未测' : s === null ? '—' : `${s} 分`}</td>
                      <td className="py-1.5 text-brand-charcoal/60">{fl}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* summary + suggestions (AI narrative when available, local text as fallback) */}
          <div className="bg-white border-l-4 border-brand-moss rounded-r-2xl p-4">
            <h4 className="text-xs font-black text-brand-forest mb-2 flex items-center gap-2">
              观察摘要
              {narrativeLoading
                ? <span className="text-[10px] font-normal text-brand-charcoal/50 flex items-center gap-1"><Loader2 size={11} className="animate-spin" /> AI 生成中...</span>
                : aiNarrative && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-moss/15 text-brand-moss flex items-center gap-0.5"><Brain size={9} /> AI 生成</span>}
            </h4>
            {(aiNarrative?.summary || buildCpmvSummary(report)).map((s, i) => <p key={i} className="text-[11px] text-brand-charcoal/75 leading-relaxed mb-1.5">{s}</p>)}
          </div>
          <div className="bg-amber-50/40 border-l-4 border-amber-500 rounded-r-2xl p-4">
            <h4 className="text-xs font-black text-amber-700 mb-2 flex items-center gap-2">
              建议
              {aiNarrative && aiNarrative.suggestions.length > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 flex items-center gap-0.5"><Brain size={9} /> AI 生成</span>}
            </h4>
            {((aiNarrative && aiNarrative.suggestions.length ? aiNarrative.suggestions : buildCpmvSuggest(report))).map((s, i) => <p key={i} className="text-[11px] text-brand-charcoal/75 leading-relaxed mb-1.5">{s}</p>)}
          </div>

          <p className="text-[10px] text-brand-charcoal/40 text-center">本工具为动作影像评估参考，不构成医学诊断；正式功能分级请以 GMFM、GMFCS、MACS 等标准化评估为准。</p>
        </div>
      )}
    </div>
  );
}

// dependency-free canvas radar (ported from CPMV-20 tool)
function drawRadar(cv: HTMLCanvasElement, labels: string[], vals: number[]) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 + 6, R = Math.min(W, H) / 2 - 52;
  const n = labels.length;
  const ang = (i: number) => -Math.PI / 2 + i * 2 * Math.PI / n;

  ctx.strokeStyle = '#DFE6E1';
  ctx.font = "11px 'Noto Sans SC',sans-serif";
  for (let ring = 1; ring <= 4; ring++) {
    const rr = R * ring / 4;
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = ang(i % n), x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  for (let i = 0; i < n; i++) {
    const a = ang(i);
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a)); ctx.stroke();
    const lx = cx + (R + 16) * Math.cos(a), ly = cy + (R + 16) * Math.sin(a);
    ctx.fillStyle = '#22302B';
    ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? 'center' : (Math.cos(a) > 0 ? 'left' : 'right');
    ctx.textBaseline = Math.abs(Math.sin(a)) < 0.3 ? 'middle' : (Math.sin(a) > 0 ? 'top' : 'bottom');
    ctx.fillText(labels[i], lx, ly);
    ctx.fillStyle = '#8A968F';
    ctx.fillText(Math.round(vals[i] * 100) + '%', lx, ly + (Math.sin(a) > 0 ? 14 : -14));
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const j = i % n, a = ang(j), rr = R * Math.max(0.02, vals[j]);
    const x = cx + rr * Math.cos(a), y = cy + rr * Math.sin(a);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(31,122,84,0.22)';
  ctx.strokeStyle = '#17573E'; ctx.lineWidth = 2;
  ctx.fill(); ctx.stroke();
  for (let i = 0; i < n; i++) {
    const a = ang(i), rr = R * Math.max(0.02, vals[i]);
    ctx.beginPath();
    ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = '#B9902F'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.stroke();
  }
}
