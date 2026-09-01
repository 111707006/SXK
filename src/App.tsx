/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, lazy } from 'react';
import { Child, DimensionScore, MallOrder, AssessmentRecord } from './types';
import { DIMENSIONS_DATA } from './data';
import { PRODUCT } from './productConfig';
import { getOrCreateDeviceId } from './utils/deviceId';
import ChildProfileForm from './components/ChildProfileForm';
import DimensionGrid from './components/DimensionGrid';
import AnalysisReport from './components/AnalysisReport';
import T1Screening from './components/T1Screening';
import EditProfileModal from './components/EditProfileModal';
import AuthScreen from './components/AuthScreen';
import AgeBandDriftNotice from './components/AgeBandDriftNotice';

/**
 * 專案 A 專屬的大型元件，改用 lazy 載入切成獨立 chunk。
 * 專案 B（VITE_APP_MODE=t1only）的流程止於聯繫專家，永遠不會走到這些畫面，
 * 因此瀏覽器不會下載這些 chunk。檔案仍存在於建置產物中，但不載入、不執行。
 * MotionVideoAssessment 由 AssessmentPanel 內部引用，會一併切出。
 */
const AssessmentPanel = lazy(() => import('./components/AssessmentPanel'));
const WearablesMall = lazy(() => import('./components/WearablesMall'));
const LanguageSpecialAssessment = lazy(() => import('./components/LanguageSpecialAssessment'));
const SpecializedReportView = lazy(() => import('./components/SpecializedReportView'));
const Paywall = lazy(() => import('./components/Paywall'));

import LazyBoundary from './components/LazyBoundary';
import { generateSpecializedReportRecord } from './utils/reportUtils';
import { calculateAgeMonth, formatAge, refreshChildAge } from './utils/dateUtils';
import { ageBandDrift, latestAssessedAgeMonth } from './utils/ageBandDrift';
import { useToday } from './utils/useToday';
import { authFetch, setUnauthorizedHandler } from './utils/api';
import { getDimensionAccess, isPaywallActive } from './utils/access';
import { DEFAULT_UNLOCK_PRICE_FEN, formatFen } from './utils/price';
import { BeianFooter } from './components/BeianFooter';
import { 
  Activity, ShoppingBag, BarChart3, User, RefreshCw, 
  Heart, HeartHandshake, FileText, CheckCircle2, ListFilter,
  ChevronDown, Truck, Package, LogOut, ArrowRight, UserCheck,
  BookOpen, Award, Layers, ShieldCheck, ChevronRight, Sparkles
} from 'lucide-react';

