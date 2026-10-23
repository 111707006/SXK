/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef, lazy } from 'react';
import { Child, DimensionScore, MallOrder, AssessmentRecord } from './types';
import { DIMENSIONS_DATA } from './data';
import { PRODUCT } from './productConfig';
import { STATUS_WORDING } from './utils/statusWording';
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
const T2Assessment = lazy(() => import('./components/T2Assessment'));
const T2Report = lazy(() => import('./components/T2Report'));
const TrainingPage = lazy(() => import('./components/training/TrainingPage'));
// 新版首頁（`HOME_V2`，issue #72）也只在 A：B 的 `PRODUCT.features.home` 是 false，永遠走不到。
const HomePage = lazy(() => import('./home/HomePage'));
const OfflineServicePage = lazy(() => import('./home/OfflineServicePage'));
// Ledo 版首頁（`PRODUCT.features.ledo`）：B 沒有首頁，A 的建置才會載入它。
const LedoHomePage = lazy(() => import('./home/LedoHomePage'));
import LedoDashboard from './components/ledo/LedoDashboard';
import OutOfRangeCard from './components/OutOfRangeCard';
import { useViewHistory } from './utils/viewHistory';
import { isInT1Range } from './t1Data';
import LedoReportLibrary from './components/ledo/LedoReportLibrary';

import LazyBoundary from './components/LazyBoundary';
import { generateSpecializedReportRecord } from './utils/reportUtils';
import { formatAge, refreshChildAge } from './utils/dateUtils';
import { ageBandDrift, latestAssessedAgeMonth } from './utils/ageBandDrift';
import { useToday } from './utils/useToday';
import { authFetch, setUnauthorizedHandler } from './utils/api';
import { getT2Access, isPaywallActive } from './utils/access';
import type { ServiceType } from './utils/serviceTypes';
import { DEFAULT_UNLOCK_PRICE_FEN } from './utils/price';
import { BeianFooter } from './components/BeianFooter';
import { BrandMark } from './components/BrandMark';
import LedoTabBar, { type NavItem } from './components/ledo/LedoTabBar';
import { WORDING_1022 } from './wording1022';
import { HOME_COPY, openHomeCard, viewAfterLogin, readHomeV2Hint, writeHomeV2Hint, type HomeTarget } from './home/homeNav';
// 條款內文的唯一來源。登入頁（AuthScreen）渲染的是同一份 —— 見該檔說明。
import { ServiceTerms, PrivacyTerms, LegalFooterLine } from './components/LegalTerms';
import {
  Activity, ShoppingBag, BarChart3, User, RefreshCw, 
  Heart, HeartHandshake, FileText, CheckCircle2, ListFilter,
  ChevronDown, Truck, Package, LogOut, ArrowRight, UserCheck,
  BookOpen, Award, Layers, ShieldCheck, ChevronRight, Sparkles, CalendarCheck, Loader2, Home,
} from 'lucide-react';
import { TRAINING_PAGE } from './t2/trainingCopy';
import { latestT1ReportFor } from './utils/reportResume';
import { readHandoffLink } from './handoff/fragment';
import { HANDOFF_INVITE, HANDOFF_LANDING } from './handoff/handoffCopy';

