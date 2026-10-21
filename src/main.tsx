import {StrictMode, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import LazyBoundary from './components/LazyBoundary.tsx';
import ScanReportPage from './components/ScanReportPage.tsx';
import {PRODUCT} from './productConfig.ts';
import {captureCompanySlug} from './utils/attribution.ts';
import {loadReportLayout} from './utils/reportLayout.ts';
import './index.css';

/**
 * 進站的第一件事：把合作公司的識別碼記下來。
 *
 * 必須在 render 之前 —— 家長可能一進站就直接註冊，而歸屬只在註冊那一刻寫得進去。
 */
captureCompanySlug();

/**
 * 報告版面的開關（`GET /api/report-config`，#71）一進站就開始問：家長端、後台、掃碼頁都畫 `ReportBody`，
 * 等報告畫出來時通常已經回來了，版面不會在家長眼前換一次。
 */
void loadReportLayout();

/**
 * 管理中心走 `/admin`，與家長端共用同一個部署與資料庫。
 *
 * 用 `lazy` 而不是直接 import：後台是給後台成員看的，一個從連結進來做篩查的
 * 家長不該為了它多下載一份程式碼。
 */
const AdminApp = lazy(() => import('./admin/AdminApp.tsx'));

/**
 * 精確比對 `/admin` 與它底下的路徑，不用 `startsWith('/admin')`。
 *
 * 伺服器的 SPA 兜底會把任何未匹配的路徑都回 index.html，所以 `startsWith` 會讓
 * `/administrator`、`/admin-guide` 這種路徑也載入後台登入畫面 —— 使用者拿到一個
 * 完全不相干的頁面，而且沒有任何線索說明為什麼。
 */
const path = window.location.pathname;
const isAdmin = path === '/admin' || path.startsWith('/admin/');

/**
 * 掃碼報告頁（`/r/<token>`，issue #65）。伺服器只在開關 `REPORT_SCAN_SPA` 開著時把這條路徑交給 SPA；
 * 關著時那條路徑由伺服器自己回 HTML，根本走不到這裡。不進 App —— 掃碼的手機沒有登入。
 */
const scanToken = path.match(/^\/r\/([^/]+)\/?$/)?.[1] ?? null;

/**
 * Ledo 版（`PRODUCT.features.ledo`，建置期）：家長端與掃碼頁在 `<html>` 掛 `data-ui="ledo"`，
 * `index.css` 依它換一套色票；後台不掛，照舊。render 之前就掛，第一格就是對的顏色。
 */
if (PRODUCT.features.ledo && !isAdmin) document.documentElement.dataset.ui = 'ledo';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <LazyBoundary>
        <AdminApp />
      </LazyBoundary>
    ) : scanToken !== null ? (
      <ScanReportPage token={scanToken} />
    ) : (
      <App />
    )}
  </StrictMode>,
);