export default function App() {
  /** 孩子檔案，**照存下來的樣子**。上面的 `ageMonth` 是寫入當下的值，會過期。 */
  const [childProfile, setChildProfile] = useState<Child | null>(null);

  const today = useToday();

  /**
   * 畫面上的孩子 —— 實足月齡永遠是**算到今天**的。
   *
   * 存下來的 `ageMonth` 是寫入當下算出來的，放著就會過期，而它決定篩查出哪一段
   * 的題目。與其在每一條寫入路徑上記得重算一次（漏掉一條就沒有人會發現），不如
   * 讓它成為推導值：`childProfile` 或 `today` 一變，這裡就跟著變。
   *
   * 全App 只有這一個地方重算。篩查紀錄裡的 `child` **不經過這裡**：那是測評月齡，
   * 是那一次篩查的事實記錄，永不重算。
   */
  const child = useMemo(() => refreshChildAge(childProfile, today), [childProfile, today]);

  /**
   * 今天真的算得出來的實足月齡；算不出來就是 `null`。
   *
   * 與 `child.ageMonth` 的差別是**誠實**，而不是數值：沒有出生日期時
   * `refreshChildAge` 會把孩子原樣回傳（它沒有東西可以算），於是 `child.ageMonth`
   * 是當初寫進檔案的那個數字，**放著就會過期而且看不出來**。用它來取干預包，
   * 一個檔案裡寫著 23 個月、實際四歲的孩子會拿到 A 段的訓練 —— 而畫面上那個
   * 年齡段標籤是照同一個數字算的，所以前後完全自洽，沒有一處看起來不對。
   *
   * 篩查那一側可以接受這個舊值（那是既有行為，且畫面上另有跨段提示）；
   * 干預包不行 —— 它的全部價值就是「這組訓練配得上孩子今天的能力」。
   */
  const liveAgeMonth = useMemo(
    () => (childProfile?.birthDate ? calculateAgeMonth(childProfile.birthDate, today) : null),
    [childProfile, today]
  );

  // Navigation: 'dashboard' | 't1_screening' | 'assessment' | 'report' | 'mall' | 'language_special' | 'specialized_report' | 'paywall'
  const [currentView, setCurrentView] = useState<'dashboard' | 't1_screening' | 'assessment' | 'report' | 'mall' | 'language_special' | 'specialized_report' | 'paywall'>('dashboard');
  
  const [selectedDimensionId, setSelectedDimensionId] = useState<string | null>(null);
  
  // Scoring record states (save inside localStorage on update for persistence!)
  const [completedScores, setCompletedScores] = useState<DimensionScore[]>([]);
  
  // Orders states (save inside localStorage)
  const [orders, setOrders] = useState<MallOrder[]>([]);

  // Assessment reports history
  const [reportHistory, setReportHistory] = useState<AssessmentRecord[]>([]);

  // For viewing historical reports in detail
  const [activeSpecializedRecordId, setActiveSpecializedRecordId] = useState<string | null>(null);
  const [activeT1Record, setActiveT1Record] = useState<AssessmentRecord | null>(null);
  const [viewingLiveT1, setViewingLiveT1] = useState(false);
  // 專案 B 從維度卡片進報告時，要求報告頁捲到專家預約區塊。
  // 從導覽列或「查看報告」進來時為 false，維持原本停在頁首的行為。
  const [focusBooking, setFocusBooking] = useState(false);

  // Dropdown visibility for customer info & order details
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  // Profile editing modal open/close
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  /**
   * 畫面上顯示的那一個帳號 —— 手機號或（舊帳號的）電子郵件。
   *
   * **只是一個標籤，不是識別鍵。** 讀寫孩子檔案與分數認的是通行證裡的使用者
   * id（見 `authHeaders`）；這個值換成手機號時，資料層一個字都不必動。
   *
   * localStorage 的鍵仍是 `senxinkang_user_email`：改掉它會讓每一位已登入的
   * 家長在下次開啟時被登出，而它只是一個鍵名。
   */
  const [userIdentity, setUserIdentity] = useState<string | null>(() => localStorage.getItem('senxinkang_user_email'));
  const [authToken, setAuthToken] = useState<string | null>(() => localStorage.getItem('senxinkang_token'));

  // ── 付費解鎖狀態 ──
  // 存取權的唯一真實來源是後端（`GET /api/unlocks`），這裡存的只是畫面用的快取。
  // 真正的閘門在 server.ts 的 denyIfLocked —— 前端擋畫面、後端擋資料。
  /** 已解鎖的維度；`null` 代表尚未查到（判斷上等同未解鎖）。 */
  const [unlockedDimensionIds, setUnlockedDimensionIds] = useState<string[] | null>(null);
  /** 後端是否有持久層可承載購買；`null` 代表尚未確定，一律當作付費牆會執行。 */
  const [unlocksAvailable, setUnlocksAvailable] = useState<boolean | null>(null);
  /** 單價（分）。以後端回傳為準，前端不自己寫死金額。 */
  const [unlockPriceFen, setUnlockPriceFen] = useState<number>(DEFAULT_UNLOCK_PRICE_FEN);
  /** 付費牆正在處理的維度 */
  const [paywallDimensionId, setPaywallDimensionId] = useState<string | null>(null);

  const [dbConfigured, setDbConfigured] = useState<boolean | null>(null);
  const [dbEnvId, setDbEnvId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  /**
   * 給家長看的一句話，登入頁上方那條橫幅。
   *
   * 與 `syncError` 分開，因為兩者的可見度不是同一件事：`syncError` 畫成頁首
   * 一個 9px 的「⚠️ 同步失败」，訊息本體藏在 `title` 裡 —— 共用 iPad 上沒有
   * 滑鼠，那句話等於不存在。而「你被登出了」是家長必須讀到才知道要重新登入的。
   */
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // authHeaders 已移到 src/utils/api.ts —— 深度評估端點現在也要帶 token，
  // 而呼叫它們的元件在別的檔案裡，各拼各的標頭遲早會漏掉一個。

  /**
   * 把這台裝置上的登入痕跡與本機快取一併清掉。
   *
   * 登出與「通行證已經不算數了」共用同一段 —— 兩者留下的狀態必須一模一樣，
   * 否則其中一條路會留下半個登入。
   *
   * 連本機的孩子檔案一起清，是因為它已經沒有主人了：留著的話，下一個在這台
   * iPad 上登入的人會把前一個孩子的檔案同步到自己的帳號下（伺服器那一份是空的
   * 時候，這支程式會把本機這一份送上去）。合作公司的 iPad 是共用的。
   */
  const clearLocalSession = () => {
    setChildProfile(null);
    setCompletedScores([]);
    setOrders([]);
    setReportHistory([]);
    setUserIdentity(null);
    setAuthToken(null);

    localStorage.removeItem('senxinkang_child');
    localStorage.removeItem('senxinkang_scores');
    localStorage.removeItem('senxinkang_orders');
    localStorage.removeItem('senxinkang_history');
    localStorage.removeItem('senxinkang_user_email');
    localStorage.removeItem('senxinkang_token');
    localStorage.removeItem('senxinkang_device_id');
  };

  /**
   * 伺服器說這張通行證不算數（401）。**這件事必須看得見。**
   *
   * 畫面上「已登入」是 localStorage 裡的一個字串撐著的，而同步認的是通行證。
   * 兩者分家時（token 過期、或那是一張舊格式的通行證），家長會對著自己的孩子
   * 檔案做完一整份篩查，而每一次保存都被退回 —— 靜靜地退回，因為讀取那條路
   * 原本連狀態碼都沒看。#27 之後更沒有退路：電子郵件登入不在了，而他不會自己
   * 想到要按登出。
   */
  const handleSessionExpired = () => {
    clearLocalSession();
    setSyncError(null);
    setSessionNotice('登录状态已失效，请重新登录。您已完成的评估已保存在云端，重新登录后即可看到。');
    setCurrentView('dashboard');
  };

  /**
   * 401 只在 `authFetch` 裡認一次，所以每一支帶通行證的請求都算數 ——
   * 不只是這個檔案裡的四支。掛載時登記一次就夠：`handleSessionExpired`
   * 只呼叫 setState，而那些函式的身分在整個生命週期裡不變。
   */
  useEffect(() => {
    setUnauthorizedHandler(handleSessionExpired);
    return () => setUnauthorizedHandler(null);
  }, []);

  // Helper to sync state to cloud
  const syncToCloud = async (
    currentChild: Child | null,
    currentScores: DimensionScore[],
    currentOrders: MallOrder[],
    currentHistory: AssessmentRecord[]
  ) => {
    const deviceId = getOrCreateDeviceId();
    try {
      setSyncing(true);
      // 不送任何識別欄位 —— 家長是誰由 `authHeaders()` 帶的通行證決定。
      // 客戶端送上來的識別鍵不是身分，伺服器也不再看它。
      const resp = await authFetch('/api/db/save', {
        method: 'POST',
        body: JSON.stringify({
          deviceId,
          child: currentChild,
          completedScores: currentScores,
          orders: currentOrders,
          reportHistory: currentHistory
        })
      });
      // 401 的處置已經在 `authFetch` 裡發生（登出並回登入頁）。這裡只是不要
      // 再把它畫成一次同步失敗 —— 家長看到的該是「請重新登入」那一句。
      if (resp.status === 401) return;
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

  /**
   * 分頁標題。`index.html` 是兩個建置共用的同一份靜態檔，裡面的 `<title>`
   * 沒辦法依 VITE_APP_MODE 分歧，所以改在執行期設定 —— 專案 B 的分頁上
   * 不該出現「森心康」。
   */
  useEffect(() => {
    document.title = PRODUCT.brand.documentTitle;
  }, []);

  // Load from local storage and sync with Cloud Database on mount
  useEffect(() => {
    let localChild: Child | null = null;
    let localScores: DimensionScore[] = [];
    let localOrders: MallOrder[] = [];
    let localHistory: AssessmentRecord[] = [];

    // 1. Initial hydration from localStorage (instant rendering)
    try {
      const storedChild = localStorage.getItem('senxinkang_child');
      if (storedChild) {
        localChild = JSON.parse(storedChild);
        setChildProfile(localChild);
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

        const activeToken = localStorage.getItem('senxinkang_token');
        const deviceId = getOrCreateDeviceId();
        // 有通行證就讀自己的那一份（識別鍵在通行證裡，不放進網址）；沒有才讀
        // 裝置紀錄。兩者不併送 —— 帶著過期的通行證卻附上 deviceId，伺服器就得
        // 在「你是誰」與「這台裝置上有什麼」之間挑一個，而挑錯的那一次會把別的
        // 孩子的檔案端到已登入的家長面前。
        const loadUrl = activeToken ? '/api/db/load' : `/api/db/load?deviceId=${deviceId}`;

        const loadResp = await authFetch(loadUrl);
        // 通行證不算數就地了結，不要繼續用一個伺服器不認得的身分跑下去 ——
        // 底下那條「伺服器是空的就把本機這一份送上去」的路會一路撞到同一個
        // 401。登出本身已經由 `authFetch` 做掉了，這裡只負責停下來。
        if (loadResp.status === 401) return;
        if (!loadResp.ok) return;
        const loadCt = loadResp.headers.get('content-type');
        if (!loadCt || !loadCt.includes('application/json')) return;
        const loadData = await loadResp.json();

        if (loadData.source === 'mysql' || loadData.source === 'memory') {
          if (loadData.child || loadData.completedScores?.length > 0) {
            // Server has data: sync to client and localStorage
            setChildProfile(loadData.child);
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
            // Server is empty but client has local data: sync local data up.
            // 走 `syncToCloud` 而不是自己再拼一次請求 —— 手拼的那一份沒有狀態碼
            // 檢查、沒有 401 處置、失敗也不會留下任何痕跡，而它送的是家長目前
            // 唯一的一份資料。
            await syncToCloud(localChild, localScores, localOrders, localHistory);
          }
        }
      } catch (err) {
        console.warn('Failed to synchronize with database on load:', err);
        setSyncing(false);
      }
    };

    initCloudSync();
  }, []);

  /**
   * 讀取已解鎖的維度。登入狀態改變就重讀 —— 換帳號後沿用上一個帳號的權益，
   * 就是把付費內容送給下一個登入的人。
   *
   * 專案 B 不發這個請求：`/api/unlocks` 註冊在 `paidOnly` 上，B 的伺服器
   * 根本沒有這條路由。
   */
  useEffect(() => {
    if (!PRODUCT.features.paywall) return;
    if (!userIdentity) {
      setUnlockedDimensionIds(null);
      setUnlocksAvailable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const resp = await authFetch('/api/unlocks');
        const ct = resp.headers.get('content-type');
        if (!resp.ok || !ct || !ct.includes('application/json')) return;
        const data = await resp.json();
        if (cancelled) return;
        setUnlockedDimensionIds(Array.isArray(data.dimensionIds) ? data.dimensionIds : []);
        setUnlocksAvailable(data.available === true);
        if (typeof data.priceFen === 'number' && data.priceFen > 0) setUnlockPriceFen(data.priceFen);
      } catch (err) {
        // 保持 null（尚未確定）—— 讀不到權益時 fail-closed，不樂觀放行。
        console.warn('Failed to load unlocked dimensions:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userIdentity, authToken]);

  /**
   * 進入某維度的深度評估，未解鎖則先過付費牆。
   *
   * `target` 讓語言專項走同一道檢查 —— 它是語言維度的 T2/T3 內容，
   * 另開一條不檢查的路等於在付費牆旁邊挖一個洞。
   */
  const enterDimension = (dimensionId: string, target: 'assessment' | 'language_special' = 'assessment') => {
    const access = getDimensionAccess(dimensionId, {
      paywallEnabled: PRODUCT.features.paywall,
      unlocksAvailable,
      isLoggedIn: Boolean(userIdentity),
      unlockedDimensionIds,
    });
    // locked 與 demo 去的是同一個畫面，但結果相反：前者過不去，後者可以略過。
    // 略過的入口只在 demo 下渲染，所以資料庫一接上它就消失。
    if (access === 'locked' || access === 'demo') {
      setPaywallDimensionId(dimensionId);
      setCurrentView('paywall');
      return;
    }
    // needs_login 時整個畫面本來就會是 AuthScreen（main 區塊以 userIdentity 判斷），
    // 這裡不另做導向。
    if (target === 'language_special') {
      setCurrentView('language_special');
      return;
    }
    setSelectedDimensionId(dimensionId);
    setCurrentView('assessment');
  };

  // Handler for successful authentication (registration or login)
  //
  // `identity` 是拿來顯示的標籤（手機號，或舊帳號的電子郵件），不是識別鍵 ——
  // 識別鍵在 `token` 裡，而那是唯一被伺服器採信的東西。
  const handleAuthSuccess = (
    identity: string,
    token: string | null,
    cloudChild: Child | null,
    cloudScores: DimensionScore[],
    cloudOrders: MallOrder[],
    cloudHistory: AssessmentRecord[]
  ) => {
    setUserIdentity(identity);
    setSessionNotice(null);
    localStorage.setItem('senxinkang_user_email', identity);
    setAuthToken(token);
    if (token) {
      localStorage.setItem('senxinkang_token', token);
    } else {
      localStorage.removeItem('senxinkang_token');
    }

    // Update child profile, assessment scores, orders, and reports in state
    setChildProfile(cloudChild);
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
    setChildProfile(newChild);
    localStorage.setItem('senxinkang_child', JSON.stringify(newChild));
    setCurrentView('dashboard'); // Go to dashboard to let user choose to enter T1

    // Explicit save to trigger background sync.
    //
    // 走 `syncToCloud`。原本這裡是自己拼的一支 `fetch`，只掛了 `.catch` ——
    // 而 401 是一個**成功兌現**的 Promise，`.catch` 不會被呼叫到：通行證過期的
    // 家長會看到檔案存好了、繼續做完一整份篩查，而伺服器那邊一個字都沒收到。
    syncToCloud(newChild, completedScores, orders, reportHistory);
  };

  const handleUpdateChild = (updatedChild: Child) => {
    setChildProfile(updatedChild);
    localStorage.setItem('senxinkang_child', JSON.stringify(updatedChild));
    setIsEditingProfile(false);
    syncToCloud(updatedChild, completedScores, orders, reportHistory);
  };

  const handleClearProfile = () => {
    if (confirm('确认清除当前受评少儿档案并重启评测？已保存的成绩和物流状态将会复位！')) {
      setChildProfile(null);
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
    if (confirm('确认登出当前账户并返回登录首页吗？您的数据安全保存在云端。')) {
      clearLocalSession();
      setSyncError(null);
      // 自己按的登出不需要那條橫幅 —— 他知道剛剛發生了什麼。
      setSessionNotice(null);
      setCurrentView('dashboard');
      setIsCustomerDropdownOpen(false);
    }
  };

  const handleSaveScore = (result: DimensionScore, shouldGoBack: boolean = true, aiReportOverride?: AssessmentRecord['aiReport'] | null) => {
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
      const newRecord = generateSpecializedReportRecord(child, finalScores, result.dimensionId, result, aiReportOverride);
      
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

  const handlePlaceOrder = (newOrder: MallOrder) => {
    const updatedOrders = [...orders, newOrder];
    setOrders(updatedOrders);
    localStorage.setItem('senxinkang_orders', JSON.stringify(updatedOrders));
    syncToCloud(child, completedScores, updatedOrders, reportHistory);
  };

  const handleUpdateOrderStatus = (updatedOrder: MallOrder) => {
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

  /**
   * 把家長送到報告頁的專家預約區塊。
   *
   * **優先走已歸檔的那一份報告**，而不是即時報告。預約區塊在 `{aiReport && …}`
   * 裡面，即時報告的 `aiReport` 一開始是 null —— 家長按下「联系专家」會落在一頁
   * 看不到專家區塊的報告上，還得自己先按一次「生成 AI 发展报告」才看得到。
   * 已歸檔的那一份帶著 `aiReport` 進去，區塊當場就在，捲動也才捲得到東西。
   *
   * 一份都沒有時退回即時報告 —— 那時本來就沒有報告可看，這是誠實的去向。
   */
  const goToExpertBooking = () => {
    // 時間讀不出來的當成空字串再比 —— 任何正常的時間都比空字串大，所以一筆
    // `createdAt` 壞掉的紀錄不會只因為排在前面就贏過所有正常的紀錄（同
    // `ageBandDrift.ts` 的 `latestBy`；雲端同步回來的歷史紀錄真的會缺這個欄位）。
    const timeOf = (r: AssessmentRecord) => (typeof r.createdAt === 'string' ? r.createdAt : '');
    const archived = reportHistory
      .filter(r => r.type === 'T1_SCREENING' && r.aiReport)
      .reduce<AssessmentRecord | null>(
        (latest, r) => (!latest || timeOf(r) >= timeOf(latest) ? r : latest),
        null
      );
    setActiveSpecializedRecordId(null);
    setViewingLiveT1(!archived);
    setActiveT1Record(archived);
    setFocusBooking(true);
    setCurrentView('report');
  };

  // Find active dimension config
  const activeDimension = DIMENSIONS_DATA.find(d => d.id === selectedDimensionId);
  const paywallDimension = DIMENSIONS_DATA.find(d => d.id === paywallDimensionId);

  /**
   * 孩子的實足月齡是否已經跨出上一次篩查所在的年齡段。
   *
   * 與 `child` 一樣是**推導值**：`today` 一往前走就跟著重算，所以一個開著不動的
   * 分頁跨過生日當天也會自己長出提示。判斷本身在 `ageBandDrift`（純函式，有測試），
   * 這裡只負責把資料餵進去。
   *
   * `reportHistory` 只是**讀**來找測評月齡，一筆都沒有被過濾或改寫 —— 舊報告照常
   * 可讀是這張票的驗收條件之一。
   */
  const bandDrift = useMemo(
    () => ageBandDrift(child?.ageMonth, latestAssessedAgeMonth(completedScores, reportHistory)),
    [child?.ageMonth, completedScores, reportHistory]
  );

  // 付費 UI 是否該出現。只有專案 B 完全沒有 —— 展示模式仍要看得到付費牆長什麼樣子。
  const paywallActive = isPaywallActive({ paywallEnabled: PRODUCT.features.paywall });
  const accessOf = (dimensionId: string) => getDimensionAccess(dimensionId, {
    paywallEnabled: PRODUCT.features.paywall,
    unlocksAvailable,
    isLoggedIn: Boolean(userIdentity),
    unlockedDimensionIds,
  });
  // 卡片上要顯示 ¥19.9 徽章的維度：真的鎖住的，以及展示模式下「本來會鎖住」的。
  const lockedDimensionIds = paywallActive
    ? DIMENSIONS_DATA.filter(d => ['locked', 'demo'].includes(accessOf(d.id))).map(d => d.id)
    : [];
  /**
   * 路由層的最後一道 —— **只認 `locked`**。展示模式略過付費牆之後仍要進得去，
   * 所以不能拿上面那個含 `demo` 的清單來擋。
   */
  const isRouteBlocked = (dimensionId: string) => accessOf(dimensionId) === 'locked';

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal font-sans flex flex-col justify-between">
      
      {/* Top Professional Master Header Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-brand-stone/60 shadow-sm backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-brand-moss rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-brand-moss/10 scale-105">
              <span>{PRODUCT.brand.logoMark}</span>
            </div>
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-base font-extrabold font-sans text-brand-forest tracking-tight">{PRODUCT.brand.headerTitle}</h1>
                {/* 建置模式徽章：文案與配色皆來自 productConfig，這裡不判斷 mode */}
                <span
                  id="build-mode-badge"
                  title={PRODUCT.buildBadge.title}
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-black tracking-wide whitespace-nowrap shadow-sm ${PRODUCT.buildBadge.className}`}
                >
                  {PRODUCT.buildBadge.label}
                </span>
              </div>
              <div className="text-[10px] text-brand-charcoal/60 font-medium flex items-center gap-1.5 mt-0.5">
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
                  评估面板 (9维)
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
                    // 從導覽列進來是「我要看報告」，不是「帶我去預約」。這一行少了
                    // 的話，按過一次干預包的「联系专家」之後，此後每一份報告都會
                    // 自己捲到最底下的預約區塊 —— 而家長沒有要求過那件事。
                    setFocusBooking(false);
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
                  评估报告
                </button>
                {PRODUCT.features.mall && (
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
                )}
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
                            <span>脑功能评估进度 ({completedScores.length}/9 维度)</span>
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

                      {/* 2. Device Order Details & Shipping (專案 A only) */}
                      {PRODUCT.features.mall && (
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
                      )}

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
          ) : userIdentity ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-charcoal/60 font-medium">
                当前账户: <span className="font-bold text-brand-forest">{userIdentity}</span>
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
        {!userIdentity ? (
          <div className="w-full flex flex-col items-center gap-5">
            {/* 被登出這件事必須讀得到，不能只有頁首那個 9px 的徽章。 */}
            {sessionNotice && (
              <div
                id="session-expired-notice"
                role="alert"
                className="w-full max-w-md rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-left text-xs font-bold leading-relaxed text-amber-900 shadow-sm"
              >
                {sessionNotice}
              </div>
            )}
            <AuthScreen onAuthSuccess={handleAuthSuccess} dbConfigured={dbConfigured} />
          </div>
        ) : !child ? (
          /* Profile Registry form shown when child is unconfigured */
          <div className="py-12 animate-fade-in text-center w-full">
            <h2 className="text-2xl md:text-3xl font-black text-brand-forest tracking-tight max-w-lg mx-auto leading-tight mb-4">
              {/* 專案 B 的 welcomeName 是 null —— 整個強調 span 不渲染，不是留一個空的 */}
              欢迎使用{PRODUCT.brand.welcomeName && <> <span className="text-brand-moss">{PRODUCT.brand.welcomeName}</span> </>}儿童综合发展评估
            </h2>
            <p className="text-xs text-brand-charcoal/80 max-w-md mx-auto mb-10 leading-relaxed">
              您的账户 (<span className="font-bold text-brand-forest">{userIdentity}</span>) 已成功连线。为了开启全方位脑功能评估，请填写您孩子的基本信息，登记创建成长档案。
            </p>
            <ChildProfileForm currentChild={child} onSave={handleSaveChild} />
          </div>
        ) : (
          /*
            Dashboard of 9 portals & corresponding tools views

            `min-w-0` 不是排版微調，拿掉會在手機上把整頁往左推出畫面。

            外層 `<main>` 是 `flex ... justify-center`，這個 div 是它唯一的
            flex item，而 flex item 預設 `min-width: auto` —— 縮不到自己內容的
            最小寬度以下。iPhone（375px）上報告頁的內容最小寬約 491px，大於
            可用的 343px，於是 item 撐到 491 溢出容器，`justify-center` 再把
            多出來的 148px 平均分到左右兩邊，item 的左緣落在 x = -58。

            右邊那 58px 捲得到（scrollWidth 只計右側溢出），左邊那 58px
            **永遠捲不回來**：報告標題、維度卡片的左緣就是這樣被切掉的。

            `min-w-0` 解除下限，item 縮回 343px 正常換行。刻意不用 `w-full`：
            那會讓桌機上原本依內容寬置中的版面（實測 723px）變成滿版 1216px，
            修手機的同時改掉了桌機。上面兩個分支用 `w-full` 是因為它們本來就
            該滿版，不是同一件事。
          */
          <div className="min-w-0 space-y-6">
            
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
                      儿童神经网络综合发展评估
                    </h2>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-brand-sand/90 font-medium"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-moss/40 text-[10px] font-bold mr-1">1</span>点击「启动 T1 综合评估」，完成基础评估</p>
                      <p className="text-xs text-brand-sand/90 font-medium"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-moss/40 text-[10px] font-bold mr-1">2</span>{PRODUCT.dashboard.stepTwoHint}{PRODUCT.dashboard.stepTwoIsPaid && <span className="inline-block ml-0.5 px-1 py-0 rounded bg-amber-400/90 text-[9px] font-bold text-brand-moss align-middle">VIP</span>}</p>
                    </div>
                  </div>
                </div>

                {/*
                  跨年齡段的提示。放在維度卡片**之上** —— 家長讀那九張卡片上的
                  燈號之前就得知道它們是用另一組題目測出來的。
                */}
                <AgeBandDriftNotice
                  drift={bandDrift}
                  onStartT1Screening={() => setCurrentView('t1_screening')}
                />

                <DimensionGrid
                  completedScores={completedScores}
                  onSelectDimension={(dimId) => {
                    // 去向由 productConfig 決定，不在這裡判斷模式：
                    // A → 該維度的深度評估；B → 報告頁的專家預約區塊。
                    if (PRODUCT.nextStep.action === 'contact_expert') {
                      setViewingLiveT1(true);
                      setActiveT1Record(null);
                      setActiveSpecializedRecordId(null);
                      setFocusBooking(true);
                      setCurrentView('report');
                      return;
                    }
                    enterDimension(dimId);
                  }}
                  lockedDimensionIds={lockedDimensionIds}
                  unlockPriceLabel={paywallActive ? formatFen(unlockPriceFen) : null}
                  onViewReport={() => {
                    // Jump straight to the live T1 AI report page, skipping the archive/library page.
                    setViewingLiveT1(true);
                    setActiveT1Record(null);
                    setActiveSpecializedRecordId(null);
                    setFocusBooking(false);
                    setCurrentView('report');
                  }}
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
                    // Go straight to the live AI report instead of bouncing off the
                    // dashboard. The user still taps "一键启动 AI 突触分析" there, so
                    // finishing T1 never spends AI quota on its own.
                    setViewingLiveT1(true);
                    setActiveT1Record(null);
                    setActiveSpecializedRecordId(null);
                    setCurrentView('report');
                  }}
                />
              </div>
            ) : currentView === 'assessment' && activeDimension && PRODUCT.features.tier2And3 && !isRouteBlocked(activeDimension.id) ? (
              /* Inside selected Portal Questions screen */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <AssessmentPanel
                    dimension={activeDimension}
                    child={child}
                    onBack={() => {
                      setCurrentView('dashboard');
                      setSelectedDimensionId(null);
                    }}
                    onSaveResult={handleSaveScore}
                    existingScores={completedScores}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 'report' ? (
              /* Detailed clinic analysis reports with server-side AI report features and Specialized Archive */
              viewingLiveT1 ? (
                <div className="animate-fade-in">
                  <AnalysisReport
                    child={child}
                    completedScores={completedScores}
                    onBack={() => {
                      setViewingLiveT1(false);
                      setFocusBooking(false);
                    }}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    onGoToLanguageSpecial={PRODUCT.features.tier2And3 ? () => enterDimension('language', 'language_special') : undefined}
                    historicalRecord={null}
                    focusBooking={focusBooking}
                  />
                </div>
              ) : activeT1Record ? (
                <div className="animate-fade-in">
                  <AnalysisReport
                    child={child}
                    completedScores={activeT1Record.scores}
                    onBack={() => {
                      setActiveT1Record(null);
                      setFocusBooking(false);
                    }}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    onGoToLanguageSpecial={PRODUCT.features.tier2And3 ? () => enterDimension('language', 'language_special') : undefined}
                    historicalRecord={activeT1Record}
                    // 從干預包的「联系专家」進來時要捲到預約區塊 —— 這一支是
                    // `goToExpertBooking` 優先走的那一條路（已歸檔的報告帶著
                    // aiReport，區塊當場就在）。少了這個 prop，捲動只在即時報告
                    // 那一支生效，而那一支正好是區塊還沒出現的那一支。
                    focusBooking={focusBooking}
                  />
                </div>
              ) : (
                <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-12">
                  {/* Page header */}
                  <div className="bg-white px-6 py-6 rounded-3xl border border-brand-stone shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-brand-forest tracking-tight">综合发育评估报告库</h2>
                      <p className="text-xs text-brand-charcoal/60 font-medium mt-1">历次综合评估与专项深度评估数据资料库，符合隐私保护条款管理规范。</p>
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
                            <h3 className="text-sm font-black text-brand-charcoal">儿童综合发展评估报告</h3>
                            <p className="text-[10px] text-brand-charcoal/50">9维度多感官神经网络基础评估</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold bg-brand-sage px-2 py-0.5 rounded text-brand-forest">评估层</span>
                      </div>

                      {/* Live Screening Card */}
                      <div className="bg-brand-sage/20 border border-brand-stone/60 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] bg-brand-forest text-white font-extrabold px-1.5 py-0.5 rounded">实时动态</span>
                            <h4 className="text-xs font-bold mt-1.5 text-brand-charcoal">当前全维动态脑智评估进度</h4>
                            <p className="text-[10px] text-brand-charcoal/60 mt-0.5">基于已导入的 T1 测评分数实时核算</p>
                          </div>
                          <span className="text-xs font-extrabold text-brand-forest">{completedScores.filter(s => s.tierId === 'T1').length}/9 维度</span>
                        </div>
                        <button
                          onClick={() => setViewingLiveT1(true)}
                          className="w-full py-2 bg-brand-forest hover:bg-brand-forest-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-brand-forest/10"
                        >
                          <Sparkles size={12} />
                          查看实时综合评估报告
                        </button>
                      </div>

                      {/* Saved T1 Reports History List */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-brand-charcoal/70">已存归档报告：</h4>
                        {reportHistory.filter(r => r.type === 'T1_SCREENING').length === 0 ? (
                          <div className="border border-dashed border-brand-stone rounded-2xl py-6 px-4 text-center text-xs text-brand-charcoal/40">
                            暂无归档的 T1 综合评估
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
                                    onClick={() => {
                                      setActiveT1Record(rec);
                                      // 從歸檔清單點進來的報告要從頭看起。
                                      // `focusBooking` 是上一次「联系专家」留下的
                                      // 旗標，不清掉就會把這一份也捲到預約區塊。
                                      setFocusBooking(false);
                                    }}
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
                                    <h5 className="text-xs font-bold text-brand-charcoal mt-1">儿童综合发展评估报告</h5>
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

                    {/* Right side: T2/T3 Specialized Reports (7 cols) — 專案 A only */}
                    {PRODUCT.features.tier2And3 && (
                    <div className="lg:col-span-7 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-6 text-left">
                      <div className="flex items-center justify-between border-b border-brand-stone/60 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
                            <ShieldCheck size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-brand-charcoal">T2/T3 神经网络深度专项评估成长报告</h3>
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
                    )}
                  </div>
                </div>
              )
            ) : currentView === 'specialized_report' && PRODUCT.features.tier2And3 ? (
              /* Display high-fidelity multi-dimensional T2/T3 specialized report */
              <div className="animate-fade-in">
                {reportHistory.find(r => r.id === activeSpecializedRecordId) ? (
                  <LazyBoundary>
                    <SpecializedReportView
                      record={reportHistory.find(r => r.id === activeSpecializedRecordId)!}
                      onBack={() => {
                        setCurrentView('report');
                        setActiveSpecializedRecordId(null);
                      }}
                      onGoToMall={PRODUCT.features.mall ? () => {
                        setCurrentView('mall');
                        setActiveSpecializedRecordId(null);
                      } : undefined}
                      /* 干預包照**今天**的實足月齡與**今天**的判定取，兩者都不是
                         這份報告當時的快照：那是家長現在要在家做的訓練，難度要配
                         得上孩子今天做得到什麼、強度要配得上他今天的結果。
                         用 `liveAgeMonth` 而不是 `child.ageMonth` —— 後者在沒有
                         出生日期時是一個過期而且看不出來的舊數字（見其定義）。 */
                      currentAgeMonth={liveAgeMonth}
                      currentScores={completedScores}
                      // 素材還沒到位的格子要有一條**真的**出路，不是一顆把家長
                      // 丟到報告頁自己找的按鈕。見 `goToExpertBooking`。
                      onContactExpert={goToExpertBooking}
                    />
                  </LazyBoundary>
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
            ) : currentView === 'paywall' && PRODUCT.features.tier2And3 && PRODUCT.features.paywall && paywallDimension ? (
              /* 單一維度 T2+T3 的付費解鎖牆（僅專案 A） */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <Paywall
                    dimension={paywallDimension}
                    priceFen={unlockPriceFen}
                    isDemo={accessOf(paywallDimension.id) === 'demo'}
                    onBack={() => setCurrentView('dashboard')}
                    onAlreadyUnlocked={() => {
                      // 別的分頁買完了 —— 重讀權益後直接進評估，不讓家長再付一次。
                      setUnlockedDimensionIds(prev => (
                        prev && !prev.includes(paywallDimension.id) ? [...prev, paywallDimension.id] : prev
                      ));
                      setSelectedDimensionId(paywallDimension.id);
                      setCurrentView('assessment');
                    }}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 'language_special' && PRODUCT.features.tier2And3 && !isRouteBlocked('language') ? (
              /* Deep Language and SLP Diagnostic Assessment Page */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <LanguageSpecialAssessment
                    child={child}
                    onBack={() => setCurrentView('report')}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 'mall' && PRODUCT.features.mall ? (
              /* Products purchase & Logistics tracker */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <WearablesMall
                    orders={orders}
                    onPlaceOrder={handlePlaceOrder}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                  />
                </LazyBoundary>
              </div>
            ) : (
              /* Fallback safety view if state gets misaligned */
              <div className="py-12 bg-white rounded-3xl border border-brand-stone p-8 text-center text-brand-charcoal/80">
                <p>视图丢失，请点击头部“评估面板”重新载入</p>
              </div>
            )}

          </div>
        )}
      </main>

      {/* Aesthetic footer */}
      <footer className="bg-white border-t border-brand-stone/60 py-6 mt-16 text-center text-xs text-brand-charcoal/60 font-medium relative z-10">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>{PRODUCT.brand.copyright}</p>
          <div className="flex justify-center gap-4 text-[10px]">
            <button onClick={() => setShowServiceModal(true)} className="hover:text-brand-forest transition-colors cursor-pointer">服务及免责条款</button>
            <span>•</span>
            <button onClick={() => setShowPrivacyModal(true)} className="hover:text-brand-forest transition-colors cursor-pointer">隐私保护条款</button>
            <span>•</span>
            <a href="#specs" className="hover:text-brand-forest transition-colors">发育评估量表归档声明</a>
          </div>
          {/* 備案號。未設定時整段不渲染 —— 見 BeianFooter 的說明。 */}
          <BeianFooter />
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

      {/* 隐私保护条款弹窗 */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowPrivacyModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-stone/30 bg-gradient-to-r from-brand-sage/20 to-brand-cream/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-brand-moss rounded-xl flex items-center justify-center">
                  <ShieldCheck size={16} className="text-white" />
                </div>
                <h2 className="text-base font-black text-brand-forest">隐私保护条款</h2>
              </div>
              <button
                onClick={() => setShowPrivacyModal(false)}
                className="w-7 h-7 rounded-full bg-brand-stone/20 hover:bg-brand-stone/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="text-brand-charcoal/60 text-sm font-bold">✕</span>
              </button>
            </div>

            {/* 内容区 */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 text-xs text-brand-charcoal/80 leading-relaxed">
              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">一、总则</h3>
                <p>{PRODUCT.brand.systemName}（以下简称"本系统"）高度重视用户隐私与数据安全。本条款旨在明确本系统在收集、存储、使用及共享儿童发育评估数据方面的规范与承诺，保障用户（含监护人及受测儿童）的合法权益。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">二、数据收集范围</h3>
                <p>本系统仅收集为完成发育评估与康复建议所必需的最少数据，包括：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>儿童基本档案信息（姓名、出生日期、性别）</li>
                  <li>发育评估量表作答数据（9维度3层级评估结果）</li>
                  <li>AI评估报告生成记录</li>
                  <li>用户注册账号信息（邮箱、加密密码）</li>
                </ul>
                <p className="mt-2">本系统<strong className="text-brand-forest">不会</strong>收集儿童面部图像、地理位置、通讯录等与评估无关的个人信息。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">三、数据存储与安全</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>所有数据均存储于加密数据库中，传输过程采用 HTTPS/TLS 加密协议</li>
                  <li>密码经 bcrypt 哈希加密存储，不可逆向还原</li>
                  <li>AI 模型调用过程中，儿童数据经脱敏处理后发送，不包含可识别个人身份的信息</li>
                  <li>定期执行安全审计与漏洞扫描，确保系统符合行业安全标准</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">四、数据使用目的</h3>
                <p>收集的数据仅用于以下目的：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>生成儿童发育评估报告与康复建议</li>
                  <li>提供穿戴设备商城购买服务</li>
                  <li>改善系统功能与用户体验（匿名化统计分析）</li>
                </ul>
                <p className="mt-2"><strong className="text-brand-forest">不会</strong>将数据用于商业广告推送、第三方营销或任何未经监护人明确授权的目的。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">五、数据共享与披露</h3>
                <p>除以下情形外，本系统不会向任何第三方共享或披露用户数据：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>经监护人明确书面同意</li>
                  <li>法律法规要求或司法机关依法调取</li>
                  <li>为保护本系统、用户或公众的安全与权益所必需</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">六、用户权利</h3>
                <p>监护人享有以下权利：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>查阅权</strong>：随时查看儿童的评估数据与报告</li>
                  <li><strong>更正权</strong>：修改不准确的个人信息</li>
                  <li><strong>删除权</strong>：申请删除儿童档案及全部关联数据</li>
                  <li><strong>撤回同意权</strong>：随时撤回对数据处理的授权</li>
                </ul>
                <p className="mt-2">行使上述权利请联系本系统客服或通过账号设置自行操作。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">七、儿童数据特别保护</h3>
                <p>本系统严格遵守《中华人民共和国个人信息保护法》《儿童个人信息网络保护规定》等法律法规，对儿童个人信息实行<strong className="text-brand-forest">专门保护</strong>：</p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li>收集儿童数据前须取得监护人的明示同意</li>
                  <li>设置专门的儿童数据访问控制策略</li>
                  <li>定期对处理儿童数据的员工进行安全培训</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">八、条款更新</h3>
                <p>本条款可能因法律法规变化或系统功能调整而更新。更新后的条款将通过系统公告或邮件通知监护人，继续使用本系统即视为同意更新后的条款。</p>
              </section>

              <div className="pt-3 border-t border-brand-stone/30 text-[10px] text-brand-charcoal/50 text-center">
                最后更新日期：2026年7月 · {PRODUCT.brand.legalEntity}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 服务及免责条款弹窗 */}
      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowServiceModal(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-stone/30 bg-gradient-to-r from-brand-sage/20 to-brand-cream/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-brand-moss rounded-xl flex items-center justify-center">
                  <FileText size={16} className="text-white" />
                </div>
                <h2 className="text-base font-black text-brand-forest">服务及免责条款</h2>
              </div>
              <button
                onClick={() => setShowServiceModal(false)}
                className="w-7 h-7 rounded-full bg-brand-stone/20 hover:bg-brand-stone/40 flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="text-brand-charcoal/60 text-sm font-bold">✕</span>
              </button>
            </div>

            {/* 内容区 */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 text-xs text-brand-charcoal/80 leading-relaxed">
              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">一、服务说明</h3>
                <p>{PRODUCT.brand.systemName}（以下简称"本系统"）为监护人提供儿童发育评估、AI评估报告生成、康复建议参考及智能穿戴设备商城等服务。本系统基于"9维3层分层神经系统检测"理念，结合人工智能技术，为儿童发育状况提供数字化参考信息。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">二、免责声明（重要）</h3>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 space-y-2">
                  <p className="font-black text-red-700 text-xs">⚠️ 请务必仔细阅读以下内容：</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-red-800/90">
                    <li><strong>本系统所有评估内容、报告及建议仅供参考，不构成任何医疗诊断、治疗建议或医疗行为。</strong></li>
                    <li><strong>本系统非医疗器械，不具备医疗资质，不能替代专业医疗机构的诊断与治疗。</strong></li>
                    <li>AI生成的评估报告基于算法模型运算，可能存在偏差，不应作为唯一决策依据。</li>
                    <li>儿童发育评估涉及专业医学判断，请务必以正规医院儿科、儿童保健科或发育行为科医生的诊断为准。</li>
                    <li>如儿童存在发育迟缓、行为异常或其他健康问题，请及时就医，切勿依赖本系统结果延误治疗。</li>
                  </ul>
                </div>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">三、服务限制</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>本系统提供的评估工具为初步参考，不能替代标准化临床评估量表的专业施测与解读</li>
                  <li>AI评估报告的准确性受输入数据质量、模型训练数据范围等因素影响</li>
                  <li>商城所售穿戴设备为辅助训练工具，非医疗器械，不具有治疗功效</li>
                  <li>本系统不对因使用评估结果而做出的任何决策承担责任</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">四、用户责任</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>用户（监护人）应确保提供的儿童档案信息真实、准确</li>
                  <li>用户应理解并同意本系统的评估结果仅供参考，不得将其用于医疗诊断、法律证据或其他专业用途</li>
                  <li>用户不得将本系统用于商业目的或未经授权的二次分发</li>
                  <li>用户应妥善保管账号信息，对账号下的所有操作负责</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">五、知识产权</h3>
                <p>本系统的软件、界面设计、评估量表、报告模板、品牌标识等均受知识产权法保护。未经{PRODUCT.brand.legalEntity}书面许可，任何人不得复制、修改、反向工程或商业性使用本系统的任何内容。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">六、服务变更与中断</h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>本系统保留随时修改、暂停或终止部分或全部服务的权利，无需事先通知</li>
                  <li>因系统维护、升级、网络故障或不可抗力导致的服务中断，本系统不承担赔偿责任</li>
                  <li>本系统不对第三方服务（如AI模型接口、云存储服务）的可用性做出保证</li>
                </ul>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">七、责任限制</h3>
                <p>在法律允许的最大范围内，{PRODUCT.brand.legalEntity}及其关联公司对因使用或无法使用本系统而造成的任何直接、间接、附带、特殊或后果性损害（包括但不限于数据丢失、利润损失、业务中断）不承担赔偿责任，即使已被告知此类损害的可能性。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">八、争议解决</h3>
                <p>本条款的解释与适用受中华人民共和国法律管辖。因本系统服务产生的任何争议，双方应友好协商解决；协商不成的，任何一方可向{PRODUCT.brand.legalEntity}所在地有管辖权的人民法院提起诉讼。</p>
              </section>

              <section>
                <h3 className="font-black text-brand-forest text-sm mb-2">九、条款更新</h3>
                <p>本条款可能因法律法规变化、业务发展或系统功能调整而更新。更新后的条款将通过系统公告或邮件通知用户，继续使用本系统即视为同意更新后的条款。如不同意更新内容，请停止使用本系统。</p>
              </section>

              <div className="pt-3 border-t border-brand-stone/30 text-[10px] text-brand-charcoal/50 text-center">
                最后更新日期：2026年7月 · {PRODUCT.brand.legalEntity}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