/** App 的主畫面（`currentView`）。返回鍵的歷史記的就是這幾個名字（`useViewHistory`）。 */
const APP_VIEWS = ['home', 'offline_service', 'dashboard', 't1_screening', 'assessment', 'report', 'mall', 'language_special', 'specialized_report', 'paywall', 't2_assessment', 't2_report', 'training'] as const;
type AppView = typeof APP_VIEWS[number];
function isAppView(v: string): v is AppView {
  return (APP_VIEWS as readonly string[]).includes(v);
}

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

  // Navigation: 'dashboard' | 't1_screening' | 'assessment' | 'report' | 'mall' | 'language_special' | 'specialized_report' | 'paywall' | 't2_assessment' | 't2_report'
  /**
   * 新版首頁（客戶 10/17 第 4 項，issue #72，規格 docs/specs/client-changes-2026-10-17.md §5）。
   * `homeConfigOn`：伺服器說 `HOME_V2` 開了沒（`GET /api/home/config`）；回來之前先照這台裝置上次記的（`readHomeV2Hint`）。
   * 開關關著（或 B）`homeV2` 一直是 false，下面每一處新畫面都包在它後面 —— 畫面一行不動。
   */
  const [homeConfigOn, setHomeConfigOn] = useState<boolean>(() => PRODUCT.features.home && readHomeV2Hint());
  /** 家長在首頁開關問到之前自己按過「评估面板」：問到之後不把他換回首頁。 */
  const dashboardChosenRef = useRef(false);
  const homeV2 = PRODUCT.features.home && homeConfigOn;
  /** 未登入時：開關開著先給首頁；點了卡或「登录／注册」才是登入頁。 */
  const [homeLoginOpen, setHomeLoginOpen] = useState(false);
  /** 未登入點的那張卡：登入後帶過去（`viewAfterLogin`）。 */
  const [pendingHomeTarget, setPendingHomeTarget] = useState<HomeTarget | null>(null);
  const [currentView, setCurrentView] = useState<AppView>(() => (homeV2 ? 'home' : 'dashboard'));
  // 1022（issue #86）：換主畫面推一格歷史，返回鍵（含微信左上角）回上一個主畫面。
  useViewHistory(currentView, setCurrentView, isAppView, PRODUCT.features.ui1022);
  // T2 報告頁（票 #61）是從作答清單的「生成报告」還是「查看上次的报告」進來的：前者一進去就打 POST。
  const [t2ReportGenerate, setT2ReportGenerate] = useState(false);
  
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
  /** 即時 T1 報告一開就生成 —— 只有面板的「生成全维 AI 深度评估报告」會設成 true，其他入口一律 false。 */
  const [t1ReportGenerate, setT1ReportGenerate] = useState(false);
  /**
   * 1022（ADR-0014）：剛交卷、要生成**新的一份**。重做 T1 答得跟上次一模一樣時，`liveReportResume` 會接上舊的那一份
   * 而不生成 —— 交卷即生成的意思是每交一次就多一份，所以這一次不接舊的。其他進報告頁的路都會把它清掉。
   */
  const [freshT1Report, setFreshT1Report] = useState(false);
  /** 付費（或跳過付費）回到即時 T1 報告時捲到 T2 入口卡；其他入口一律 false。 */
  const [focusT2, setFocusT2] = useState(false);
  // 專案 B 從維度卡片進報告時，要求報告頁捲到專家預約區塊。
  // 從導覽列或「查看報告」進來時為 false，維持原本停在頁首的行為。
  const [focusBooking, setFocusBooking] = useState(false);
  // T2 報告頁（票 #61）導向四種服務時要預選那一種：預約表在 T1 報告頁裡，所以帶著類型過去開。
  const [focusBookingService, setFocusBookingService] = useState<ServiceType | null>(null);

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
  // 真正的閘門在 server.ts 的 denyIfT2Locked —— 前端擋畫面、後端擋資料。
  /**
   * 這位家長有沒有**整份 T2** 的權益；`null` 代表尚未查到（判斷上等同未解鎖）。
   *
   * 是一個布林而不是一份維度清單，因為 T2 整份買一次（票 #45）——
   * 「買了哪幾個維度」這個問題在 T2 這一層不存在。
   */
  const [t2Unlocked, setT2Unlocked] = useState<boolean | null>(null);
  /** 後端是否有持久層可承載購買；`null` 代表尚未確定，一律當作付費牆會執行。 */
  const [unlocksAvailable, setUnlocksAvailable] = useState<boolean | null>(null);
  // 免費期間（伺服器 `PAYWALL_FREE`，`/api/unlocks` 回 `free: true`）：權益照開，但 T1 報告上的 T2 卡仍畫價錢當參考（使用者 2026-10-11）
  const [t2FreePeriod, setT2FreePeriod] = useState(false);
  /** 單價（分）。以後端回傳為準，前端不自己寫死金額。 */
  const [unlockPriceFen, setUnlockPriceFen] = useState<number>(DEFAULT_UNLOCK_PRICE_FEN);
  /**
   * 家長被付費牆攔下來之前正要去的地方。解鎖之後把他送回那裡，
   * 而不是丟回總覽讓他自己再找一次。
   */
  const [paywallReturn, setPaywallReturn] = useState<
    | { dimensionId: string; target: 'assessment' | 'language_special' }
    // 整份 T2 的入口（票 #56）：買的是整份，沒有維度可回；解鎖後回到即時 T1 報告，入口就在那裡。
    | { target: 't2' }
    | null
  >(null);

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

  /**
   * B→A 交接的落地（ADR-0009、docs/specs/b-to-a-handoff.md §5）：B 的家長按了「到 A 做深度評估」
   * （`/handoff#code=…`），或點了後台發的邀請簡訊（`/handoff#invite=…`）。只有 A 接收；開頁那一刻讀一次，
   * 之後網址就換成 `/`。
   *
   * 簡訊那一條先停在同意畫面（`confirm`），家長按下才兌換；按鈕那一條在 B 已經同意過，直接兌換。
   * 兌換期間整個主畫面換成「正在把筛查结果带过来…」—— 不先畫這台裝置上舊的登入狀態，
   * 否則家長會先看到別人的（或上一次的）孩子閃一下。
   */
  const [handoffLink] = useState(() =>
    PRODUCT.features.handoff === 'receive' ? readHandoffLink(window.location.pathname, window.location.hash) : null,
  );
  const [handoffStage, setHandoffStage] = useState<'confirm' | 'redeeming' | null>(() =>
    handoffLink === null ? null : handoffLink.via === 'invite' ? 'confirm' : 'redeeming',
  );
  // StrictMode 會把掛載的 effect 跑兩次；交接碼是一次性的，第二次兌換一定失敗，會把第一次的成功蓋掉。
  const handoffStartedRef = useRef(false);
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
    // 新版首頁開著時：那句話叫他重新登入，就直接給登入頁，不先停首頁。
    setHomeLoginOpen(true);
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

  /**
   * 新版首頁開了沒（只有 A 問；B 沒有這支端點）。讀不到當成關著 —— 關著就是現在的畫面。
   * 開著而且還停在預設的評估面板（剛開頁、還沒走去別處）就換到首頁；改成關著時離開首頁那兩頁。
   */
  useEffect(() => {
    if (!PRODUCT.features.home) return;
    let cancelled = false;
    (async () => {
      let on = false;
      try {
        const resp = await fetch('/api/home/config');
        const ct = resp.headers.get('content-type');
        if (resp.ok && ct && ct.includes('application/json')) on = (await resp.json())?.enabled === true;
      } catch {
        // 網路斷了：當成關著。
      }
      if (cancelled) return;
      writeHomeV2Hint(on);
      setHomeConfigOn(on);
      // 停在評估面板只因為還沒問到開關時才換成首頁；家長自己按了「评估面板」就不搶回來。
      setCurrentView(v => (on ? (v === 'dashboard' && !dashboardChosenRef.current ? 'home' : v) : v === 'home' || v === 'offline_service' ? 'dashboard' : v));
    })();
    return () => { cancelled = true; };
  }, []);

  /** 首頁的卡片：已登入直接去；未登入先到登入頁，登入後帶過去（`handleAuthSuccess`）。 */
  const openHomeTarget = (target: HomeTarget) => {
    const step = openHomeCard(target, Boolean(userIdentity));
    if ('login' in step) {
      setPendingHomeTarget(step.after);
      setHomeLoginOpen(true);
      return;
    }
    setCurrentView(step.view);
    setSelectedDimensionId(null);
  };

  /** 頁首的「登录／注册」：純驗證碼登入沒有另外的註冊，兩顆都到同一個登入頁；登入後停首頁。 */
  const openHomeLogin = () => {
    setPendingHomeTarget(null);
    setHomeLoginOpen(true);
  };

  // Load from local storage and sync with Cloud Database on mount
  useEffect(() => {
    let localChild: Child | null = null;
    let localScores: DimensionScore[] = [];
    let localOrders: MallOrder[] = [];
    let localHistory: AssessmentRecord[] = [];

    // 1. Initial hydration from localStorage (instant rendering)
    //
    // 交接落地時先不做：兌換成功會整份換掉，先畫出來的是這台裝置上上一位家長的孩子（頁首會閃一下）。
    const hydrateLocal = () => {
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
    };

    // 2. Fetch connection status & sync with Database
    //
    // `statusOnly`：交接剛登入完（資料由兌換的回應帶來），只讀連線狀態，不再讀一次家長資料。
    const initCloudSync = async (statusOnly = false) => {
      try {
        const statusResp = await fetch('/api/db/status');
        if (!statusResp.ok) return;
        const statusCt = statusResp.headers.get('content-type');
        if (!statusCt || !statusCt.includes('application/json')) return;
        const statusData = await statusResp.json();
        
        setDbConfigured(statusData.configured);
        setDbEnvId(statusData.envId);
        if (statusOnly) return;

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

    // B→A 交接：先兌換，成功就是登入（覆蓋這台裝置上原本的狀態）；失敗才照一般開頁讀資料 ——
    // 這台裝置上本來登入著的 A 家長不因為一條不能用的連結被登出。簡訊那一條先等家長在同意畫面按下
    // （`acceptHandoffInvite`），這裡只讀連線狀態。
    if (handoffLink) {
      if (handoffStartedRef.current) return;
      handoffStartedRef.current = true;
      // 碼不留在網址列、瀏覽紀錄與之後的 Referer 裡（還要用的那一份在 state 裡）。
      window.history.replaceState(null, '', '/');
      if (handoffLink.via === 'invite') {
        initCloudSync(true);
        return;
      }
      redeemHandoff(handoffLink.code).then(ok => {
        if (!ok) hydrateLocal();
        initCloudSync(ok);
      });
      return;
    }

    hydrateLocal();
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
      setT2Unlocked(null);
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
        // 回應裡的 `dimensionIds` 是 T3 的（每個維度各買一次），這裡不讀 ——
        // 把兩種權益混成一份清單，正是「買了一個維度就打開整份 T2」的走法。
        setT2Unlocked(data.t2 === true);
        setUnlocksAvailable(data.available === true);
        setT2FreePeriod(data.free === true);
        if (typeof data.priceFen === 'number' && data.priceFen > 0) setUnlockPriceFen(data.priceFen);
      } catch (err) {
        // 保持 null（尚未確定）—— 讀不到權益時 fail-closed，不樂觀放行。
        console.warn('Failed to load T2 entitlement:', err);
      }
    })();
    return () => { cancelled = true; };
  }, [userIdentity, authToken]);

  /**
   * 進入某維度的深度評估，未解鎖則先過付費牆。
   *
   * 檢查的是**整份 T2 的權益**，不是這一個維度 —— 家長買的是一份，
   * 九個維度的深度評估不再各賣各的（票 #45）。
   *
   * `target` 讓語言專項走同一道檢查 —— 它是語言維度的深度評估內容，
   * 另開一條不檢查的路等於在付費牆旁邊挖一個洞。
   */
  const enterDimension = (dimensionId: string, target: 'assessment' | 'language_special' = 'assessment') => {
    const access = getT2Access({
      paywallEnabled: PRODUCT.features.paywall,
      unlocksAvailable,
      isLoggedIn: Boolean(userIdentity),
      t2Unlocked,
    });
    // locked 與 demo 去的是同一個畫面，但結果相反：前者過不去，後者可以略過。
    // 略過的入口只在 demo 下渲染，所以資料庫一接上它就消失。
    if (access === 'locked' || access === 'demo') {
      setPaywallReturn({ dimensionId, target });
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

  /**
   * T1 報告上的 T2 入口（票 #56、#58）。同一道存取檢查：未解鎖進付費牆（解鎖後送回報告，
   * 入口以已解鎖的樣子重畫）；已解鎖進逐支作答（`T2Assessment`）。入口上按「解鎖」與
   * 「開始作答」走的是同一支 —— 入口自己依 access 決定顯示哪一顆，這裡不重複判斷。
   */
  const enterT2 = () => {
    const access = getT2Access({
      paywallEnabled: PRODUCT.features.paywall,
      unlocksAvailable,
      isLoggedIn: Boolean(userIdentity),
      t2Unlocked,
    });
    if (access === 'locked' || access === 'demo') {
      setPaywallReturn({ target: 't2' });
      setCurrentView('paywall');
      return;
    }
    if (access === 'open') setCurrentView('t2_assessment');
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

    // Send back to dashboard dashboard —— 新版首頁開著時停首頁，或帶到未登入時點的那張卡（`viewAfterLogin`；關著就是 dashboard）。
    setCurrentView(viewAfterLogin(pendingHomeTarget, homeV2));
    setPendingHomeTarget(null);
    setHomeLoginOpen(false);
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
    if (confirm('确认清除当前受评少儿档案并重启评测？已保存的成绩和物流状态将会复位，深度评估与线上干预也会从头开始！')) {
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

  /**
   * 即時報告要接續的那一份：歷史裡**分數與現在一模一樣**的最新一筆 T1 報告。
   * 分數有任何一筆不同（重做過 T1）就是 null，報告頁照舊從「一键生成」開始。
   * 見 `AnalysisReport` 的 `resumeFrom`。
   */
  const liveReportResume = useMemo(
    // 與 B→A 交接挑「帶過去的那一份報告」是同一個規則（src/utils/reportResume.ts）。
    () => latestT1ReportFor(reportHistory, completedScores),
    [reportHistory, completedScores],
  );

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
  const goToExpertBooking = (service: ServiceType | null = null) => {
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
    // 即時報告接得上上一份（`liveReportResume`）就走即時報告：預約區塊當場就在，
    // 而且 T2 入口只有即時報告有 —— 從 T2 報告按預約過來的家長，回去才找得到路。
    // 接不上（分數變過、還沒生成過）才退回歸檔那一份。
    const useLive = liveReportResume !== null;
    setViewingLiveT1(useLive || !archived);
    setT1ReportGenerate(false); setFreshT1Report(false);
    setActiveT1Record(useLive ? null : archived);
    setFocusBooking(true);
    setFocusBookingService(service);
    // 上一次「重新评估」或付費回來留下的 focusT2 會讓報告同時捲去 T2 入口與預約區塊，這裡要的是後者。
    setFocusT2(false);
    setCurrentView('report');
  };

  /**
   * 送到 T2 入口：入口只掛在即時 T1 報告上（票 #56），回去並捲到那張卡。
   * 「线上干预」那一頁的「重新评估」、還沒報告／還沒解鎖時的按鈕都走這裡。
   */
  const goToT2Entrance = () => {
    setViewingLiveT1(true);
    setT1ReportGenerate(false); setFreshT1Report(false);
    setActiveT1Record(null);
    setFocusBooking(false);
    setFocusT2(true);
    setCurrentView('report');
  };

  /**
   * 兌換交接碼（A 的 `POST /api/handoff/redeem`）。成功＝照一般登入處理，然後打開即時 T1 報告並捲到
   * T2 入口（與付費回來同一條 `focusT2`）；帶過來的報告接得上就直接顯示，接不上（B 那邊還沒生成）就一進去生成。
   * 失敗回登入頁並說原因。回傳成功與否。
   */
  const redeemHandoff = async (code: string): Promise<boolean> => {
    let notice: string = HANDOFF_LANDING.unavailable;
    try {
      const resp = await fetch('/api/handoff/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await resp.json().catch(() => null);
      if (resp.ok && data?.success === true && typeof data.token === 'string' && typeof data.phone === 'string') {
        handleAuthSuccess(
          data.phone,
          data.token,
          data.child ?? null,
          Array.isArray(data.completedScores) ? data.completedScores : [],
          Array.isArray(data.orders) ? data.orders : [],
          Array.isArray(data.reportHistory) ? data.reportHistory : [],
        );
        goToT2Entrance();
        setT1ReportGenerate(true); setFreshT1Report(false);
        setHandoffStage(null);
        return true;
      }
      // 410＝B 說這個碼不算數（不存在、帳號刪了）；其餘（502、503、500）是伺服器之間不通。
      if (resp.status === 410) notice = HANDOFF_LANDING.invalid;
    } catch {
      // 網路斷了：同「不通」。
    }
    setSessionNotice(notice);
    setHandoffStage(null);
    return false;
  };

  /**
   * 簡訊邀請的同意畫面按下「同意并继续」。失敗就退回一般開頁（讀這台裝置上本來的狀態）。
   * 不用重新讀一次網址：碼在 `handoffLink` 裡，網址早就換成 `/` 了。
   */
  const acceptHandoffInvite = async () => {
    if (!handoffLink) return;
    setHandoffStage('redeeming');
    const ok = await redeemHandoff(handoffLink.code);
    if (!ok) reloadAfterDeclinedHandoff();
  };

  /** 同意畫面按「不用了」：不兌換，照一般開頁走（本來登入著的就還登入著，沒有就到登入頁）。 */
  const declineHandoffInvite = () => {
    setHandoffStage(null);
    reloadAfterDeclinedHandoff();
  };

  /**
   * 交接沒成（不同意、或兌換失敗）時，補做開頁本來會做的事：這台裝置上本來登入著的家長照常顯示。
   * 掛載時那一輪刻意跳過了（見上面的 effect），這裡用整頁重新整理補上 —— 網址已經是 `/`，不會再進交接。
   */
  const reloadAfterDeclinedHandoff = () => {
    if (localStorage.getItem('senxinkang_token')) window.location.reload();
  };

  // Find active dimension config
  const activeDimension = DIMENSIONS_DATA.find(d => d.id === selectedDimensionId);

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
  const t2Access = getT2Access({
    paywallEnabled: PRODUCT.features.paywall,
    unlocksAvailable,
    isLoggedIn: Boolean(userIdentity),
    t2Unlocked,
  });
  /**
   * 深度評估要不要在卡片上顯示鎖頭：真的鎖住的，以及展示模式下「本來會鎖住」的。
   *
   * 一個布林、不是一份維度清單 —— 九張卡片各掛一個價格的做法在 #45 退場了。
   * 價格只出現在付費牆上一次，因為家長也只付一次。
   */
  const deepAssessmentLocked = paywallActive && ['locked', 'demo'].includes(t2Access);
  /**
   * 路由層的最後一道 —— **只認 `locked`**。展示模式略過付費牆之後仍要進得去，
   * 所以不能拿上面那個含 `demo` 的旗標來擋。
   */
  const isRouteBlocked = t2Access === 'locked';

  /**
   * 1022（issue #82）：12–180 個月以外的孩子不給 T1 —— 評估面板與 T1 那一頁都改畫紅燈卡「建议寻找专业人士」。
   * 依當下月齡算（`child.ageMonth` 由 `refreshChildAge` 跟著日子走）。
   */
  const t1Blocked = PRODUCT.features.ui1022 && !!child && !isInT1Range(child.ageMonth);
  const startT1Screening = () => setCurrentView('t1_screening');
  const outOfRangeCard = t1Blocked && child ? (
    <OutOfRangeCard
      childName={child.name}
      onBook={type => goToExpertBooking(type)}
      onOpenTraining={PRODUCT.features.tier2And3 ? () => setCurrentView('training') : undefined}
    />
  ) : null;

  /** 評估面板（舊版 `DimensionGrid` 與 Ledo 版 `LedoDashboard` 共用）：點一個方面。 */
  const selectDashboardDimension = (dimId: string) => {
    // 去向由 productConfig 決定，不在這裡判斷模式：
    // A → 即時 T1 報告（T2 入口在那裡，票 #56）；B → 報告頁的專家預約區塊。
    //
    // 2026-09-13 起 A 不再進舊的逐維度 T3 面板（`AssessmentPanel`）：T2 v2 是整份作答、
    // 入口只掛在即時報告上，卡片再導去 T3 會讓家長在兩條互不相通的深測路之間迷路。
    // T3 面板與 `enterDimension` 都留著，語言專項仍走它；T3 何時回來、怎麼接 T2，另議。
    setViewingLiveT1(true);
    setT1ReportGenerate(false); setFreshT1Report(false);
    setActiveT1Record(null);
    setActiveSpecializedRecordId(null);
    setFocusBooking(PRODUCT.nextStep.action === 'contact_expert');
    setCurrentView('report');
  };

  /** 評估面板：生成 AI 報告。 */
  const viewDashboardReport = () => {
    // Jump straight to the live T1 AI report page, skipping the archive/library page.
    // 按鈕寫的是「生成」：到了就生成，不再要家長按第二次（已有同分數的報告則直接顯示）。
    setViewingLiveT1(true);
    setActiveT1Record(null);
    setActiveSpecializedRecordId(null);
    setFocusBooking(false); setFocusT2(false);
    setT1ReportGenerate(true); setFreshT1Report(false);
    setCurrentView('report');
  };

  /**
   * 導覽列的幾個去處。頁首那一排（桌機；舊版連手機也是）與 Ledo 版手機的底欄（`LedoTabBar`）畫的是同一份，
   * 點下去做的事只寫在這裡一次。`short` 是底欄的字（底欄放不下「评估面板 (9维)」）。
   */
  const navItems: NavItem[] = [
    ...(homeV2
      ? [{
          key: 'home', id: 'nav-home-btn', label: HOME_COPY.navLabel, short: HOME_COPY.navLabel, icon: Home,
          active: currentView === 'home' || currentView === 'offline_service',
          onClick: () => { setCurrentView('home'); setSelectedDimensionId(null); },
        }]
      : []),
    {
      key: 'dashboard', id: 'nav-dashboard-btn', label: '评估面板 (9维)', short: '评估', icon: BarChart3,
      active: currentView === 'dashboard' || currentView === 'assessment',
      onClick: () => { dashboardChosenRef.current = true; setCurrentView('dashboard'); setSelectedDimensionId(null); },
    },
    {
      key: 'report', id: 'nav-report-btn', label: '评估报告', short: '报告', icon: FileText,
      active: currentView === 'report', disabled: completedScores.length === 0,
      onClick: () => {
        setCurrentView('report');
        setSelectedDimensionId(null);
        setViewingLiveT1(false);
        setActiveT1Record(null);
        setActiveSpecializedRecordId(null);
        // 從導覽列進來是「我要看報告」，不是「帶我去預約」。這一行少了
        // 的話，按過一次干預包的「联系专家」之後，此後每一份報告都會
        // 自己捲到最底下的預約區塊 —— 而家長沒有要求過那件事。
        setFocusBooking(false); setFocusT2(false);
      },
    },
    // 线上干预（2026-09-28 使用者：不放在報告裡，從這裡另外開）。只有專案 A 有深度評估，
    // 也就只有 A 有這一頁；沒解鎖、沒報告時頁面自己說要先做什麼。
    ...(PRODUCT.features.tier2And3
      ? [{
          key: 'training', id: 'nav-training-btn', label: TRAINING_PAGE.navLabel, short: TRAINING_PAGE.navLabel, icon: CalendarCheck,
          active: currentView === 'training', disabled: completedScores.length === 0,
          onClick: () => { setCurrentView('training'); setSelectedDimensionId(null); },
        }]
      : []),
    ...(PRODUCT.features.mall
      ? [{
          key: 'mall', id: 'nav-mall-btn', label: '商城', short: '商城', icon: ShoppingBag,
          active: currentView === 'mall',
          onClick: () => { setCurrentView('mall'); setSelectedDimensionId(null); },
        }]
      : []),
  ];

  /** 個人中心的商城訂單（商城開著才有）。1022 排在「已完成的评估成绩」後面（issue #85）。 */
  const mallOrdersSection = PRODUCT.features.mall ? (
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
                            className="text-xs text-brand-moss hover:text-brand-forest font-bold flex items-center gap-0.5 cursor-pointer"
                          >
                            去商城
                            <ArrowRight size={10} />
                          </button>
                        </div>

                        {orders.length === 0 ? (
                          <div className="text-center py-5 bg-brand-cream/30 rounded-xl border border-dashed border-brand-stone/40 text-xs text-brand-charcoal/80">
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
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-black shrink-0 ${
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

                                <div className="flex justify-between text-xs text-brand-charcoal/80">
                                  <span>单价 ¥{order.product.price} · 数量 x{order.quantity}</span>
                                  <span className="font-bold text-brand-forest">总计: ¥{order.totalPrice}</span>
                                </div>

                                {order.logisticsTimeline && order.logisticsTimeline.length > 0 && (
                                  <div className="bg-white/80 p-1.5 rounded border border-brand-stone/20 text-xs text-brand-charcoal/80 flex items-start gap-1">
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
  ) : null;

  return (
    <div className="min-h-screen bg-brand-cream text-brand-charcoal font-sans flex flex-col justify-between">
      
      {/* Top Professional Master Header Navbar */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-brand-stone/60 shadow-sm backdrop-blur-md">
        {/*
          平板（640–1023px）也上下兩列：標題一列、導覽＋孩子一列。原本 sm 就並排，820px 寬時標題擠成兩行、
          孩子的選單掉到導覽底下（2026-09-29 三種寬度截圖時看到的）。
        */}
        {/* 新版首頁、未登入：標題與「登录、注册」手機上也同一列（客戶示意圖）；Ledo 版手機的導覽在底欄，頁首只剩標題與孩子，也一列。其他情況照舊。 */}
        <div className={(homeV2 && !userIdentity) || PRODUCT.features.ledo ? 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-row items-center justify-between gap-3' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row items-center justify-between gap-4'}>
          <div className="flex items-center gap-2.5">
            {/* 1022：頁首不畫「森」字方塊，只留平台名稱（規格「品牌」）。 */}
            {!PRODUCT.features.ui1022 && (
            <div className="w-10 h-10 bg-brand-moss rounded-xl flex items-center justify-center text-white font-extrabold shadow-md shadow-brand-moss/10 scale-105">
              <BrandMark />
            </div>
            )}
            <div className="text-left">
              <div className="flex flex-wrap items-center gap-2">
                {/* 新版首頁開著時頁首寫客戶示意圖上那一行（規格 §5.1）；關著照舊是系統名。 */}
                <h1 className={`text-base font-extrabold font-sans text-brand-forest tracking-tight${PRODUCT.features.ledo && child ? ' max-sm:sr-only' : ''}`}>{homeV2 && !PRODUCT.features.ui1022 ? HOME_COPY.siteTitle : PRODUCT.brand.headerTitle}</h1>
                {/*
                  建置模式標記 —— 2026-09-10 起**不顯示在畫面上**。

                  它原本是掛在標題旁的一顆徽章（A 灰綠色「完整版」、B 琥珀色「T1 版」），
                  用來一眼看出當前開的是哪一個產品。那是**開發與驗收**要的訊號，對家長
                  沒有意義；而 B 是交付給合作公司的網站，掛一個看不懂的內部標籤只會讓
                  對方問「T1 是什麼」。

                  但「這份產物是 A 還是 B」仍然要答得出來 —— 每一次部署都靠它擋住
                  「把 A 版傳到合作公司網域上」這種錯誤。所以標記留在 DOM 裡但不渲染：
                  `hidden` 不佔任何版面，文字與 `data-build-mode` 仍然會被打包進產物。

                  查法：
                    產物　`grep -c 'T1 版' dist/assets/index-*.js`（B 回 1，A 回 0）
                    線上　開發者工具貼
                          document.getElementById('build-mode-badge').dataset.buildMode
                */}
                <span id="build-mode-badge" hidden data-build-mode={PRODUCT.mode} title={PRODUCT.buildBadge.title}>
                  {PRODUCT.buildBadge.label}
                </span>
              </div>
              <div className="text-xs text-brand-charcoal/80 font-medium flex items-center gap-1.5 mt-0.5">
                {syncing && <span className="text-brand-moss animate-spin text-xs" title="正在云端保存中...">⏳</span>}
                {syncError && <span className="text-red-500 text-xs font-bold" title={syncError}>⚠️ 同步失败</span>}
              </div>
            </div>
          </div>

          {/* Navigation and switch views controls */}
          {child ? (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* 手機寬度放四個分頁：小螢幕收掉圖示、縮一點邊距、字不換行（2026-09-28 加「线上干预」之後會擠成兩行） */}
              {/*
                新版首頁開著時多一顆「首页」（五顆）：375px 一行放不下就橫捲（`overflow-x-auto`），不換行、不縮字。
                關著照舊（class 一字不差）。
              */}
              <nav className={`${homeV2 ? 'flex max-w-full overflow-x-auto bg-brand-beige/50 p-1 rounded-xl border border-brand-stone/40' : 'flex bg-brand-beige/50 p-1 rounded-xl border border-brand-stone/40'}${PRODUCT.features.ledo ? ' max-lg:hidden' : ''}`}>
                {navItems.map(item => (
                  <button
                    key={item.key}
                    id={item.id}
                    disabled={item.disabled}
                    onClick={item.onClick}
                    className={[
                      item.key === 'home' && 'shrink-0',
                      'px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition flex items-center gap-1',
                      item.disabled && 'opacity-40 cursor-not-allowed',
                      item.active ? 'bg-white text-brand-forest shadow-sm font-extrabold' : 'text-brand-charcoal/80 hover:text-brand-forest',
                    ].filter(Boolean).join(' ')}
                  >
                    <item.icon size={12} className="hidden sm:block" />
                    {item.label}
                  </button>
                ))}
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
                          <span className="text-xs px-2 py-0.5 bg-brand-sage/20 rounded-md text-brand-forest font-bold">
                            儿童健康档案
                          </span>
                        </div>
                        
                        <div className="bg-brand-beige/25 rounded-xl p-3 border border-brand-stone/40 flex items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-bold text-brand-forest text-sm flex items-center gap-1.5">
                              <span>{child.name}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded-full font-black tracking-wider bg-white text-brand-clay border border-brand-stone/30">
                                {child.gender === 'boy' ? '男童 👦' : '女童 👧'}
                              </span>
                            </div>
                            <div className="text-xs text-brand-charcoal/80 space-x-2">
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
                            className="px-2.5 py-1 bg-white hover:bg-brand-sage/20 border border-brand-stone/40 text-brand-forest rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-sm cursor-pointer"
                            title="修改受评少儿成长档案"
                          >
                            <User size={10} className="text-brand-moss" />
                            修改档案
                          </button>
                        </div>

                        {/* Screening progress */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-xs text-brand-charcoal/80 font-semibold">
                            <span>{PRODUCT.features.ui1022 ? 'T1 评估进度' : '脑功能评估进度'} ({completedScores.length}/9 维度)</span>
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

                      {!PRODUCT.features.ui1022 && mallOrdersSection}

                      {/* 3. Completed Screening Scores */}
                      <div className="pt-3.5 space-y-2.5">
                        <h4 className="font-extrabold text-brand-forest flex items-center gap-1.5">
                          <FileText size={13} className="text-brand-moss" />
                          已完成的评估成绩
                        </h4>
                        
                        {completedScores.length === 0 ? (
                          <div className="text-center py-4 text-xs text-brand-charcoal/80">
                            尚未完成任何康复测评
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                            {completedScores.map((score) => (
                              <div key={`${score.dimensionId}-${score.tierId}`} className="p-1.5 bg-brand-sage/10 rounded-lg border border-brand-stone/20 flex flex-col justify-between">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="font-bold text-brand-forest truncate text-xs">{score.dimensionName}</span>
                                  <span className="px-1 py-0.2 bg-white border border-brand-stone/30 rounded text-xs font-bold text-brand-moss shrink-0">{score.tierId}层</span>
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                  <span className="text-xs font-bold text-brand-forest/70">{score.score}分</span>
                                  <span className={`text-xs font-extrabold ${
                                    score.status === 'delay' ? 'text-rose-600' :
                                    score.status === 'borderline' ? 'text-amber-600' : 'text-emerald-600'
                                  }`}>
                                    {STATUS_WORDING[score.status].label}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {PRODUCT.features.ui1022 && mallOrdersSection}

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
          ) : homeV2 && !userIdentity ? (
            /* 新版首頁、未登入：右上「登录、注册」（規格 §5.1）。純驗證碼登入沒有另外的註冊，兩顆到同一個登入頁。
               1022（issue #84）合成一顆「登录／注册」；從頁首登入完回首頁（viewAfterLogin）。 */
            PRODUCT.features.ui1022 ? (
              <button
                type="button"
                id="header-login-btn"
                onClick={openHomeLogin}
                className="shrink-0 px-3.5 py-1.5 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold transition shadow-sm cursor-pointer"
              >
                {WORDING_1022.home.login}
              </button>
            ) : (
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                id="header-login-btn"
                onClick={openHomeLogin}
                className="px-3.5 py-1.5 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-xs font-extrabold transition shadow-sm cursor-pointer"
              >
                {HOME_COPY.login}
              </button>
              <button
                type="button"
                id="header-register-btn"
                onClick={openHomeLogin}
                className="px-3.5 py-1.5 rounded-xl border border-brand-moss/40 bg-white hover:bg-brand-sage/20 text-brand-forest text-xs font-extrabold transition shadow-sm cursor-pointer"
              >
                {HOME_COPY.register}
              </button>
            </div>
            )
          ) : userIdentity ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-brand-charcoal/80 font-medium">
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
        {handoffStage === 'redeeming' ? (
          <div id="handoff-landing" role="status" className="py-24 flex flex-col items-center gap-3 text-center">
            <Loader2 size={28} className="animate-spin text-brand-moss" />
            <p className="text-sm font-extrabold text-brand-forest">{HANDOFF_LANDING.loading}</p>
            <p className="text-xs text-brand-charcoal/80">{HANDOFF_LANDING.hint}</p>
          </div>
        ) : handoffStage === 'confirm' ? (
          <div id="handoff-invite" className="w-full max-w-md bg-white rounded-3xl border border-brand-moss/30 ring-1 ring-brand-moss/10 p-6 shadow-sm text-left space-y-4">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-sage/20 border border-brand-moss/20 text-xs font-bold text-brand-moss inline-flex items-center gap-1 uppercase tracking-wider">
              <Layers size={10} /> {HANDOFF_INVITE.badge}
            </span>
            <h2 className="text-base font-extrabold text-brand-forest">{HANDOFF_INVITE.title(PRODUCT.brand.welcomeName ?? '')}</h2>
            <p className="text-xs text-brand-charcoal/80 leading-relaxed">{HANDOFF_INVITE.body}</p>
            <button
              id="handoff-invite-accept-btn"
              type="button"
              onClick={acceptHandoffInvite}
              className="w-full px-6 py-3 rounded-xl bg-brand-moss hover:bg-brand-moss/90 text-white text-sm font-extrabold transition shadow-md shadow-brand-moss/20 active:scale-[0.99] cursor-pointer flex items-center justify-center gap-1.5"
            >
              {HANDOFF_INVITE.accept}
              <ChevronRight size={14} />
            </button>
            <p className="text-xs text-brand-charcoal/80 leading-relaxed">
              {HANDOFF_INVITE.consent(PRODUCT.brand.welcomeName ?? '')}，
              <button type="button" onClick={() => setShowPrivacyModal(true)} className="underline underline-offset-2 hover:text-brand-forest cursor-pointer">
                {HANDOFF_INVITE.privacy}
              </button>
            </p>
            <button type="button" onClick={declineHandoffInvite} className="w-full text-xs text-brand-charcoal/80 hover:text-brand-forest cursor-pointer">
              {HANDOFF_INVITE.decline}
            </button>
          </div>
        ) : !userIdentity ? (
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
            {homeV2 && !homeLoginOpen ? (
              <LazyBoundary>
                {PRODUCT.features.ledo ? <LedoHomePage onOpen={openHomeTarget} /> : <HomePage onOpen={openHomeTarget} />}
              </LazyBoundary>
            ) : (
              <>
                <AuthScreen onAuthSuccess={handleAuthSuccess} dbConfigured={dbConfigured} />
                {homeV2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setHomeLoginOpen(false);
                      setPendingHomeTarget(null);
                    }}
                    className="text-xs font-bold text-brand-moss hover:text-brand-forest cursor-pointer"
                  >
                    {HOME_COPY.offline.back}
                  </button>
                )}
              </>
            )}
          </div>
        ) : !child ? (
          /* Profile Registry form shown when child is unconfigured */
          <div className="py-12 animate-fade-in text-center w-full">
            <h2 className="text-2xl md:text-3xl font-black text-brand-forest tracking-tight max-w-lg mx-auto leading-tight mb-4">
              {/* 專案 B 的 welcomeName 是 null —— 整個強調 span 不渲染，不是留一個空的。1022 只寫平台名稱。 */}
              {PRODUCT.features.ui1022
                ? WORDING_1022.profile.title
                : <>欢迎使用{PRODUCT.brand.welcomeName && <> <span className="text-brand-moss">{PRODUCT.brand.welcomeName}</span> </>}儿童综合发展评估</>}
            </h2>
            {/* 1022：建檔頁標題是「T1 儿少综合发展评估」、說明一句（issue #83）；歡迎語放在標題上面一行。 */}
            {PRODUCT.features.ui1022 ? (
              <p className="text-xs text-brand-charcoal/80 max-w-md mx-auto mb-10 leading-relaxed">
                {WORDING_1022.welcome}。{WORDING_1022.profile.intro}
              </p>
            ) : (
            <p className="text-xs text-brand-charcoal/80 max-w-md mx-auto mb-10 leading-relaxed">
              您的账户 (<span className="font-bold text-brand-forest">{userIdentity}</span>) 已成功连线。为了开启全方位脑功能评估，请填写您孩子的基本信息，登记创建成长档案。
            </p>
            )}
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
          // 首頁要滿版（banner 撐滿寬度）；其他頁照舊依內容寬置中（上面那段說的桌機 723px）。
          // Ledo 版每一頁自己是一張置中的卡（max-w-xl 等），外層一律滿版，卡才不會縮成內容寬。
          <div className={(homeV2 && (currentView === 'home' || currentView === 'offline_service')) || PRODUCT.features.ledo ? 'min-w-0 w-full space-y-6' : 'min-w-0 space-y-6'}>
            
            {currentView === 'home' && homeV2 ? (
              <LazyBoundary>
                {PRODUCT.features.ledo ? (
                  <LedoHomePage
                    onOpen={openHomeTarget}
                    childName={child?.name}
                    scores={completedScores}
                    onOpenReport={completedScores.length > 0 ? navItems.find(i => i.key === 'report')?.onClick : undefined}
                  />
                ) : (
                  <HomePage onOpen={openHomeTarget} />
                )}
              </LazyBoundary>
            ) : currentView === 'offline_service' && homeV2 ? (
              <LazyBoundary>
                <OfflineServicePage onBack={() => setCurrentView('home')} />
              </LazyBoundary>
            ) : currentView === 'dashboard' && PRODUCT.features.ledo ? (
              <div className="space-y-4">
                <AgeBandDriftNotice drift={bandDrift} onStartT1Screening={startT1Screening} />
                <LedoDashboard
                  t1Blocked={outOfRangeCard}
                  childName={child.name}
                  completedScores={completedScores}
                  onSelectDimension={selectDashboardDimension}
                  onViewReport={viewDashboardReport}
                  onStartT1Screening={startT1Screening}
                />
              </div>
            ) : currentView === 'dashboard' ? (
              <div className="space-y-8 animate-fade-in">
                {/* Visual Hero Banner */}
                <div className="bg-gradient-to-r from-brand-forest via-brand-forest/95 to-brand-moss text-white p-6 md:p-8 rounded-3xl text-left shadow-lg relative overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent" />
                  <div className="absolute bottom-[-10px] right-[-10px] w-48 h-48 bg-white/5 rounded-full blur-2xl" />

                  <div className="relative z-10 max-w-2xl space-y-3.5">
                    {/*
                      系統只有一個名字（見 productConfig 的 brand 說明與
                      test/productNaming.structure.test.ts）。2026-09-11 之前這裡寫死
                      「儿童神经网络综合发展评估」，上面還掛一顆「儿童生长发育评定专家」
                      的膠囊 —— 頁首、分頁、頁尾好不容易統一了，家長往下捲一格又看到
                      第四、第五個名字。標題改讀同一個來源；膠囊拿掉，留著就是同一個
                      名字上下疊兩次。
                    */}
                    <h2 className="text-2xl md:text-3xl font-black font-sans leading-tight">
                      {PRODUCT.brand.headerTitle}
                    </h2>
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-brand-sand/90 font-medium"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-moss/40 text-xs font-bold mr-1">1</span>点击「启动 T1 综合评估」，完成基础评估</p>
                      <p className="text-xs text-brand-sand/90 font-medium"><span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-brand-moss/40 text-xs font-bold mr-1">2</span>{PRODUCT.dashboard.stepTwoHint}{PRODUCT.dashboard.stepTwoIsPaid && <span className="inline-block ml-0.5 px-1 py-0 rounded bg-amber-400/90 text-xs font-bold text-brand-moss align-middle">VIP</span>}</p>
                    </div>
                  </div>
                </div>

                {/*
                  跨年齡段的提示。放在維度卡片**之上** —— 家長讀那九張卡片上的
                  燈號之前就得知道它們是用另一組題目測出來的。
                */}
                <AgeBandDriftNotice
                  drift={bandDrift}
                  onStartT1Screening={startT1Screening}
                />

                {outOfRangeCard}
                <DimensionGrid
                  completedScores={completedScores}
                  onSelectDimension={selectDashboardDimension}
                  deepAssessmentLocked={deepAssessmentLocked}
                  onViewReport={viewDashboardReport}
                  onStartT1Screening={startT1Screening}
                />
              </div>
            ) : currentView === 't1_screening' && outOfRangeCard ? (
              <div className="mx-auto w-full max-w-xl animate-fade-in">{outOfRangeCard}</div>
            ) : currentView === 't1_screening' ? (
              /* Global adaptive age-band comprehensive questionnaire T1 */
              <div className="animate-fade-in">
                <T1Screening
                  child={child}
                  answeredBefore={completedScores.some(s => s.tierId === 'T1')}
                  onBack={() => setCurrentView('dashboard')}
                  onSaveT1Results={(t1Scores, childWithSupplement) => {
                    // Overwrite state and save
                    const updated = completedScores.filter(s => s.tierId !== 'T1');
                    const finalScores = [...updated, ...t1Scores];
                    setCompletedScores(finalScores);
                    localStorage.setItem('senxinkang_scores', JSON.stringify(finalScores));
                    setViewingLiveT1(true);
                    if (PRODUCT.features.ui1022) {
                      // 1022（ADR-0014）：交卷那一下就存成績（中途關掉也不白做）、到報告頁就生成新的一份。
                      // 補充資料（issue #83）一起寫回孩子檔案。
                      const savedChild = childWithSupplement ?? child;
                      if (childWithSupplement) {
                        setChildProfile(childWithSupplement);
                        localStorage.setItem('senxinkang_child', JSON.stringify(childWithSupplement));
                      }
                      syncToCloud(savedChild, finalScores, orders, reportHistory);
                      setT1ReportGenerate(true); setFreshT1Report(true);
                    } else {
                      // Go straight to the live AI report instead of bouncing off the
                      // dashboard. The user still taps "一键启动 AI 突触分析" there, so
                      // finishing T1 never spends AI quota on its own.
                      setT1ReportGenerate(false); setFreshT1Report(false);
                    }
                    setActiveT1Record(null);
                    setActiveSpecializedRecordId(null);
                    setCurrentView('report');
                  }}
                />
              </div>
            ) : currentView === 'assessment' && activeDimension && PRODUCT.features.tier2And3 && !isRouteBlocked ? (
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
                      setFocusBooking(false); setFocusT2(false);
                    }}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    // T2 入口只掛在即時報告上（票 #56）；B 沒有 T2。
                    t2={PRODUCT.features.tier2And3 ? { access: t2Access, freePeriod: t2FreePeriod, onUnlock: enterT2, onStart: enterT2 } : undefined}
                    // B 在同一個位置放「到 A 做深度評估」（ADR-0009）；卡自己問伺服器交接開了沒。
                    handoff={PRODUCT.features.handoff === 'send' ? { onShowPrivacy: () => setShowPrivacyModal(true) } : undefined}
                    historicalRecord={null}
                    reportHistory={reportHistory}
                    resumeFrom={freshT1Report ? null : liveReportResume}
                    generateOnOpen={t1ReportGenerate}
                    focusT2={focusT2}
                    focusBooking={focusBooking}
                    focusBookingService={focusBookingService}
                    // 「线上干预训练指导」＝導覽列那一頁「线上干预」（2026-09-29）；B 沒有那一頁
                    onOpenTraining={PRODUCT.features.tier2And3 ? () => setCurrentView('training') : undefined}
                  />
                </div>
              ) : activeT1Record ? (
                <div className="animate-fade-in">
                  <AnalysisReport
                    child={child}
                    completedScores={activeT1Record.scores}
                    onBack={() => {
                      setActiveT1Record(null);
                      setFocusBooking(false); setFocusT2(false);
                    }}
                    onSaveReportToHistory={handleSaveReportToHistory}
                    historicalRecord={activeT1Record}
                    reportHistory={reportHistory}
                    // 從干預包的「联系专家」進來時要捲到預約區塊 —— 這一支是
                    // `goToExpertBooking` 優先走的那一條路（已歸檔的報告帶著
                    // aiReport，區塊當場就在）。少了這個 prop，捲動只在即時報告
                    // 那一支生效，而那一支正好是區塊還沒出現的那一支。
                    focusBooking={focusBooking}
                    focusBookingService={focusBookingService}
                    // 「线上干预训练指导」＝導覽列那一頁「线上干预」（2026-09-29）；B 沒有那一頁
                    onOpenTraining={PRODUCT.features.tier2And3 ? () => setCurrentView('training') : undefined}
                  />
                </div>
              ) : PRODUCT.features.ledo ? (
                <LedoReportLibrary
                  childName={child?.name ?? ''}
                  t1Count={completedScores.filter(s => s.tierId === 'T1').length}
                  history={reportHistory.filter(r => r.type === 'T1_SCREENING')}
                  onOpenLive={() => { setT1ReportGenerate(false); setFreshT1Report(false); setViewingLiveT1(true); }}
                  onOpenRecord={rec => {
                    setActiveT1Record(rec);
                    // 同舊版：從歸檔清單點進來的報告要從頭看起，清掉上一次「联系专家」留下的捲動旗標。
                    setFocusBooking(false); setFocusT2(false);
                  }}
                />
              ) : (
                <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-12">
                  {/* Page header */}
                  <div className="bg-white px-6 py-6 rounded-3xl border border-brand-stone shadow-sm text-left flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-black text-brand-forest tracking-tight">综合发育评估报告库</h2>
                      <p className="text-xs text-brand-charcoal/80 font-medium mt-1">历次综合评估与专项深度评估数据资料库，符合隐私保护条款管理规范。</p>
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
                    {/* Left side: T1 screening reports (full width) */}
                    <div className="lg:col-span-12 bg-white border border-brand-stone rounded-3xl p-6 shadow-sm space-y-6 text-left">
                      <div className="flex items-center justify-between border-b border-brand-stone/60 pb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-brand-sage/60 rounded-lg flex items-center justify-center text-brand-forest">
                            <Layers size={16} />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-brand-charcoal">儿童综合发展评估报告</h3>
                            <p className="text-xs text-brand-charcoal/80">9维度多感官神经网络基础评估</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold bg-brand-sage px-2 py-0.5 rounded text-brand-forest">评估层</span>
                      </div>

                      {/* Live Screening Card */}
                      <div className="bg-brand-sage/20 border border-brand-stone/60 rounded-2xl p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs bg-brand-forest text-white font-extrabold px-1.5 py-0.5 rounded">实时动态</span>
                            <h4 className="text-xs font-bold mt-1.5 text-brand-charcoal">当前全维动态脑智评估进度</h4>
                            <p className="text-xs text-brand-charcoal/80 mt-0.5">基于已导入的 T1 测评分数实时核算</p>
                          </div>
                          <span className="text-xs font-extrabold text-brand-forest">{completedScores.filter(s => s.tierId === 'T1').length}/9 维度</span>
                        </div>
                        <button
                          onClick={() => { setT1ReportGenerate(false); setFreshT1Report(false); setViewingLiveT1(true); }}
                          className="w-full py-2 bg-brand-forest hover:bg-brand-forest-dark text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-brand-forest/10"
                        >
                          <Sparkles size={12} />
                          查看实时综合评估报告
                        </button>
                      </div>

                      {/* Saved T1 Reports History List */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold text-brand-charcoal/80">已存归档报告：</h4>
                        {reportHistory.filter(r => r.type === 'T1_SCREENING').length === 0 ? (
                          <div className="border border-dashed border-brand-stone rounded-2xl py-6 px-4 text-center text-xs text-brand-charcoal/80">
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
                                      setFocusBooking(false); setFocusT2(false);
                                    }}
                                    className="border border-brand-stone/60 hover:border-brand-forest/60 hover:bg-brand-sage/5 rounded-2xl p-3.5 text-left cursor-pointer transition group"
                                  >
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-brand-charcoal/80 font-bold">
                                        {new Date(rec.createdAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                      <span className="text-xs text-brand-forest font-bold flex items-center gap-0.5 group-hover:underline">
                                        查看报告 <ChevronRight size={10} />
                                      </span>
                                    </div>
                                    <h5 className="text-xs font-bold text-brand-charcoal mt-1">儿童综合发展评估报告</h5>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs bg-red-50 text-red-600 border border-red-100 rounded px-1.5 font-medium">
                                        {STATUS_WORDING.delay.label}: {delayCount}
                                      </span>
                                      <span className="text-xs bg-brand-sage/40 text-brand-forest border border-brand-stone/40 rounded px-1.5 font-medium">
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

                    {/* 2026-09-16：右欄的「T2/T3 专项报告」區塊拿掉 —— T2 v2 的報告在作答清單那頁，舊 T3 已從家長端下架。 */}
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
            ) : currentView === 'paywall' && PRODUCT.features.tier2And3 && PRODUCT.features.paywall ? (
              /* 整份 T2 深度評估的付費解鎖牆（僅專案 A）—— 一個入口、一個價格 */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <Paywall
                    priceFen={unlockPriceFen}
                    isDemo={t2Access === 'demo'}
                    onBack={() => setCurrentView('dashboard')}
                    onAlreadyUnlocked={() => {
                      // 別的分頁買完了 —— 記下權益後把他送回原本要去的地方，
                      // 不讓家長再付一次，也不讓他回總覽自己再找一次。
                      setT2Unlocked(true);
                      if (paywallReturn?.target === 'language_special') {
                        setCurrentView('language_special');
                        return;
                      }
                      if (paywallReturn?.target === 't2') {
                        // 從 T1 報告的 T2 入口過來的：送回那份報告，入口會以已解鎖的樣子重畫，並捲到那張卡。
                        setViewingLiveT1(true);
                        setT1ReportGenerate(false); setFreshT1Report(false);
                        setActiveT1Record(null);
                        setFocusT2(true);
                        setCurrentView('report');
                        return;
                      }
                      if (paywallReturn) setSelectedDimensionId(paywallReturn.dimensionId);
                      setCurrentView('assessment');
                    }}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 't2_assessment' && PRODUCT.features.tier2And3 && !isRouteBlocked ? (
              /* T2 深度評估的逐支作答（票 #58）：只有解鎖後到得了；回去是即時 T1 報告（入口在那裡） */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <T2Assessment
                    onBack={() => {
                      setViewingLiveT1(true);
                      setT1ReportGenerate(false); setFreshT1Report(false);
                      setActiveT1Record(null);
                      setCurrentView('report');
                    }}
                    onOpenReport={generate => {
                      setT2ReportGenerate(generate);
                      setCurrentView('t2_report');
                    }}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 't2_report' && PRODUCT.features.tier2And3 && !isRouteBlocked ? (
              /* T2 深度評估的報告頁（票 #61）：從作答清單進來；沒有問卷／配不到活動的維度導向預約表（在 T1 報告頁裡） */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <T2Report
                    childName={child?.name}
                    generateOnOpen={t2ReportGenerate}
                    onBack={() => setCurrentView('t2_assessment')}
                    onBookService={type => goToExpertBooking(type)}
                    onOpenTraining={() => setCurrentView('training')}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 'training' && PRODUCT.features.tier2And3 ? (
              /*
                线上干预（2026-09-28 起從導覽列開，不在報告裡）。要先買過 T2，再在 T2 報告裡另外買（ADR-0012；
                src/t2/trainingGate.ts，現在免費）；沒買 T2、沒有報告時頁面自己說要先做什麼。
              */
              <div className="animate-fade-in">
                <LazyBoundary>
                  <TrainingPage
                    childName={child?.name}
                    onBookService={type => goToExpertBooking(type)}
                    onGoToT2={goToT2Entrance}
                  />
                </LazyBoundary>
              </div>
            ) : currentView === 'language_special' && PRODUCT.features.tier2And3 && !isRouteBlocked ? (
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
      {PRODUCT.features.ledo && child && <LedoTabBar items={navItems} />}

      <footer className={`bg-white border-t border-brand-stone/60 py-6 mt-16${PRODUCT.features.ledo && child ? ' max-lg:pb-28' : ''} text-center text-xs text-brand-charcoal/80 font-medium relative z-10`}>
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p>{PRODUCT.brand.copyright}</p>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
            <button onClick={() => setShowServiceModal(true)} className="whitespace-nowrap hover:text-brand-forest transition-colors cursor-pointer">服务及免责条款</button>
            <span>•</span>
            <button onClick={() => setShowPrivacyModal(true)} className="whitespace-nowrap hover:text-brand-forest transition-colors cursor-pointer">隐私保护条款</button>
            {/* 1022：頁尾只留版權、兩個條款、備案號（暫採：歸檔聲明從頁尾拿掉；它連的 `#specs` 站上本來就沒有這個錨點）。 */}
            {!PRODUCT.features.ui1022 && (<>
            <span>•</span>
            <a href="#specs" className="whitespace-nowrap hover:text-brand-forest transition-colors">发育评估量表归档声明</a>
            </>)}
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
                <span className="text-brand-charcoal/80 text-sm font-bold">✕</span>
              </button>
            </div>

            {/* 内容区 */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 text-xs text-brand-charcoal/80 leading-relaxed">
              <PrivacyTerms />
              <LegalFooterLine />
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
                <span className="text-brand-charcoal/80 text-sm font-bold">✕</span>
              </button>
            </div>

            {/* 内容区 */}
            <div className="overflow-y-auto px-6 py-5 space-y-5 text-xs text-brand-charcoal/80 leading-relaxed">
              <ServiceTerms />
              <LegalFooterLine />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
