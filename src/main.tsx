import {StrictMode, lazy} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import LazyBoundary from './components/LazyBoundary.tsx';
import {captureCompanySlug} from './utils/attribution.ts';
import './index.css';

/**
 * 進站的第一件事：把合作公司的識別碼記下來。
 *
 * 必須在 render 之前 —— 家長可能一進站就直接註冊，而歸屬只在註冊那一刻寫得進去。
 */
captureCompanySlug();

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <LazyBoundary>
        <AdminApp />
      </LazyBoundary>
    ) : (
      <App />
    )}
  </StrictMode>,
);
