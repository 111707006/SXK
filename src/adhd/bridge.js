/*
 * SXK 2026-11-23 加：成人 ADHD 頁面（客戶原檔 ADHD/成人ADHD筛查版_20261111.html）的橋接腳本。
 * 客戶原檔一個位元組都不改；我們加的行為全部在這一檔（設計：docs/specs/adhd-product-design.md 第 3 節）。
 * 由 src/adhd/page.ts 插在 </body> 前。
 *
 * 執行時機：客戶頁面的 script 都是內嵌的、已經跑完；它的 init 等 DOMContentLoaded 才跑。這一檔是外部
 * script，在那之前執行 —— 所以「換人就清本機草稿」「只讀時不碰本機儲存」都來得及在客戶頁面還原草稿之前做。
 *
 * 用到的客戶頁面全域變數（探針在 src/adhd/page.ts）：APP、CUR、STEPS、go、casePayload、loadCase、resetCase、renderNav。
 *
 * 三種模式（看網址）：
 *   /assess/              作答：要登入（B 的家長端通行證）；走到報告且有結論時存到伺服器
 *   /assess/?new=1        同上，先開一份新的個案（外殼的「開始新的評估」）
 *   /assess/?view=<id>    受評者看自己的一筆（只讀）
 *   /assess/?admin-view=<id>  後台看一筆（只讀，後台通行證）
 *
 * 純 ES5、不打包、不 import —— 跟客戶頁面同一個執行環境。
 */
