/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Child, DimensionScore, Order, AssessmentRecord } from './types';
import { DIMENSIONS_DATA } from './data';
import ChildProfileForm from './components/ChildProfileForm';
import DimensionGrid from './components/DimensionGrid';
import AssessmentPanel from './components/AssessmentPanel';
import AnalysisReport from './components/AnalysisReport';
import WearablesMall from './components/WearablesMall';
import LanguageSpecialAssessment from './components/LanguageSpecialAssessment';
import T1Screening from './components/T1Screening';
import EditProfileModal from './components/EditProfileModal';
import SpecializedReportView from './components/SpecializedReportView';
import AuthScreen from './components/AuthScreen';
import { generateSpecializedReportRecord } from './utils/reportUtils';
import { formatAge } from './utils/dateUtils';
import { 
  Activity, ShoppingBag, BarChart3, User, RefreshCw, 
  Heart, HeartHandshake, FileText, CheckCircle2, ListFilter,
  ChevronDown, Truck, Package, LogOut, ArrowRight, UserCheck,
  BookOpen, Award, Layers, ShieldCheck, ChevronRight, Sparkles
} from 'lucide-react';

export default function App() {
  const [child, setChild] = useState<Child | null>(null);
  
  // Navigation: 'dashboard' | 't1_screening' | 'assessment' | 'report' | 'mall' | 'language_special' | 'specialized_report'
  const [currentView, setCurrentView] = useState<'dashboard' | 't1_screening' | 'assessment' | 'report' | 'mall' | 'language_special' | 'specialized_report'>('dashboard');
  
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);
  
  // Scoring record states (save inside localStorage on update for persistence!)
  const [completedScores, setCompletedScores] = useState<DimensionScore[]>([]);
  
  // Orders states (save inside localStorage)
  const [orders, setOrders] = useState<Order[]>([]);

  // Assessment reports history
  const [reportHistory, setReportHistory] = useState<AssessmentRecord[]>([]);

  // For viewing historical reports in detail
  const [activeSpecializedRecordId, setActiveSpecializedRecordId] = useState<string | null>(null);
  const [activeT1Record, setActiveT1Record] = useState<AssessmentRecord | null>(null);
  const [viewingLiveT1, setViewingLiveT1] = useState(false);

  // Dropdown visibility for customer info & order details
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Profile editing modal open/close
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  const [userEmail, setUserEmail] = useState<string | null>(() => localStorage.getItem('senxinkang_user_email'));

  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [dbEnvId, setDbEnvId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Helper to get or create device ID
  const getOrCreateDeviceId = (): string => {
    let id = localStorage.getItem('senxinkang_device_id');
    if (!id) {
      id = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('senxinkang_device_id', id);
    }
    return id;
  };

  // Helper to sync state to cloud
  const syncToCloud = async (
    currentChild: Child | null,
    currentScores: DimensionScore[],
    currentOrders: Order[],
    currentHistory: AssessmentRecord[]
  ) => {
    const deviceId = getOrCreateDeviceId();
    try {
      setSyncing(true);
      const resp = await fetch('/api/db/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          deviceId,
          email: userEmail,
          child: currentChild,
          completedScores: currentScores,
          orders: currentOrders,
          reportHistory: currentHistory
        })
      });
      if (!resp.ok) {
        throw new Error(`Sync failed with status ${resp.status}`);
      }
      const ct = resp.headers.get('content-type');
      if (!ct || !ct.includes('application/json')) {
        throw new Error('服务器响应格式不正确(期望JSON格式)');
      }
      const data = await resp.json();
      if (data.success) {
        setSyncError(null);
      }
    } catch (err: any) {
      console.warn('Sync Error:', err.message);
      setSyncError(err.message || '网络连接异常');
    } finally {
      setSyncing(false);
    }
  };

  // Load from local storage and sync with Cloud Database on mount
  useEffect(() => {
    let localChild: Child | null = null;
    let localScores: DimensionScore[] = [];
    let localOrders: Order[] = [];
    let localHistory: AssessmentRecord[] = [];

    // 1. Initial hydration from localStorage (instant rendering)
    try {
      const storedChild = localStorage.getItem('senxinkang_child');
      if (storedChild) {
        localChild = JSON.parse(storedChild);
        setChild(localChild);
      }

      const storedScores = localStorage.getItem('senxinkang_scores');
      if (storedScores) {
        localScores = JSON.parse(storedScores);
        setCompletedScores(localScores);
      }

      const storedOrders = localStorage.getItem('senxinkang_orders');
      if (storedOrders) {
        localOrders = JSON.parse(storedOrders);
        setOrders(localOrders);
      }

      const storedHistory = localStorage.getItem('senxinkang_history');
      if (storedHistory) {
        localHistory = JSON.parse(storedHistory);
        setReportHistory(localHistory);
      }
    } catch (e) {
      console.error('Error hydrating state from localStorage:', e);
    }

    // 2. Fetch connection status & sync with Database
    const initCloudSync = async () => {
      try {
        const statusResp = await fetch('/api/db/status');
        if (!statusResp.ok) return;
        const statusCt = statusResp.headers.get('content-type');
        if (!statusCt || !statusCt.includes('application/json')) return;
        const statusData = await statusResp.json();
        
        setDbConfigured(statusData.configured);
        setDbEnvId(statusData.envId);

        const activeEmail = localStorage.getItem('senxinkang_user_email');
        const deviceId = getOrCreateDeviceId();
        const queryParam = activeEmail ? `email=${encodeURIComponent(activeEmail)}` : `deviceId=${deviceId}`;

        const loadResp = await fetch(`/api/db/load?${queryParam}`);
        if (!loadResp.ok) return;
        const loadCt = loadResp.headers.get('content-type');
        if (!loadCt || !loadCt.includes('application/json')) return;
        const loadData = await loadResp.json();

        if (loadData.source === 'cloud' || loadData.source === 'local_server') {
          if (loadData.child || loadData.completedScores?.length > 0) {
            // Server has data: sync to client and localStorage
            setChild(loadData.child);
            setCompletedScores(loadData.completedScores || []);
            setOrders(loadData.orders || []);
            setReportHistory(loadData.reportHistory || []);

            if (loadData.child) {
              localStorage.setItem('senxinkang_child', JSON.stringify(loadData.child));
            } else {
              localStorage.removeItem('senxinkang_child');
            }
            localStorage.setItem('senxinkang_scores', JSON.stringify(loadData.completedScores || []));
            localStorage.setItem('senxinkang_orders', JSON.stringify(loadData.orders || []));
            localStorage.setItem('senxinkang_history', JSON.stringify(loadData.reportHistory || []));
          } else if (localChild || localScores.length > 0) {
            // Server is empty but client has local data: sync local data up
            setSyncing(true);
            await fetch('/api/db/save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                deviceId,
                email: activeEmail,
                child: localChild,
                completedScores: localScores,
                orders: localOrders,
                reportHistory: localHistory
              })
            });
            setSyncing(false);
          }
        }
      } catch (err) {
        console.warn('Failed to synchronize with database on load:', err);
        setSyncing(false);
      }
    };

    initCloudSync();
  }, []);

  // Handler for successful authentication (registration or login)
  const handleAuthSuccess = (
    email: string,
    cloudChild: Child | null,
    cloudScores: DimensionScore[],
    cloudOrders: Order[],
    cloudHistory: AssessmentRecord[]
  ) => {
    setUserEmail(email);
    localStorage.setItem('senxinkang_user_email', email);

    // Update child profile, assessment scores, orders, and reports in state
    setChild(cloudChild);
    setCompletedScores(cloudScores);
    setOrders(cloudOrders);
    setReportHistory(cloudHistory);

    // Save locally
    if (cloudChild) {
      localStorage.setItem('senxinkang_child', JSON.stringify(cloudChild));
    } else {
      localStorage.removeItem('senxinkang_child');
    }
    localStorage.setItem('senxinkang_scores', JSON.stringify(cloudScores));
    localStorage.setItem('senxinkang_orders', JSON.stringify(cloudOrders));
    localStorage.setItem('senxinkang_history', JSON.stringify(cloudHistory));

    // Send back to dashboard dashboard
    setCurrentView('dashboard');
  };

  // Save states to local storage and sync to Database
  const handleSaveChild = (newChild: Child) => {
    setChild(newChild);
    localStorage.setItem('senxinkang_child', JSON.stringify(newChild));
    setCurrentView('t1_screening'); // Auto onboarding to T1 screening!
    
    // Explicit save to trigger background sync
    try {
      const deviceId = getOrCreateDeviceId();
      fetch('/api/db/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          email: userEmail,
          child: newChild,
          completedScores,
          orders,
          reportHistory
        })
      }).catch(err => {
        console.warn('Silent background save failed:', err);
      });
    } catch (e) {
      console.warn('Silent save failed:', e);
    }
  };

  const handleUpdateChild = (updatedChild: Child) => {
    setChild(updatedChild);
    localStorage.setItem('senxinkang_child', JSON.stringify(updatedChild));
    setIsEditingProfile(false);
    syncToCloud(updatedChild, completedScores, orders, reportHistory);
  };

  const handleClearProfile = () => {
    if (confirm('确认清除当前受评少儿档案并重启评测？已保存的成绩和物流状态将会复位！')) {
      setChild(null);
      setCompletedScores([]);
      setOrders([]);
      setReportHistory([]);
      localStorage.removeItem('senxinkang_child');
      localStorage.removeItem('senxinkang_scores');
      localStorage.removeItem('senxinkang_orders');
      localStorage.removeItem('senxinkang_history');
      setCurrentView('dashboard');
      syncToCloud(null, [], [], []);
    }
  };

  const handleLogout = () => {
    if (confirm('确认登出当前邮箱并返回登录首页吗？您的数据安全保存在云端。')) {
      setChild(null);
      setCompletedScores([]);
      setOrders([]);
      setReportHistory([]);
      setUserEmail(null);
      
      localStorage.removeItem('senxinkang_child');
      localStorage.removeItem('senxinkang_scores');
      localStorage.removeItem('senxinkang_orders');
      localStorage.removeItem('senxinkang_history');
      localStorage.removeItem('senxinkang_user_email');
      localStorage.removeItem('senxinkang_device_id');
      
      setCurrentView('dashboard');
      setIsCustomerDropdownOpen(false);
    }
  };

  const handleSaveScore = (result: DimensionScore, shouldGoBack: boolean = true) => {
    // Overwrite previous score of the same dimension and same tier if matching
    const updated = completedScores.filter(
      s => !(s.dimensionId === result.dimensionId && s.tierId === result.tierId)
    );
    const finalScores = [...updated, result];

    setCompletedScores(finalScores);
    localStorage.setItem('senxinkang_scores', JSON.stringify(finalScores));
    
    let updatedHistory = reportHistory;
    if (result.tierId === 'T3' && shouldGoBack && child) {
      // Generate specialized clinical diagnostic report for this dimension!
      const newRecord = generateSpecializedReportRecord(child, finalScores, result.dimensionId, result);
      
      // Save report to history
      updatedHistory = [...reportHistory.filter(r => r.id !== newRecord.id), newRecord];
      setReportHistory(updatedHistory);
      localStorage.setItem('senxinkang_history', JSON.stringify(updatedHistory));

      // Directly navigate to specialized report view!
      setActiveSpecializedRecordId(newRecord.id);
      setCurrentView('specialized_report');
      setSelectedDimensionId(null);
    } else if (shouldGoBack) {
      // Auto head back to diagnostic board
      setCurrentView('dashboard');
      setSelectedDimensionId(null);
    }
    syncToCloud(child, finalScores, orders, updatedHistory);
  };

  const handlePlaceOrder = (newOrder: Order) => {
    const updatedOrders = [...orders, newOrder];
    setOrders(updatedOrders);
    localStorage.setItem('senxinkang_orders', JSON.stringify(updatedOrders));
    syncToCloud(child, completedScores, updatedOrders, reportHistory);
  };

  const handleUpdateOrderStatus = (updatedOrder: Order) => {
    const index = orders.findIndex(o => o.id === updatedOrder.id);
    if (index !== -1) {
      const updatedList = [...orders];
      updatedList[index] = updatedOrder;
      setOrders(updatedList);
      localStorage.setItem('senxinkang_orders', JSON.stringify(updatedList));
      syncToCloud(child, completedScores, updatedList, reportHistory);
    }
  };

  const handleSaveReportToHistory = (record: AssessmentRecord) => {
    const updatedHistory = [...reportHistory.filter(r => r.id !== record.id), record];
    setReportHistory(updatedHistory);
    localStorage.setItem('senxinkang_history', JSON.stringify(updatedHistory));
    syncToCloud(child, completedScores, orders, updatedHistory);
  };

  // Find active dimension config
  const activeDimension = DIMENSIONS_DATA.find(d => d.id === selectedDimensionId);

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal font-sans flex flex-col justify-between">
      
      {/* Top Professional Master Header Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-brand-stone/60 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-brand-moss rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-brand-moss/10 scale-105">
              <span>森</span>
            </div>
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold font-sans text-brand-forest tracking-tight">森心康儿童发展评估平台</h1>
                {dbConfigured !== null && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${
                    dbConfigured 
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${dbConfigured ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
                    {dbConfigured ? '腾讯云数据库已连线' : '本地单机模式'}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-brand-charcoal/60 font-medium flex items-center gap-1.5 mt-0.5">
                <span>9维3层脑功能神经网络评估 · 数字化物理辅助 OT/PT 体系</span>
                {syncing && <span className="text-brand-moss animate-spin text-[11px]" title="正在云端保存中...">⏳</span>}
                {syncError && <span className="text-red-500 text-[9px] font-bold" title={syncError}>⚠️ 同步失败</span>}
              </div>
            </div>
          </div>

          {/* Navigation and switch views controls */}
          {child ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <nav className="flex bg-brand-beige/50 p-1 rounded-xl border border-brand-stone/40">
                <button
                  id="nav-dashboard-btn"
                  onClick={() => {
                    setCurrentView('dashboard');
                    setSelectedDimensionId(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    currentView === 'dashboard' || currentView === 'assessment'
                      ? 'bg-white text-brand-forest shadow-sm font-extrabold'
                      : 'text-brand-charcoal/80 hover:text-brand-forest'
                  }`}
                >
                  <BarChart3 size={12} />
                  筛查面板 (9维)
                </button>
                <button
                  id="nav-report-btn"
                  disabled={completedScores.length === 0}
                  onClick={() => {
                    setCurrentView('report');
                    setSelectedDimensionId(null);
                    setViewingLiveT1(false);
                    setActiveT1Record(null);
                    setActiveSpecializedRecordId(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    completedScores.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  } ${
                    currentView === 'report'
                      ? 'bg-white text-brand-forest shadow-sm font-extrabold'
                      : 'text-brand-charcoal/80 hover:text-brand-forest'
                  }`}
                >
                  <FileText size={12} />
                  诊断报告
                </button>
                <button
                  id="nav-mall-btn"
                  onClick={() => {
                    setCurrentView('mall');
                    setSelectedDimensionId(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                    currentView === 'mall'
                      ? 'bg-white text-brand-forest shadow-sm font-extrabold'
                      : 'text-brand-charcoal/80 hover:text-brand-forest'
                  }`}
                >
                  <ShoppingBag size={12} />
                  商城
                </button>
              </nav>

              {/* Interactive Customer Dropdown Service Center */}
              <div className="relative">
                <button
                  id="customer-dropdown-btn"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-brand-sage/20 hover:bg-brand-sage/35 border border-brand-stone/60 rounded-xl text-xs font-extrabold text-brand-forest transition shadow-sm cursor-pointer select-none"
                >
                  <User size={12} className="shrink-0 text-brand-moss" />
                  <span className="truncate max-w-[90px]">{child.name} ({formatAge(child.ageMonth)})</span>
                  <ChevronDown size={11} className={`text-brand-moss transition-transform duration-200 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isCustomerDropdownOpen && (
                  <>
                    {/* Dark/Translucent background overlay to detect clicks outside */}
                    <div className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]" onClick={() => setIsCustomerDropdownOpen(false)} />
                    <div className="absolute right-0 mt-3 w-88 bg-white rounded-2xl shadow-xl border border-brand-stone/50 z-50 p-4.5 space-y-4 text-xs divide-y divide-brand-stone/40 animate-fade-in text-left max-h-[85vh] overflow-y-auto">
                      
                      {/* 1. Customer Basic Profile */}
                      <div className="pb-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-extrabold text-brand-forest flex items-center gap-1.5">
                            <UserCheck size={14} className="text-brand-moss" />
                            客户服务中心
                          </h3>
                          <span className="text-[10px] px-2 py-0.5 bg-brand-sage/20 rounded-md text-brand-forest font-bold">
                            儿童健康档案
                          </span>
                        </div>
                        
                        <div className="bg-brand-beige/25 rounded-xl p-3 border border-brand-stone/40 flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-bold text-brand-forest text-sm flex items-center gap-1.5">
                              <span>{child.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-black tracking-wider bg-white text-brand-clay border border-brand-stone/30">
                                {child.gender === 'boy' ? '男童 👦' : '女童 👧'}
                              </span>
                            </div>
                            <div className="text-[10px] text-brand-charcoal/60 space-x-2">
                              <span>年龄: {formatAge(child.ageMonth)}</span>
                              <span>•</span>
                              <span>月龄: {child.ageMonth} 个月</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              setIsEditingProfile(true);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="px-2.5 py-1 bg-white hover:bg-brand-sage/20 border border-brand-stone/40 text-brand-forest rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
                            title="修改受评少儿成长档案"
                          >
                            <User size={10} className="text-brand-moss" />
                            修改档案
                          </button>
                        </div>

                        {/* Screening progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-[10px] text-brand-charcoal/60 font-semibold">
                            <span>脑功能筛查进度 ({completedScores.length}/9 维度)</span>
                            <span>{Math.round((completedScores.length / 9) * 100)}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="bg-brand-moss h-full rounded-full transition-all duration-300" 
                              style={{ width: `${(completedScores.length / 9) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* 2. Device Order Details & Shipping */}
                      <div className="pt-3.5 pb-3.5 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-extrabold text-brand-forest flex items-center gap-1.5">
                            <Package size={13} className="text-brand-moss" />
                            商城订单明细
                          </h4>
                          <button 
                            onClick={() => {
                              setCurrentView('mall');
                              setSelectedDimensionId(null);
                              setIsCustomerDropdownOpen(false);
                            }}
                            className="text-[10px] text-brand-moss hover:text-brand-forest font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            去商城
                            <ArrowRight size={10} />
                          </button>
                        </div>

                        {orders.length === 0 ? (
                          <div className="text-center py-5 bg-brand-cream/30 rounded-xl border border-dashed border-brand-stone/40 text-[10px] text-brand-charcoal/50">
                            暂无辅助康复设备订单
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
                            {orders.map((order) => (
                              <div key={order.id} className="p-2.5 bg-brand-cream/20 rounded-xl border border-brand-stone/30 space-y-2">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="font-bold text-brand-forest leading-snug">
                                    {order.product.name}
                                  </div>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                    order.status === 'delivered' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                    order.status === 'shipped' || order.status === 'delivering' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                                    'bg-amber-100 text-amber-800 border border-amber-200'
                                  }`}>
                                    {order.status === 'pending_payment' ? '待付款' :
                                     order.status === 'paid' ? '已付款' :
                                     order.status === 'shipped' ? '已发货' :
                                     order.status === 'delivering' ? '派送中' : '已签收'}
                                  </span>
                                </div>

                                <div className="flex justify-between text-[10px] text-brand-charcoal/60">
                                  <span>单价 ¥{order.product.price} · 数量 x{order.quantity}</span>
                                  <span className="font-bold text-brand-forest">总计: ¥{order.totalPrice}</span>
                                </div>

                                {order.logisticsTimeline && order.logisticsTimeline.length > 0 && (
                                  <div className="bg-white/80 p-1.5 rounded border border-brand-stone/20 text-[9px] text-brand-charcoal/70 flex items-start gap-1">
                                    <Truck size={10} className="text-indigo-600 mt-0.5 shrink-0" />
                                    <div className="line-clamp-2 leading-relaxed">
                                      <span className="font-bold text-indigo-700">最新物流:</span> {order.logisticsTimeline[0].content} ({order.logisticsTimeline[0].time})
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 3. Completed Screening Scores */}
                      <div className="pt-3.5 space-y-2.5">
                        <h4 className="font-extrabold text-brand-forest flex items-center gap-1.5">
                          <FileText size={13} className="text-brand-moss" />
                          已完成的评估成绩
                        </h4>
                        
                        {completedScores.length === 0 ? (
                          <div className="text-center py-4 text-[10px] text-brand-charcoal/50">
                            尚未完成任何康复测评
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {completedScores.map((score) => (
                              <div key={`${score.dimensionId}-${score.tierId}`} className="p-1.5 bg-brand-sage/10 rounded-lg border border-brand-stone/20 flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-brand-forest truncate text-[10px]">{score.dimensionName}</span>
                                  <span className="px-1 py-0.2 bg-white border border-brand-stone/30 rounded text-[8px] font-bold text-brand-moss shrink-0">{score.tierId}层</span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-[10px] font-bold text-brand-forest/70">{score.score}分</span>
                                  <span className={`text-[8px] font-extrabold ${
                                    score.status === 'delay' ? 'text-rose-600' :
                                    score.status === 'borderline' ? 'text-amber-600' : 'text-emerald-600'
                                  }`}>
                                    {score.status === 'delay' ? '落后' :
                                     score.status === 'borderline' ? '关注' : '正常'}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 5. Logout Profile Button */}
                      <div className="pt-3.5 pb-0.5">
                        <button
                          type="button"
                          id="logout-profile-btn"
                          onClick={handleLogout}
                          className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition duration-200 active:scale-[0.98] shadow-sm cursor-pointer"
                        >
                          <LogOut size={13} className="shrink-0 text-rose-600" />
                          <span>登出账户</span>
                        </button>
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>
          ) : userEmail ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-charcoal/60 font-medium">
                当前账户: <span className="font-bold text-brand-forest">{userEmail}</span>
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <LogOut size={12} className="text-rose-600" />
                <span>退出登录</span>
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main Container Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex items-center justify-center">
        {!userEmail ? (
          <AuthScreen onAuthSuccess={handleAuthSuccess} dbConfigured={dbConfigured} />
        ) : !child ? (
          /* Profile Registry form shown when child is unconfigured */
          <div className="py-12 animate-fade-in text-center w-full">
            <h2 className="text-2xl md:text-3xl font-black text-brand-forest tracking-tight max-w-lg mx-auto leading-tight mb-4">
              欢迎使用 <span className="text-brand-moss">森心康</span> 儿童数字测听与康复分层诊断系统
            </h2>
            <p className="text-xs text-brand-charcoal/80 max-w-md mx-auto mb-10 leading-relaxed">
              您的账户 (<span className="font-bold text-brand-forest">{userEmail}</span>) 已成功连线。为了开启全方位脑功能筛查，请填写您孩子的基本信息，登记创建成长档案。
            </p>
            <ChildProfileForm currentChild={child} onSave={handleSaveChild} />
          </div>
        ) : (
          /* Dashboard of 9 portals & corresponding tools views */
          <div className="space-y-6">
            
            {currentView === 'dashboard' ? (
              <div className="space-y-8 animate-fade-in">
                {/* Visual Hero Banner */}
                <div className="bg-gradient-to-r from-brand-forest via-brand-forest/95 to-brand-moss text-white p-6 md:p-8 rounded-3xl text-left shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
                  <div className="absolute bottom-[-10px] right-[-10px] w-48 h-48 bg-white/5 rounded-full blur-2xl" />

                  <div className="relative z-10 max-w-2xl space-y-3.5">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold bg-brand-sage/20 border border-brand-cream/10 px-3 py-1 rounded-full backdrop-blur-sm">
                      儿童生长发育评定专家
                    </span>
                    <h2 className="text-2xl md:text-3xl font-black font-sans leading-tight">
                      孩子脑神经综合发展分层评估筛查
                    </h2>
                    <p className="text-xs text-brand-sand/90 font-medium leading-relaxed">
                      请先通过“启动 T1 综合筛查”评估儿童基本指标，随后点击下方被高亮的黄色或红色警示维度卡片进行 T2、T3 能力与专项深度测算！
                    </p>
                  </div>
                </div>

                <DimensionGrid
                  completedScores={completedScores}
                  onSelectDimension={(dimId) => {
                    setSelectedDimensionId(dimId);
                    setCurrentView('assessment');
                  }}
                  onViewReport={() => setCurrentView('report')}
                  onStartT1Screening={() => setCurrentView('t1_screening')}
                />
              </div>
            ) : currentView === 't1_screening' ? (
              /* Global adaptive age-band comprehensive questionnaire T1 */
              <div className="animate-fade-in">
                <T1Screening
                  child={child}
                  onBack={() => setCurrentView('dashboard')}
                  onSaveT1Results={(t1Scores) => {
                    // Overwrite state and save
                    const updated = completedScores.filter(s => s.tierId !== 'T1');
                    const finalScores = [...updated, ...t1Scores];
                    setCompletedScores(finalScores);
                    localStorage.setItem('senxinkang_scores', JSON.stringify(finalScores));
                    setCurrentView('dashboard');
                  }}
                />
              </div>
            ) : currentView === 'assessment' && activeDimension ? (
              /* Inside selected Portal Questions screen */
              <div className="animate-fade-in">
                <AssessmentPanel
                  dimension={activeDimension}
                  onBack={() => {
                    setCurrentView('dashboard');
                    setSelectedDimensionId(null);
                  }}
                  onSaveResult={handleSaveScore}
                  existingScores={completedScores}
                />
              </div>
            ) : currentView === 'report' ? (
              /* Detailed clinic analysis reports with server-side AI report features and Specialized Archive */
              viewingLiveT1 ? (
                <div className="animate-fade-in">
                  <AnalysisReport
                    child={child}
                    completedScores={completedScores}
                    onBack={() => setViewingLiveT1(false)}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    onGoToLanguageSpecial={() => setCurrentView('language_special')}
                    historicalRecord={null}
                  />
                </div>
              ) : activeT1Record ? (
                <div className="animate-fade-in">
                  <AnalysisReport
                    child={child}
                    completedScores={activeT1Record.scores}
                    onBack={() => setActiveT1Record(null)}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    onGoToLanguageSpecial={() => setCurrentView('language_special')}
                    historicalRecord={activeT1Record}
                  />
                </div>
              ) : (
                <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-12">
                  {/* Page header */}
                  <div className="bg-white px-6 py-6 rounded-3xl border border-brand-stone shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-brand-forest tracking-tight">数字化发育档案 & 临床诊断报告库</h2>
                      <p className="text-xs text-brand-charcoal/60 font-medium mt-1">归档受测儿童历次综合筛查与临床专项深度诊断数据，符合 HIPAA 临床数据管理规范。</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-brand-sage/60 border border-brand-stone/40 px-3 py-1 rounded-full text-brand-forest font-bold">
                        受测儿：{child?.name} ({child?.gender === 'boy' ? '男' : '女'})
                      </span>
                      <button
                        onClick={() => setCurrentView('dashboard')}
                        className="px-4 py-1.5 rounded-xl border border-brand-stone/80 text-xs font-bold hover:bg-brand-sage/20 transition"
                      >
                        返回控制面板
                      </button>
                    </div>
                  </div>

                  {/* 2-Column Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left side: T1 screening reports (5 cols) */}
                    <div className="lg:col-span-5 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-6 text-left">
                      <div className="flex items-center justify-between border-b border-brand-stone/60 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-sage/60 rounded-lg flex items-center justify-center text-brand-forest">
                            <Layers size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-brand-charcoal">T1 脑发育综合筛查报告</h3>
                            <p className="text-[10px] text-brand-charcoal/50">9维度多感官神经网络基础筛查</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-brand-sage px-2 py-0.5 rounded text-brand-forest">筛查层</span>
                      </div>

                      {/* Live Screening Card */}
                      <div className="bg-brand-sage/20 border border-brand-stone/60 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] bg-brand-forest text-white font-extrabold px-1.5 py-0.5 rounded">实时动态</span>
                            <h4 className="text-xs font-bold mt-1.5 text-brand-charcoal">当前全维动态脑智筛查进度</h4>
                            <p className="text-[10px] text-brand-charcoal/60 mt-0.5">基于已导入的 T1 测评分数实时核算</p>
                          </div>
                          <span className="text-xs font-extrabold text-brand-forest">{completedScores.filter(s => s.tierId === 'T1').length}/9 维度</span>
                        </div>
                        <button
                          onClick={() => setViewingLiveT1(true)}
                          className="w-full py-2 bg-brand-forest hover:bg-brand-forest-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-brand-forest/10"
                        >
                          <Sparkles size={12} />
                          查看实时综合诊断报告
                        </button>
                      </div>

                      {/* Saved T1 Reports History List */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-brand-charcoal/70">已存归档报告：</h4>
                        {reportHistory.filter(r => r.type === 'T1_SCREENING').length === 0 ? (
                          <div className="border border-dashed border-brand-stone rounded-2xl py-6 px-4 text-center text-xs text-brand-charcoal/40">
                            暂无归档的 T1 综合筛查诊断
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                            {reportHistory
                              .filter(r => r.type === 'T1_SCREENING')
                              .map(rec => {
                                const delayCount = rec.scores.filter(s => s.status === 'delay').length;
                                return (
                                  <div
                                    key={rec.id}
                                    onClick={() => setActiveT1Record(rec)}
                                    className="border border-brand-stone/60 hover:border-brand-forest/60 hover:bg-brand-sage/5 rounded-2xl p-3.5 text-left cursor-pointer transition group"
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] text-brand-charcoal/50 font-bold">
                                        {new Date(rec.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="text-[10px] text-brand-forest font-bold flex items-center gap-0.5 group-hover:underline">
                                        查看报告 <ChevronRight size={10} />
                                      </span>
                                    </div>
                                    <h5 className="text-xs font-bold text-brand-charcoal mt-1">全维脑网络综合评估报告</h5>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 rounded px-1.5 font-medium">
                                        迟缓维度: {delayCount}
                                      </span>
                                      <span className="text-[10px] bg-brand-sage/40 text-brand-forest border border-brand-stone/40 rounded px-1.5 font-medium">
                                        已测: {rec.scores.length}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right side: T2/T3 Specialized Reports (7 cols) */}
                    <div className="lg:col-span-7 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-6 text-left">
                      <div className="flex items-center justify-between border-b border-brand-stone/60 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-brand-charcoal">T2/T3 脑网络深度专项评估成长报告</h3>
                            <p className="text-[10px] text-brand-charcoal/50">针对发育异常维度进行的高精度互动评估与脑科学数据分析</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-red-50 px-2 py-0.5 rounded text-red-600">评估层</span>
                      </div>

                      {/* Specialized reports list */}
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-brand-charcoal/70">专项深度评估报告记录：</h4>
                          <span className="text-[10px] bg-brand-stone px-2 py-0.5 rounded text-brand-charcoal/60 font-bold">
                            共 {reportHistory.filter(r => r.type === 'T2_T3_SPECIALIZED').length} 份报告
                          </span>
                        </div>

                        {reportHistory.filter(r => r.type === 'T2_T3_SPECIALIZED').length === 0 ? (
                          <div className="border border-dashed border-brand-stone rounded-3xl py-16 px-4 text-center space-y-3">
                            <div className="w-12 h-12 bg-brand-sage/30 rounded-full flex items-center justify-center mx-auto text-brand-forest/60">
                              <BookOpen size={20} />
                            </div>
                            <div className="max-w-xs mx-auto space-y-1">
                              <p className="text-xs font-bold text-brand-charcoal/60">暂无专项成长评估报告</p>
                              <p className="text-[10px] text-brand-charcoal/40">当您对某个发育领域完成 T2（能力自评）及 T3（专项互动）评估并点击“生成 AI 专项深度报告”时，报告将自动录入此处。</p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[440px] overflow-y-auto pr-1 pb-2">
                            {reportHistory
                              .filter(r => r.type === 'T2_T3_SPECIALIZED')
                              .map(rec => {
                                const t3Result = rec.scores.find(s => s.tierId === 'T3');
                                const dimensionName = rec.dimensionName || t3Result?.dimensionName || '未知专项';
                                return (
                                  <div
                                    key={rec.id}
                                    onClick={() => {
                                      setActiveSpecializedRecordId(rec.id);
                                      setCurrentView('specialized_report');
                                    }}
                                    className="bg-brand-cream/40 border border-brand-stone/60 hover:border-red-400 hover:bg-red-50/5 rounded-2xl p-4 text-left cursor-pointer transition group relative overflow-hidden"
                                  >
                                    <div className="absolute top-0 right-0 w-16 h-16 bg-red-100/10 rounded-bl-full pointer-events-none transition group-hover:bg-red-100/20" />
                                    <div className="flex justify-between items-center">
                                      <span className="text-[9px] bg-red-50 border border-red-100 text-red-600 px-1.5 py-0.5 rounded font-extrabold">
                                        深度专项成长评估
                                      </span>
                                      <span className="text-[9px] text-brand-charcoal/40 font-bold">
                                        {new Date(rec.createdAt).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })}
                                      </span>
                                    </div>

                                    <h5 className="text-sm font-black text-brand-charcoal mt-2.5 flex items-center gap-1 group-hover:text-red-700">
                                      {dimensionName} 专项评估
                                      <ChevronRight size={12} className="opacity-0 group-hover:opacity-100 transition" />
                                    </h5>

                                    <div className="space-y-1.5 mt-4 pt-3 border-t border-brand-stone/40">
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-brand-charcoal/60">表现特征:</span>
                                        <span className={`font-bold ${t3Result?.status === 'delay' ? 'text-red-500' : 'text-amber-600'}`}>
                                          {t3Result?.status === 'delay' ? '发育迟缓 (Delay)' : '边缘警示 (Borderline)'}
                                        </span>
                                      </div>
                                      <div className="flex justify-between text-[10px]">
                                        <span className="text-brand-charcoal/60">实测精确得分:</span>
                                        <span className="font-extrabold text-brand-charcoal/80">
                                          {t3Result ? `${t3Result.score}/${t3Result.maxScore} 分` : 'N/A'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            ) : currentView === 'specialized_report' ? (
              /* Display high-fidelity multi-dimensional T2/T3 specialized report */
              <div className="animate-fade-in">
                {reportHistory.find(r => r.id === activeSpecializedRecordId) ? (
                  <SpecializedReportView
                    child={child!}
                    record={reportHistory.find(r => r.id === activeSpecializedRecordId)!}
                    onBack={() => {
                      setCurrentView('report');
                      setActiveSpecializedRecordId(null);
                    }}
                    onGoToMall={() => {
                      setCurrentView('mall');
                      setActiveSpecializedRecordId(null);
                    }}
                  />
                ) : (
                  <div className="py-12 bg-white rounded-3xl border border-brand-stone p-8 text-center text-brand-charcoal/80">
                    <p>无法加载指定专项评估报告，请返回重试</p>
                    <button
                      onClick={() => setCurrentView('report')}
                      className="mt-4 px-4 py-2 bg-brand-forest text-white rounded-xl text-xs font-bold"
                    >
                      返回报告归档库
                    </button>
                  </div>
                )}
              </div>
            ) : currentView === 'language_special' ? (
              /* Deep Language and SLP Diagnostic Assessment Page */
              <div className="animate-fade-in">
                <LanguageSpecialAssessment
                  child={child}
                  onBack={() => setCurrentView('report')}
                />
              </div>
            ) : currentView === 'mall' ? (
              /* Products purchase & Logistics tracker */
              <div className="animate-fade-in">
                <WearablesMall
                  orders={orders}
                  onPlaceOrder={handlePlaceOrder}
                  onUpdateOrderStatus={handleUpdateOrderStatus}
                />
              </div>
            ) : (
              /* Fallback safety view if state gets misaligned */
              <div className="py-12 bg-white rounded-3xl border border-brand-stone p-8 text-center text-brand-charcoal/80">
                <p>视图丢失，请点击头部“筛查面板”重新载入</p>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Aesthetic footer */}
      <footer className="bg-white border-t border-brand-stone/60 py-6 mt-16 text-center text-xs text-brand-charcoal/60 font-medium relative z-10">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>© 2026 森心康（SenXinKang）儿童精准数字干预与脑科学发展技术实验室</p>
          <div className="flex justify-center gap-4 text-[10px]">
            <a href="#about" className="hover:text-brand-forest transition-colors">服务条款</a>
            <span>•</span>
            <a href="#privacy" className="hover:text-brand-forest transition-colors">隐秘保护条约（HIPAA/GDPR标准）</a>
            <span>•</span>
            <a href="#specs" className="hover:text-brand-forest transition-colors">发育评估量表归档声明</a>
          </div>
        </div>
      </footer>

      {isEditingProfile && child && (
        <EditProfileModal
          child={child}
          onSave={handleUpdateChild}
          onClose={() => setIsEditingProfile(false)}
          onResetAll={handleClearProfile}
        />
      )}
    </div>
  );
}