(function () {
  'use strict';

  var USER_TOKEN_KEY = 'senxinkang_token'; // 與 src/utils/api.ts 同一個鍵
  var ADMIN_TOKEN_KEY = 'sxk_admin_token'; // 與 src/admin/adminApi.ts 同一個鍵
  var DRAFT_PREFIX = 'ADHD_SCREEN_LOCAL_V15:'; // 客戶頁面的本機草稿
  var OWNER_KEY = 'sxk_adhd_owner'; // 本機草稿是誰的
  var CASE_KEY = 'sxk_adhd_case'; // 目前這份個案在伺服器上的 clientCaseId
  var SAVE_URL = '/api/adhd/assessments';

  var params = new URLSearchParams(location.search);
  var viewId = params.get('view');
  var adminViewId = params.get('admin-view');
  var wantNew = params.get('new') === '1';
  var ls = window.localStorage;

  function get(k) { try { return ls.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { ls.setItem(k, v); } catch (_) {} }

  /** 通行證裡的帳號 id（只拿來分本機草稿，不當身分驗證 —— 那是伺服器的事）。 */
  function uidOf(token) {
    try {
      var p = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      return String(JSON.parse(atob(p)).uid || '');
    } catch (_) { return ''; }
  }

  function uid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2) + '-' + Math.random().toString(36).slice(2);
  }

  function hidePage() { document.documentElement.style.visibility = 'hidden'; }
  function toLogin() {
    hidePage();
    location.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
  }

  /** 角落一行字（唯一新增的畫面元素）。 */
  var toastEl = null;
  function toast(text, retry) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'noprint';
      toastEl.setAttribute('role', 'status');
      toastEl.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:9999;background:#1F4A3D;color:#fff;' +
        'padding:10px 14px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,.18);max-width:calc(100vw - 32px)';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    if (retry) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = '重试';
      b.style.cssText = 'margin-left:10px;background:#fff;color:#1F4A3D;border:0;border-radius:6px;padding:2px 10px;cursor:pointer;font:inherit';
      b.onclick = retry;
      toastEl.appendChild(b);
    }
    toastEl.style.display = '';
    if (!retry) setTimeout(function () { if (toastEl) toastEl.style.display = 'none'; }, 2500);
  }

  // ───────────────────────── 只讀檢視 ─────────────────────────
  if (viewId || adminViewId) {
    var admin = !!adminViewId;
    var token = get(admin ? ADMIN_TOKEN_KEY : USER_TOKEN_KEY);
    var id = admin ? adminViewId : viewId;
    if (!token) {
      if (admin) { document.addEventListener('DOMContentLoaded', function () { document.body.textContent = '请先登录后台。'; }); return; }
      toLogin();
      return;
    }
    // 客戶頁面每次都透過 window.localStorage 讀寫草稿。只讀時換成一份記憶體裡的，
    // 這一筆不會被還原成、也不會被存成這台裝置上的本機草稿（後台人員的電腦上不留別人的資料）。
    var mem = {};
    var fake = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; },
    };
    try { Object.defineProperty(window, 'localStorage', { value: fake, configurable: true }); } catch (_) {}

    var style = document.createElement('style');
    style.textContent = '#nav,#autosave-banner,#data-tools,#pb{display:none!important}';
    document.head.appendChild(style);
    hidePage();

    var fetched = fetch((admin ? '/api/admin/adhd/assessments/' : SAVE_URL + '/') + encodeURIComponent(id), {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store',
    }).then(function (r) {
      if (r.status === 401 && !admin) { toLogin(); throw new Error('401'); }
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });

    document.addEventListener('DOMContentLoaded', function () {
      fetched.then(function (body) {
        var r = window.loadCase(body.payload);
        if (!r || r.err) throw new Error(r && r.err || 'load');
        // 直接切到報告頁（不走 go：客戶頁面換頁前會檢查目前這一頁有沒有填完）。
        window.CUR = 's2';
        window.STEPS.forEach(function (s) {
          var sec = document.getElementById('st_' + s.k);
          if (sec) sec.classList.toggle('on', s.k === 's2');
        });
        window.APP.mod.s2.render();
        // 報告頁裡回到作答的按鈕藏起來（只讀）。
        Array.prototype.forEach.call(document.querySelectorAll('#st_s2 button'), function (b) {
          if (/^\s*←/.test(b.textContent || '')) b.style.display = 'none';
        });
        document.documentElement.style.visibility = '';
      }).catch(function (e) {
        if (e && e.message === '401') return;
        document.documentElement.style.visibility = '';
        document.body.textContent = '这份结果读取失败（' + (e && e.message || '') + '）。';
      });
    });
    return;
  }

  // ───────────────────────── 作答 ─────────────────────────
  var userToken = get(USER_TOKEN_KEY);
  if (!userToken) { toLogin(); return; }

  // 同一台裝置換人登入（合作單位的共用平板）：上一位的本機草稿清掉，不讓下一位看到、也不會被當成自己的存上去。
  var me = uidOf(userToken);
  if (get(OWNER_KEY) !== me) {
    try {
      var drop = [];
      for (var i = 0; i < ls.length; i++) {
        var k = ls.key(i);
        if (k && (k.indexOf(DRAFT_PREFIX) === 0 || k === CASE_KEY)) drop.push(k);
      }
      drop.forEach(function (k) { ls.removeItem(k); });
    } catch (_) {}
    set(OWNER_KEY, me);
  }

  function caseId() {
    var c = get(CASE_KEY);
    if (!c || !/^[A-Za-z0-9-]{8,100}$/.test(c)) { c = uid(); set(CASE_KEY, c); }
    return c;
  }

  var lastSent = '';
  var inFlight = false;
  var again = false;
  var timer = null;

  function fingerprint(p) {
    var copy = JSON.parse(JSON.stringify(p));
    delete copy.exportedAt;
    return JSON.stringify(copy);
  }

  function save() {
    timer = null;
    if (window.CUR !== 's2') return;
    var s2 = window.APP && window.APP.d && window.APP.d.s2;
    if (!s2 || !s2.conclusion || s2.conclusion.status === 'incomplete') return;
    var payload;
    try { payload = window.casePayload(); } catch (_) { return; }
    var fp = caseId() + '|' + fingerprint(payload);
    if (fp === lastSent) return;
    if (inFlight) { again = true; return; }
    inFlight = true;
    fetch(SAVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + get(USER_TOKEN_KEY) },
      body: JSON.stringify({ clientCaseId: caseId(), payload: payload }),
    }).then(function (r) {
      if (r.status === 401) { toLogin(); return; }
      if (!r.ok) throw new Error(String(r.status));
      lastSent = fp;
      toast('结果已保存');
    }).catch(function () {
      toast('结果尚未保存', function () { lastSent = ''; save(); });
    }).then(function () {
      inFlight = false;
      if (again) { again = false; save(); }
    });
  }

  function later() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(save, 400);
  }

  // 換頁（客戶頁面裡所有 go(...) 都是呼叫這個全域變數）。
  var pageGo = window.go;
  window.go = function () {
    var r = pageGo.apply(this, arguments);
    later();
    return r;
  };

  // 「开始新的填写」、匯入檔案、從本機記錄換一筆：之後存的是另一筆。
  // 客戶頁面 init 還原上次草稿時也會經過 resetCase（loadCase 裡面叫它），那一次不算 —— 還是同一份個案。
  var ready = false;
  var pageReset = window.resetCase;
  window.resetCase = function () {
    var r = pageReset.apply(this, arguments);
    if (ready) {
      set(CASE_KEY, uid());
      lastSent = '';
    }
    return r;
  };

  document.addEventListener('DOMContentLoaded', function () {
    // APP.changed 在 init 時被客戶頁面的自動保存包過一層，所以等 init 之後再包。
    var pageChanged = window.APP.changed;
    window.APP.changed = function () {
      var r = pageChanged.apply(this, arguments);
      later();
      return r;
    };
    ready = true;
    if (wantNew) {
      window.resetCase();
      history.replaceState(null, '', location.pathname);
    } else {
      caseId();
    }
    later();
  });
})();
