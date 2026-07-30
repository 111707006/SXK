# 微信支付 APIv3 — H5支付 接入契約研究

> 研究日期：2026-07-29
> 資料來源：**僅限**微信支付官方商戶文檔中心 `https://pay.weixin.qq.com/doc/v3/merchant/...`（以及官方 GitHub 組織 `wechatpay-apiv3`）。本文未採用任何部落格、二手教學或社群文章。
> 目標技術棧：Node.js + Express（後端）、React H5（前端）。商品為 ¥19.9 虛擬服務。
> 慣例：API 欄位名、endpoint、HTTP header 一律保留原文；敘述使用繁體中文。

---

## 結論摘要 / 前置阻塞

**在寫任何一行支付程式碼之前，下列事項必須先存在。這些是硬性阻塞，不是「之後再補」。**

| # | 前置條件 | 阻塞程度 | 依據 |
|---|---|---|---|
| 1 | **一個「已認證」的公眾帳號 APPID**（已認證服務號／已認證政府或媒體類型公眾號／已認證小程序／已認證移動應用擇一），並與商戶號完成授權綁定 | **絕對阻塞**。官方明文：「未認證的账号无法绑定商户号」 | [開發接入準備](https://pay.weixin.qq.com/doc/v3/merchant/4015614193) |
| 2 | **商戶號 mchid**，且該商戶號主體須為企業／事業單位／政府機關／社會組織（個人主體不可） | **絕對阻塞** | [產品介紹](https://pay.weixin.qq.com/doc/v3/merchant/4012791832) |
| 3 | 商戶平台**申請「H5支付」產品權限**並通過 | **絕對阻塞** | [開發接入準備](https://pay.weixin.qq.com/doc/v3/merchant/4015614193) |
| 4 | 商戶平台**配置 H5支付域名**，且需 3～5 個工作天審核；域名需 ICP 備案且備案主體與商戶號主體一致 | **絕對阻塞**，且有前置工期 | [配置H5支付域名](https://pay.weixin.qq.com/doc/v3/merchant/4013287193) |
| 5 | **APIv3密鑰**（32 位字母數字字串）——不設定就收不到回調 | **絕對阻塞**。官方：未設置 apiV3key 或未配置 notify_url 時，微信支付不會發送回調通知 | [回調通知注意事項](https://pay.weixin.qq.com/doc/v3/merchant/4012075420)、[證書密鑰概覽](https://pay.weixin.qq.com/doc/v3/merchant/4024350132) |
| 6 | **商戶API證書**：`apiclient_key.pem`（私鑰，用於簽名）+ **商戶API證書序列號**（填入 `Authorization` 的 `serial_no`） | **絕對阻塞** | [開發必要參數說明](https://pay.weixin.qq.com/doc/v3/merchant/4013070756) |
| 7 | **微信支付公鑰 + 微信支付公鑰ID**（官方【推薦】方案）或舊制**微信支付平台證書**（二擇一，用於驗簽） | **絕對阻塞** | [APIv3如何簽名和驗簽](https://pay.weixin.qq.com/doc/v3/merchant/4012365342)、[微信支付公鑰](https://pay.weixin.qq.com/doc/v3/merchant/4012153196) |
| 8 | **一個公網可達的 HTTPS `notify_url`**，不可帶查詢參數，不可為 localhost／內網 IP | **絕對阻塞** | [回調通知注意事項](https://pay.weixin.qq.com/doc/v3/merchant/4012075420) |

### 兩個最容易踩死人的產品限制

1. **H5支付在微信內置瀏覽器裡無法使用。** 官方 FAQ 對「請在微信外打開訂單，進行支付」的答覆是：「H5支付不能直接在微信客户端内调起，请在外部浏览器调起，如需在微信内部浏览器拉起支付，请使用JSAPI支付。」
   來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791845>
   → **若你的 ¥19.9 服務有任何流量來自微信內分享（朋友圈、群、公眾號選單），H5支付會直接失敗，必須另外接 JSAPI支付。** 這是產品決策，不是技術細節。

2. **H5支付不支援在 APP 內使用。** 產品介紹明文：「请注意不支持在APP内使用H5支付，若是APP场景请使用APP支付」。
   來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791832>

### 對 Node.js 團隊最重要的一句話

**微信支付沒有官方 Node.js SDK。** 官方 SDK 頁面只列出 **Java（wechatpay-java）／PHP（wechatpay-php）／Go（wechatpay-go）** 三種。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012076498>；官方 GitHub 組織 <https://github.com/wechatpay-apiv3>（自述為 "the official WeChatPay API-Infra team"，其下無 Node.js SDK）。
→ 簽名、驗簽、AEAD_AES_256_GCM 解密都要在 Node 端自行以 `crypto` 實作。詳細演算法見第 2、3 節，已足以自行實作。

---

## 1. H5支付下單 API

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>**

### Endpoint 與方法

| 項目 | 值 |
|---|---|
| HTTP Method | `POST` |
| 路徑 | `/v3/pay/transactions/h5` |
| 主域名 | `https://api.mch.weixin.qq.com` |
| 備域名 | `https://api2.mch.weixin.qq.com` |

完整 URL：`https://api.mch.weixin.qq.com/v3/pay/transactions/h5`

### 必要 Request Headers

| Header | 值 |
|---|---|
| `Authorization` | 簽名認證資訊，格式見第 2 節 |
| `Accept` | `application/json` |
| `Content-Type` | `application/json` |

### 請求參數

| 欄位（含巢狀路徑） | 型別 | 長度 | 必填 | 說明 |
|---|---|---|---|---|
| `appid` | string | 32 | 是 | 公眾帳號ID，須為已與 mchid 綁定的**已認證** APPID |
| `mchid` | string | 32 | 是 | 商戶號 |
| `description` | string | 127 | 是 | 商品描述，會顯示在用戶微信帳單 |
| `out_trade_no` | string | 32 | 是 | 商戶訂單號，商戶系統內唯一 |
| `time_expire` | string | 64 | 否 | RFC3339 格式支付結束時間；不傳預設 7 天 |
| `attach` | string | 128 | 否 | 附加資料，回調原樣返回 |
| `notify_url` | string | 255 | 是 | 支付成功回調位址（規範見第 3 節） |
| `goods_tag` | string | 32 | 否 | 訂單優惠標記 |
| `support_fapiao` | boolean | — | 否 | 是否開啟電子發票入口 |
| `amount.total` | integer | — | **是** | **訂單總金額，單位為分**（見下方原文） |
| `amount.currency` | string | 16 | 否 | ISO 4217 幣別碼，人民幣填 `CNY` |
| `detail.cost_price` | integer | — | 否 | 訂單原價 |
| `detail.invoice_id` | string | 32 | 否 | 商戶小票ID |
| `detail.goods_detail[]` | array | — | 否 | 單品列表，傳入時至少一筆 |
| `detail.goods_detail[].merchant_goods_id` | string | 32 | 條件必填 | 商戶側商品編碼 |
| `detail.goods_detail[].wechatpay_goods_id` | string | 32 | 否 | 微信支付商品編碼 |
| `detail.goods_detail[].goods_name` | string | 256 | 否 | 商品名稱 |
| `detail.goods_detail[].quantity` | integer | — | 條件必填 | 商品數量 |
| `detail.goods_detail[].unit_price` | integer | — | 條件必填 | 商品單價，單位為分 |
| `scene_info.payer_client_ip` | string | 45 | **是** | 用戶客戶端IP，「支持IPv4和IPv6两种格式的IP地址」 |
| `scene_info.device_id` | string | 32 | 否 | 商戶端設備號 |
| `scene_info.store_info.id` | string | 32 | 條件必填 | 門店編號 |
| `scene_info.store_info.name` | string | 256 | 否 | 門店名稱 |
| `scene_info.store_info.area_code` | string | 32 | 否 | 地區編碼 |
| `scene_info.store_info.address` | string | 512 | 否 | 詳細地址 |
| `scene_info.h5_info.type` | string | 32 | **是** | 場景類型，列舉值：`Wap` / `iOS` / `Android` |
| `scene_info.h5_info.app_name` | string | 64 | 否 | 應用或網站名稱 |
| `scene_info.h5_info.app_url` | string | 128 | 否 | 網站URL |
| `scene_info.h5_info.bundle_id` | string | 128 | 否 | iOS 應用 bundle id |
| `scene_info.h5_info.package_name` | string | 128 | 否 | Android 應用 package name |
| `settle_info.profit_sharing` | boolean | — | 否 | 是否指定分帳 |

**金額單位原文（關鍵）：**「订单总金额，单位为**分**，整型，必须大于0。」
→ 本專案 ¥19.9 應填 `"total": 1990`。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>

### 最小可用 request body

> 說明：以下 JSON 由上表**必填欄位**組裝而成，並非自官方頁面逐字複製的範例。每個欄位名與型別都可在上表對照回官方來源。

```json
{
  "appid": "wxd678efh567hg6787",
  "mchid": "1900007291",
  "description": "兒童發展深度評估解鎖",
  "out_trade_no": "SXK20260729000000000001",
  "notify_url": "https://api.example.com/pay/wechat/notify",
  "amount": {
    "total": 1990,
    "currency": "CNY"
  },
  "scene_info": {
    "payer_client_ip": "119.28.0.1",
    "h5_info": {
      "type": "Wap"
    }
  }
}
```

### 應答

| 欄位 | 型別 | 長度 | 說明 |
|---|---|---|---|
| `h5_url` | string | 256 | 支付跳轉連結，**有效期 5 分鐘** |

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>

---

## 2. APIv3 請求簽名

**來源（Body 參數版，適用本專案的 POST 下單）：<https://pay.weixin.qq.com/doc/v3/merchant/4012365336>**
**來源（Query 參數版，適用查單 GET）：<https://pay.weixin.qq.com/doc/v3/merchant/4012365337>**
**來源（路徑參數版）：<https://pay.weixin.qq.com/doc/v3/merchant/4012365334>**
**總述：<https://pay.weixin.qq.com/doc/v3/merchant/4012365342>**

### 簽名串構造

簽名串固定為 **5 行**，**每一行（含最後一行）都以 `\n` 結尾**（LF，ASCII `0x0A`，不是 `\r\n`）：

```
HTTP請求方法\n
URL\n
請求時間戳\n
請求隨機串\n
請求報文主體\n
```

逐行說明：

1. **HTTP請求方法** — `GET`、`POST` 等，大寫。
2. **URL** — 只取路徑部分，**不含域名**。
   - 有 path 參數時要代入實值，例如 `/v3/refund/domestic/refunds/123123123123`。
   - **有 query string 時必須一併包含**，例如 `/v3/pay/transactions/out-trade-no/xxx?mchid=1900007291`。（來源：Query 參數版簽名文件，其範例 URL 行為 `/v3/marketing/partnerships?limit=5&offset=10&...`）
3. **請求時間戳** — Unix epoch 秒。
4. **請求隨機串** — 隨機字串（官方範例為 32 位十六進位大寫）。
5. **請求報文主體** — **與實際送出的 body 逐位元組相同的原始 JSON 字串**。GET 請求 body 為空字串，但**該行的 `\n` 仍必須存在**。

官方 POST 範例簽名串（`/v3/pay/transactions/jsapi`，結構與 h5 相同）：

```
POST\n
/v3/pay/transactions/jsapi\n
1554208460\n
593BEC0C930BF1AFEB40B4A08C8FB242\n
{"appid":"wxd678efh567hg6787","mchid":"1900007291","description":"Image形象店-深圳腾大-QQ公仔","out_trade_no":"1217752501201407033233368018","notify_url":"https://www.weixin.qq.com/wxpay/pay.php","amount":{"total":100,"currency":"CNY"},"payer":{"openid":"oUpF8uMuAJO_M2pxb1Q9zNjWeS6o"}}\n
```

官方 GET 範例簽名串（注意第 5 行是空行）：

```
GET\n
/v3/refund/domestic/refunds/123123123123\n
1554208460\n
593BEC0C930BF1AFEB40B4A08C8FB242\n
\n
```

> **實作陷阱**：第 5 行必須是你真正 `send()` 出去的 byte 序列。在 Express/axios 中請先自行 `JSON.stringify()` 成字串，用該字串同時做簽名與 request body，切勿讓 HTTP client 重新序列化一次（鍵序或空白只要差一個字元就驗簽失敗）。

### 簽名演算法與金鑰

- **簽名金鑰：商戶API私鑰**（`apiclient_key.pem`）。
- **演算法：SHA256 with RSA**（`SHA256withRSA` / `RSASSA-PKCS1-v1_5` + SHA-256）。
- 簽名結果再做 **Base64** 編碼。

官方驗證指令：

```bash
echo -n -e 'GET\n/v3/refund/domestic/refunds/123123123123\n1554208460\n593BEC0C930BF1AFEB40B4A08C8FB242\n\n' \
| openssl dgst -sha256 -sign apiclient_test_key.pem \
| openssl base64 -A
```

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012365334>

Node.js 對應（`crypto`）：`crypto.createSign('RSA-SHA256').update(message).sign(privateKey, 'base64')`。

### Authorization header 格式

**認證類型（scheme）名稱：`WECHATPAY2-SHA256-RSA2048`**

格式為 `Authorization: <scheme> <逗號分隔的鍵值對>`，每個值以**雙引號**包住，鍵值對之間以**逗號**分隔（官方註明**欄位順序不限**）。

必要欄位：

| 欄位 | 內容 |
|---|---|
| `mchid` | 商戶號 |
| `nonce_str` | 必須與簽名串第 4 行完全相同 |
| `signature` | 上一步的 Base64 簽名結果 |
| `timestamp` | 必須與簽名串第 3 行完全相同 |
| `serial_no` | **商戶API證書序列號** |

官方完整範例：

```
Authorization: WECHATPAY2-SHA256-RSA2048 mchid="1900007291",nonce_str="593BEC0C930BF1AFEB40B4A08C8FB242",signature="Lc9VXxmeonkdV8Xk9tmigQFLhl0vRWTerdmoRu01aAnYwIrD/5nsSwE1WlmZGLRlAFTNQ3QsMa0+VRDlJp1Wp5p0nO8EK68b5sJBbjouxaFciIfq1zfDWWz+jqhcMoKXI1A6dPm1AW7D4d30WsMTNzp6g23OXakIsh9LO3lUmwvTuE0BY8ncf6tNGk4wKmvXwERd/ZpoQY3MAVKz+Nakwc+2XBmzT66KcUehU5kr4IvGa/lEU5RZb/q00zP9VLdBhC/jQSX3X1UcJLCtEc4gTmib4tnmAT+bHF/e17ZAuxDNcx6rqT8gNEXqaJGG+1OflMSTU2tpyG65G4dMKdFcoA==",timestamp="1554208460",serial_no="408B07E79B8269FEC3D5D3E6AB8ED163A6A380DB"
```

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012365334>

> 注意 `serial_no` 是**商戶自己的**證書序列號（用來讓微信支付找到你的公鑰驗你的簽），與回調中的 `Wechatpay-Serial`（微信支付側的證書／公鑰 ID）是兩個不同的東西。

---

## 3. 支付結果通知（回調）

**主來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791836>**
**通用規則：<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>**
**解密：<https://pay.weixin.qq.com/doc/v3/merchant/4012071382>**
**驗簽（公鑰版）：<https://pay.weixin.qq.com/doc/v3/merchant/4013053249>**
**驗簽（平台證書版）：<https://pay.weixin.qq.com/doc/v3/merchant/4013053420>**

### 3.1 HTTP 方法與 notify_url 規範

微信支付以 **`POST`** 呼叫商戶的 `notify_url`。

`notify_url` 硬性規範（原文引自[回調通知注意事項](https://pay.weixin.qq.com/doc/v3/merchant/4012075420)）：

- 「notify_url必须是以https://开头的完整全路径地址，并且确保URL中的域名和IP是外网可以访问的，不能填写localhost、127.0.0.1、192.168.x.x等本地或内网IP。」
- 「notify_url不能携带参数。」
- 「notify_url需要填写商户自己系统的真实地址，不能填写接口文档或demo上的示例地址。」
- 未設置 apiV3key 或未配置 notify_url 時，微信支付不會發送回調通知。

### 3.2 通知報文結構

```json
{
  "id": "string(36)",
  "create_time": "string(32)",
  "event_type": "TRANSACTION.SUCCESS",
  "resource_type": "encrypt-resource",
  "resource": {
    "original_type": "transaction",
    "algorithm": "AEAD_AES_256_GCM",
    "ciphertext": "string",
    "associated_data": "string",
    "nonce": "string"
  },
  "summary": "string(64)"
}
```

業務資料**不在明文**，全部在 `resource.ciphertext` 內。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791836>

### 3.3 驗簽（必須先於解密）

用於驗簽的 HTTP headers：

| Header | 用途 |
|---|---|
| `Wechatpay-Signature` | Base64 編碼的簽名值 |
| `Wechatpay-Timestamp` | 簽名時間戳 |
| `Wechatpay-Nonce` | 簽名隨機串 |
| `Wechatpay-Serial` | 微信支付側**平台證書序列號**或**微信支付公鑰ID** |
| `Wechatpay-Signature-Type` | 簽名類型，例：`WECHATPAY2-SHA256-RSA2048` |

驗簽名串為 **3 行**，每行以 `\n` 結尾：

```
應答時間戳\n
應答隨機串\n
應答報文主體\n
```

官方範例：

```
1722850421\n
d824f2e086d3c1df967785d13fcd22ef\n
{"code_url":"weixin://wxpay/bizpayurl?pr=JyC91EIz1"}\n
```

- 第 3 行是**原始 HTTP body 字串**，不可經過 JSON parse／re-stringify。在 Express 中必須拿到 raw body（例如 `express.raw({ type: 'application/json' })`），不能只用 `express.json()`。
- 演算法：**SHA256 with RSA 簽名驗證**。
- 官方建議**允許最多 5 分鐘的時間偏差**，超過則拒絕，以防重放攻擊。

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4013053420>

#### 兩套驗簽憑證並存 —— 兩者都要知道

微信支付目前**同時存在**兩種驗簽憑證方案：

| 方案 | 憑證 | `Wechatpay-Serial` 內容 | 有效期 | 官方態度 |
|---|---|---|---|---|
| **微信支付公鑰**（新） | 從商戶平台「帳戶中心 → API安全」申請下載的公鑰檔（例：`1900009191_wxp_pub.pem`）+ 微信支付公鑰ID | 公鑰ID，形如 `PUB_KEY_ID_0000000000000024101100397200000006` | 「无过期时间」 | **【推荐】**、「维护更简单，推荐使用」 |
| **微信支付平台證書**（舊） | 透過 `GET /v3/certificates` 下載並以 APIv3密鑰解密取得的平台證書，取其公鑰 | 平台證書序列號，形如 `4DF076AC5A7D968D4A8B0B9C599A74CB4CF8EE8A` | 5 年，需換證 | 舊制，官方提供「从平台证书切换成微信支付公钥」指引 |

- 同一個商戶號**只會使用其中一種**。
- 驗簽流程相同（3 行簽名串 + SHA256 with RSA），差別只在「用哪把公鑰」以及 `Wechatpay-Serial` 該比對什麼。
- 平台證書方案下，官方要求：先檢查 `Wechatpay-Serial` 是否與商戶當前持有的平台證書序列號一致；不一致代表平台證書已輪換，需重新下載。

**本專案建議直接採用「微信支付公鑰」方案** —— 免去 `/v3/certificates` 下載、APIv3密鑰解密證書、證書輪換快取這一整套邏輯，對沒有官方 SDK 的 Node.js 端省下大量程式碼。

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4013053249>、<https://pay.weixin.qq.com/doc/v3/merchant/4024350132>、<https://pay.weixin.qq.com/doc/v3/merchant/4012365342>、<https://pay.weixin.qq.com/doc/v3/merchant/4013070756>

相關頁面：
- 微信支付公鑰申請：<https://pay.weixin.qq.com/doc/v3/merchant/4012153196>
- 從平台證書切換成微信支付公鑰：<https://pay.weixin.qq.com/doc/v3/merchant/4012154180>
- 獲取平台證書 `/v3/certificates`：<https://pay.weixin.qq.com/doc/v3/merchant/4012551764>

### 3.4 解密 `resource`

- **演算法：`AEAD_AES_256_GCM`**（RFC 5116）
- **金鑰：APIv3密鑰**，必須恰為 **32 bytes**（商戶平台設定的 32 位字母數字字串）

輸入對應關係：

| AES-GCM 參數 | 來源欄位 | 備註 |
|---|---|---|
| key | APIv3密鑰 | 32 bytes，直接取字串 bytes |
| nonce / IV | `resource.nonce` | 原始 bytes（非 base64） |
| AAD（additional authenticated data） | `resource.associated_data` | 可能為空字串；支付通知時值為 `transaction` |
| ciphertext | `resource.ciphertext` | **先 Base64 decode**；**認證標籤（auth tag）附加在密文尾端**，長度 **128 bits / 16 bytes** |

官方 Java 範例（說明 tag 長度與 AAD 用法）：

```java
Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
SecretKeySpec key = new SecretKeySpec(aesKey, "AES");
GCMParameterSpec spec = new GCMParameterSpec(128, nonce);
cipher.init(Cipher.DECRYPT_MODE, key, spec);
cipher.updateAAD(associatedData);
return new String(cipher.doFinal(Base64.getDecoder().decode(ciphertext)), "utf-8");
```

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012071382>

> **Node.js 實作要點**：Node 的 `crypto.createDecipheriv('aes-256-gcm', key, nonce)` **不會**自動從密文尾端取 auth tag。必須手動切分：`const buf = Buffer.from(ciphertext, 'base64'); const authTag = buf.subarray(buf.length - 16); const data = buf.subarray(0, buf.length - 16);` 然後 `decipher.setAAD(Buffer.from(associated_data))`、`decipher.setAuthTag(authTag)`。這是 Node 移植官方 Java/PHP 範例時最常見的錯誤點。

### 3.5 商戶必須回傳的 HTTP 狀態碼與 body

| 情境 | HTTP 狀態碼 | Response body |
|---|---|---|
| **驗簽通過、處理成功** | **`200` 或 `204`** | **無需應答報文（空 body）** |
| **驗簽不通過／處理失敗** | **`4XX` 或 `5XX`** | 需返回應答報文，格式為 `{"code": "FAIL", "message": "失败"}` |

官方原文：
- 「验签通过：商户需告知微信支付接收回调成功，HTTP应答状态码需返回200或204，无需返回应答报文。」
- 「验签不通过：商户需告知微信支付接收回调失败，HTTP应答状态码需返回5XX或4XX，同时需返回应答报文」
- 「在验签失败的情况下，商户系统应返回失败（即应答4xx或5xx的状态码），等待微信支付携带正确签名重新发送通知回调。」

失敗應答 body：

```json
{
    "code": "FAIL",
    "message": "失败"
}
```

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791836>、<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>

> **注意**：這與網路上大量流傳的舊版寫法（回傳 `{"code":"SUCCESS","message":"成功"}`）**不同**。現行官方文件明確指出成功時**不需要應答報文**。回傳 200 + 空 body 即可；若你回傳 200 加上 `{"code":"SUCCESS"}` 實務上也會被視為成功（狀態碼為準），但以官方現行寫法為準較安全。

### 3.6 重試規則與重複通知

**重試頻次原文：**
「微信支付会按照（15s/15s/30s/3m/10m/20m/30m/30m/30m/60m/3h/3h/3h/6h/6h）的频次重复发送回调通知，直至微信支付接收到商户应答成功，或达到最大发送次数（**15次**）」

**應答逾時：**
「商户系统收到支付结果通知，需要在**5秒内**返回应答报文，否则微信支付认为通知失败，后续会重复发送通知。」

**重複通知／冪等：**
- 「若因网络或其他原因，商户收到了重复的回调通知，请做好**重入设计**并持续应答200」
- 「同样的通知可能会多次发送给商户系统，商户系统必须能够正确处理重复的通知。**如果已处理过，直接给微信支付返回成功。**」

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791836>、<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>

> **對 Express 的直接影響**：5 秒應答上限意味著「驗簽 → 解密 → 判斷是否已處理 → 立即回 200」必須走完，**發放權益／寫報告／寄信等重活要丟到非同步任務**，不能塞在回調 handler 裡同步做。

---

## 4. 查詢訂單 API

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791838>**
**實現指引：<https://pay.weixin.qq.com/doc/v3/merchant/4012075249>**

### Endpoints

| 查詢方式 | 路徑 | 可信度 |
|---|---|---|
| 以商戶訂單號 | `GET /v3/pay/transactions/out-trade-no/{out_trade_no}` | ✅ **已確認**（多次抓取一致） |
| 以微信支付訂單號 | ⚠️ **未能從一手文件確認** | 見下方警告 |

> ⚠️ **`transaction_id` 查單路徑未能確認。** 對同一官方頁面 <https://pay.weixin.qq.com/doc/v3/merchant/4012791838> 進行**三次**抓取，得到**三種不同**的路徑回答：
> 1. `/v3/pay/transactions/transaction-id/{transaction_id}`
> 2. `/v3/pay/transactions/{transaction_id}`
> 3.（另有 APIv3 慣例寫法 `/v3/pay/transactions/id/{transaction_id}`）
>
> 抓取工具在此欄位明顯不可靠，**本文拒絕在此猜測**。實作前請人工開啟官方頁面確認。
>
> **好消息**：`out-trade-no` 路徑在三次抓取中**完全一致**，可直接採用。**本專案以 `out_trade_no` 查單即足夠**（我們永遠握有自己的訂單號），可完全迴避此不確定性——建議就這麼做，不要用 `transaction_id` 查單。

- HTTP Method：`GET`
- 必要 query 參數：`mchid`（string, 32）
- 必要 headers：`Authorization`、`Accept: application/json`
- 簽名時 URL 行**必須包含 `?mchid=...` 查詢串**（見第 2 節）

完整範例：
`GET https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/SXK20260729000000000001?mchid=1900007291`

### `trade_state` 列舉值

| 值 | 意義 |
|---|---|
| `SUCCESS` | 支付成功 |
| `REFUND` | 轉入退款 |
| `NOTPAY` | 未支付 |
| `CLOSED` | 已關閉 |
| `REVOKED` | 已撤銷（付款碼支付） |
| `USERPAYING` | 用戶支付中（付款碼支付） |
| `PAYERROR` | 支付失敗（付款碼支付） |

其他應答欄位含 `appid`、`mchid`、`out_trade_no`、`transaction_id`、`trade_state_desc`、`payer`、`amount`。

### 官方對「用查單補償丟失回調」的指引

判定成功的官方條件：「验证签名成功，并且返回的 `trade_state` 为 `SUCCESS`」。

官方提供兩種輪詢策略（原文）：

- **方案一**：「每隔5秒/30秒/1分钟/3分钟/5分钟/10分钟/30分钟调用《微信支付查单接口》查询订单」
- **方案二**：「定时任务每隔30秒启动一次，找出最近10分钟内创建并且未支付的订单，调用《微信支付查单接口》核实订单状态」；查詢約 10 次仍未成功則呼叫關閉訂單介面關單。

若未收到回調，商戶應主動呼叫查單介面以「及时、准确地获取到订单的支付状态」。

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012075249>

關閉訂單 API：<https://pay.weixin.qq.com/doc/v3/merchant/4012791839>

> **本專案建議**：H5 支付完成後前端被 `redirect_url` 導回，此時**不可**直接認定支付成功。前端導回後應呼叫自家後端，由後端走查單 API 確認 `trade_state === "SUCCESS"` 才解鎖報告。回調與查單兩條路徑寫入同一份冪等邏輯。

---

## 5. 退款 API 與退款回調

### 申請退款

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012810597>**

| 項目 | 值 |
|---|---|
| HTTP Method | `POST` |
| 路徑 | `/v3/refund/domestic/refunds` |
| 域名 | `https://api.mch.weixin.qq.com` |

主要請求欄位：

| 欄位 | 必填 | 說明 |
|---|---|---|
| `transaction_id` 或 `out_trade_no` | 二選一必填 | 原支付訂單標識 |
| `out_refund_no` | 是 | 「商户系统内部的退款单号，商户系统内部唯一」 |
| `amount.refund` | 是 | 退款金額，單位為分 |
| `amount.total` | 是 | 原訂單金額，單位為分 |
| `amount.currency` | 是 | 固定 `CNY` |
| `reason` | 否 | 退款原因 |
| `notify_url` | 否 | 退款結果回調位址；不傳則使用商戶平台預設 |

官方警語：「申请退款接口返回成功仅表示退款单已受理成功，具体的退款结果需依据退款结果通知及查询退款的返回信息为准」

查詢退款單：<https://pay.weixin.qq.com/doc/v3/merchant/4012810601>

### 退款結果通知

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012810605>**

- HTTP Method：`POST`，送往「向商户预先设置的退款回调地址(申请退款传入的notfiy_url)」
- `event_type` 列舉值：`REFUND.SUCCESS`、`REFUND.ABNORMAL`、`REFUND.CLOSED`
- `resource.original_type`：`refund`
- 解密方式與支付回調完全相同：「使用APIv3密钥与回调通知参数resource.nonce和resource.associated_data，对数据密文resource.ciphertext进行解密」
- 商戶應答：成功「HTTP应答状态码需返回200或204」且無 body；失敗回 `4XX`/`5XX` 並帶 `{"code":"FAIL","message":"..."}`

---

## 6. `h5_url` 的使用規則

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>、<https://pay.weixin.qq.com/doc/v3/merchant/4012791845>、<https://pay.weixin.qq.com/doc/v3/merchant/4013287193>**

### 有效期

**5 分鐘。** FAQ 原文：「下单获取的支付跳转链接有效期为5分钟，超过有效期后需要重入下单接口获取新的支付跳转链接。」
→ 對應的用戶端錯誤訊息：「支付请求已失效，请重新发起支付」。

> **實作含意**：不要在下單後把 `h5_url` 快取或存進 DB 給用戶稍後點。應在用戶點「立即支付」的當下才呼叫下單，拿到 `h5_url` 立刻跳轉。

### 禁止竄改

「该参数严禁篡改、拆分或截断」——只允許在參數後追加 `redirect_url`，不得添加其他參數。

### Referer / 域名限制（最容易失敗的一點）

- **必須從已配置的 H5支付域名下的網頁發起跳轉。** 「使用H5支付，需要在商户平台配置H5支付域名，若跳转H5支付链接的网页域名不是商户配置的H5支付域名，将会报错」
- **完全一致比對，含大小寫。** 「跳转支付使用的域名必须与配置的域名完全一致」，且「大小写必须一致」——官方對照表舉例：配置 `pay.com` 時，`http://Pay.com` 驗證失敗。
- **Referer 不可為空。** FAQ 對「商家参数格式有误，请联系商家解决」的答覆指出，成因之一是「当前调起H5支付的referer为空」。若在 App 的 webview 中調起，需手動設定 Referer 為「商户申请H5时提交的授权域名」（官方範例：`extraHeaders.put("Referer", "商户申请H5时提交的授权域名")`）。

> **React H5 實作含意**：用 `window.location.href = h5_url` 這類正常導頁即可帶上 Referer。但**不要**用 `<a rel="noreferrer">`、`window.open(..., 'noopener,noreferrer')`，也要注意頁面若設了 `Referrer-Policy: no-referrer` 或 `same-origin` 會讓 Referer 消失而導致支付失敗。若使用 `<meta name="referrer">`，須確保跨站導頁時仍會送出 origin。

### `redirect_url`

- 用途：「若需支付后跳转到指定页面，仅可在参数后拼接"redirect_url"参数来指定回调页面」
- **值必須做 urlencode。** FAQ 針對「签名验证失败」／「系统繁忙，请稍后再试」的答覆包含：「如h5_url有添加redirect_url，请确认参数拼接格式是否有误，是否有对redirect_url的值做urlencode」
- 官方範例格式：

```
https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=wx20161110163838f231619da20804912345&package=1037687096&redirect_url=https%3A%2F%2Fwww.wechatpay.com.cn
```

即：直接在既有 query string 後面 `&redirect_url=` + `encodeURIComponent(你的回跳網址)`。

### ICP 備案

「经营性网站必须办理ICP许可证，事业单位必须办理ICP备案；**ICP备案的主体必须与申请商户号主体一致**」
配置路徑：商戶平台 → 產品中心 → 開發配置 → H5支付；**審核需 3～5 個工作天**。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4013287193>

---

## 7. 前置條件（含關鍵的 APPID 認證問題）

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4015614193>、<https://pay.weixin.qq.com/doc/v3/merchant/4012791832>、<https://pay.weixin.qq.com/doc/v3/merchant/4013070756>**

### 7.1 H5支付是否必須綁定「已認證」的 APPID？—— **是，必須。**

這是本次研究最關鍵的結論，**確認**而非推翻。

產品介紹頁的「准入条件」列出應用類型為：**已認證的服務號、已認證政府/媒體公眾號、已認證小程序、已認證移動應用**。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791832>

開發接入準備頁的關鍵句：

> 「H5支付可以使用以下任意一种公众账号类型来申请权限」——服务号、政府或媒体类型的公众号、小程序、移动应用

> **「未认证的账号无法绑定商户号」**

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4015614193>

**解讀：** H5支付雖然執行時**不需要 openid**（不像 JSAPI 支付），但下單請求的 `appid` 欄位是**必填**，且該 APPID 必須已與 `mchid` 完成授權綁定；而綁定的前提是該帳號**已通過微信認證**（服務號／小程序年審認證費用與主體資格另計）。因此「只有商戶號、沒有已認證公眾帳號」的情況下，H5支付**無法上線**。

主體類型限制：企業、事業單位、政府機關、社會組織——**個人主體不可申請**。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791832>

### 7.2 接入準備完整流程

官方列出的步驟：

1. 閱讀產品介紹文檔
2. 註冊相應類型的公眾帳號並取得 APPID
3. **完成公眾帳號認證**
4. 取得／申請商戶號（mchid）
5. 商戶平台**申請 H5支付產品權限**
6. 發起與 APPID 的**授權綁定申請**
7. 登入公眾平台／開放平台**確認授權綁定**
8. 配置技術負責人帳號並設為安全聯絡人
9. **配置 H5支付域名**
10. 取得開發參數，進入開發流程

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4015614193>

商戶號綁定 APPID 指引：<https://pay.weixin.qq.com/doc/v3/merchant/4016328613>

### 7.3 開發參數清單

**來源：<https://pay.weixin.qq.com/doc/v3/merchant/4013070756>、<https://pay.weixin.qq.com/doc/v3/merchant/4024350132>**

| 參數 | 用途 | 取得方式 | 注意 |
|---|---|---|---|
| `appid` | 下單請求必填 | 公眾平台／開放平台 | 須已與 mchid 綁定 |
| `mchid` | 所有介面呼叫 | 商戶平台 → 帳戶中心 → 商戶資訊 | — |
| **商戶API私鑰** `apiclient_key.pem` | **簽名請求** | 商戶平台申請商戶API證書 | 「只能下载一次」，遺失須重新申請。有效期 5 年，最多同時 3 張 |
| **商戶API證書序列號** | 填入 `Authorization` 的 `serial_no` | 商戶平台或憑證解析工具 | — |
| **APIv3密鑰** | **解密回調通知**、解密平台證書 | 商戶平台設定 | 「32位字母数字组合字符串」；設定後不可讀回，遺失只能重設 |
| **微信支付公鑰** + **微信支付公鑰ID** | **驗簽應答／回調**、加密敏感欄位 | 商戶平台 → 帳戶中心 → API安全 → 申請公鑰 | 官方【推薦】；「无过期时间」「维护更简单」 |
| 微信支付平台證書 | 舊制驗簽 | Java CLI 工具或 `GET /v3/certificates` | 5 年有效，需輪換 |

證書相關文件：
- 申請商戶API證書：<https://pay.weixin.qq.com/doc/v3/merchant/4012072428>
- 設定 APIv3密鑰：<https://pay.weixin.qq.com/doc/v3/merchant/4012072195>
- 平台證書平滑更換：<https://pay.weixin.qq.com/doc/v3/merchant/4012068829>

> H5支付**不需要** `openid`，因此不需要走網頁授權流程——這是相對 JSAPI 支付唯一省下的一環。

---

## 8. 金額單位與冪等處理

### 金額單位

官方原文（H5支付下單 `amount.total` 欄位說明）：

> 「订单总金额，单位为**分**，整型，必须大于0。」

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>

- **¥19.9 → `"total": 1990`**
- 退款介面同樣以分為單位（`amount.refund`、`amount.total`）。來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012810597>
- 單品 `unit_price` 亦為分。

> **實作建議（本文推導，非官方要求）**：全系統以整數「分」為金額型別，只在 UI 顯示時除以 100。禁止在後端出現浮點金額。

### 冪等 / 重入

官方明確要求（原文）：

- 「若因网络或其他原因，商户收到了重复的回调通知，请做好**重入设计**并持续应答200」
  來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791836>
- 「同样的通知可能会多次发送给商户系统，商户系统必须能够正确处理重复的通知。**如果已处理过，直接给微信支付返回成功。**」
  來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>
- 「商户系统收到支付结果通知，需要在**5秒内**返回应答报文」
  來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>

**官方沒有規定用哪個欄位做冪等鍵。** 可用的天然唯一值：通知報文的 `id`（string(36)，本次通知的唯一 ID）、解密後的 `out_trade_no`（商戶側唯一）、`transaction_id`（微信側唯一）。

> **實作建議（本文推導）**：以 `out_trade_no` 作為冪等鍵，在 DB 對訂單狀態轉移加唯一約束或條件更新（`UPDATE ... WHERE out_trade_no = ? AND status = 'PENDING'`），只有影響列數為 1 時才發放權益。回調與查單兩條路徑共用這一段。額外記錄 `id` 可用來偵測重送。

---

## 9. 對本專案技術棧的具體影響

### 9.1 Nginx 反向代理下取得真實 `payer_client_ip`

**官方說法（僅此而已）：**
- 欄位定義：「用户的客户端IP，支持IPv4和IPv6两种格式的IP地址。」來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791834>
- FAQ：「下单参数中payer_client_ip字段必须为客户端IP地址，**不能填127.0.0.1**」。此錯誤會導致用戶端出現「由于商家传入的H5交易参数有误…」。來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791845>

**官方文件未提及反向代理的處理方式。** 以下為本文推導的實作建議，非一手文件內容：

- Express 預設 `req.ip` 在 Nginx 後方會拿到 `127.0.0.1`／上游容器 IP —— **這正是官方明令會導致下單失敗的值**。
- Nginx 需設定 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` 與 `proxy_set_header X-Real-IP $remote_addr;`
- Express 需設定 `app.set('trust proxy', <hop 數或 CIDR>)`，之後 `req.ip` 才會是真實客戶端 IP。**用明確的 hop 數或信任網段，不要用 `true`**（`trust proxy: true` 會信任整條 XFF 鏈，可被偽造）。
- 上線前務必實測一次：把 `payer_client_ip` log 出來確認不是 `127.0.0.1`、`::1` 或 `172.x`。
- IPv6 需一併考慮（欄位長度 45 即為容納 IPv6 而設）；Node 可能回傳 IPv4-mapped 形式 `::ffff:1.2.3.4`，是否需正規化成純 IPv4 **未能從一手文件確認**，保守作法是送出純 IPv4。

### 9.2 `notify_url` 的 HTTPS 要求

已在 3.1 節確認：必須 `https://` 開頭、完整全路徑、公網可達、**不可帶參數**、不可為 localhost／內網 IP。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012075420>

→ 訂單識別**不能**放在 query string（如 `?orderId=xxx`），必須從解密後的 `out_trade_no` 取得，或放在 path segment。

### 9.3 官方 Node.js SDK

**不存在。** 官方 SDK 僅有三種：

| 語言 | SDK | 官方 repo |
|---|---|---|
| Java | wechatpay-java | <https://github.com/wechatpay-apiv3/wechatpay-java> |
| PHP | wechatpay-php | <https://github.com/wechatpay-apiv3/wechatpay-php> |
| Go | wechatpay-go | <https://github.com/wechatpay-apiv3/wechatpay-go> |

來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012076498>；GitHub 組織 <https://github.com/wechatpay-apiv3>

官方 SDK 自動處理的能力：自動簽名與驗簽、敏感資訊加解密、回調資料自動驗簽解密。Java/Go 版另封裝業務介面。
**Node.js 端這些全部要自己寫**，但本文第 2、3 節已涵蓋全部演算法細節，用內建 `crypto` 即可實作，無第三方相依需求。

官方除錯工具：**wechatpay-postman-script** <https://github.com/wechatpay-apiv3/wechatpay-postman-script> —— 建議在寫 Node 程式碼前先用它驗證商戶號、證書、權限是否都正確，可把「憑證問題」和「程式碼問題」分離。

### 9.4 微信內置瀏覽器

如結論摘要所述，**H5支付在微信內置瀏覽器無法使用**，官方建議改用 **JSAPI支付**。
來源：<https://pay.weixin.qq.com/doc/v3/merchant/4012791845>

→ 前端應偵測 `navigator.userAgent` 是否含 `MicroMessenger`，若是則不要走 H5支付流程（否則用戶只會看到「请在微信外打开订单，进行支付」）。
→ **產品決策點**：若微信內流量佔比可觀，需評估額外接 JSAPI支付（<https://pay.weixin.qq.com/doc/v3/merchant/4012062524>），但 JSAPI 需要 `openid`，得多走網頁授權，工程量顯著大於 H5。

---

## 10. 建議的最小實作順序

1. 先用 **wechatpay-postman-script** 打通一筆 `/v3/pay/transactions/h5` 下單，證明憑證與權限無誤。
2. Node 端實作 `Authorization` 簽名（第 2 節），重現同一筆下單。
3. 實作 `notify_url`：Express **raw body** → 驗簽（第 3.3 節）→ AEAD_AES_256_GCM 解密（第 3.4 節）→ 冪等寫入 → **5 秒內**回 `200` 空 body，重活轉非同步。
4. 實作查單 `GET /v3/pay/transactions/out-trade-no/{out_trade_no}?mchid=` 作為回調遺失的補償，並在 `redirect_url` 回跳頁由後端查單確認後才解鎖報告。
5. 最後才接退款。

---

## 未能確認的部分

以下項目**無法從一手官方文件確認**，實作前需另行查證或直接開啟官方頁面確認：

1. ~~**`transaction_id` 查單的確切路徑。**~~ ✅ **2026-07-30 已確認：`GET /v3/pay/transactions/id/{transaction_id}`**

   來源不再是抓取，而是本機官方文件庫（微信支付官方 skill 同步的 4,019 篇）：
   `APIv3/普通商户/支付产品/小程序支付/API列表/微信支付订单号查询订单-4012791899.md` 第 18 行，
   對應 <https://pay.weixin.qq.com/doc/v3/merchant/4012791899>。

   當初三個候選中，正確的是本文列為「慣例寫法」的那一個。

   **但本專案仍應用 `out_trade_no` 查單**，理由現在也有官方依據了 —— `商户订单号查询订单`（<https://pay.weixin.qq.com/doc/v3/merchant/4012791900>）原文：「**若订单未支付，则只能使用商户订单号查询订单**」。未支付的訂單沒有 `transaction_id`，而掉單補查要查的正是未支付的單。

2. **H5支付下單頁面是否有官方的完整「請求示例 / 应答示例」JSON。** 抓取工具因內容長度限制無法逐字取回官方範例區塊。本文第 1 節的最小 request body 是**依官方欄位表組裝**，非逐字複製。欄位名、型別、必填性均可回溯官方表格，但**建議實作時開啟官方頁面比對一次官方範例**。

3. **`redirect_url` 回跳是否代表支付成功。** 官方 H5支付下單頁**未明文警告**「跳轉成功不等於支付成功」，也未明文要求回跳後必須查單。本文第 4 節的「回跳後必須查單」是依據[支付回調和查單實現指引](https://pay.weixin.qq.com/doc/v3/merchant/4012075249)的通用原則所作的**推導建議**，非該頁直接條文。

4. **`notify_url` 是否有 port 限制**（例如是否只能 443）。[回調通知注意事項](https://pay.weixin.qq.com/doc/v3/merchant/4012075420)只要求 `https://` 開頭與公網可達，**未提及 port 限制**。

5. **反向代理下 `payer_client_ip` 的官方建議。** 官方僅說「必须为客户端IP地址，不能填127.0.0.1」，**完全未提及** Nginx／X-Forwarded-For／`trust proxy`。第 9.1 節的作法是本文推導，非官方指引。

6. **IPv4-mapped IPv6（`::ffff:x.x.x.x`）格式是否被 `payer_client_ip` 接受。** 官方只說「支持IPv4和IPv6两种格式」，未說明 mapped 形式。**未能從一手文件確認。**

7. **「支付回調和查單實現指引」是否明文要求驗證金額。** 抓取到的內容只提到商戶自行決定是否更新訂單狀態發貨或退款，**未見**「必須校驗 `amount.total` 與原訂單一致」的明文條款。（此仍是業界標準做法，建議照做，但不能宣稱是官方條文。）

8. **成功應答是否可以／應該回傳 `{"code":"SUCCESS","message":"成功"}`。** 現行官方文件明確寫「无需返回应答报文」，但**未明文禁止**附帶 body。舊版 APIv3 文件的 SUCCESS body 寫法是否仍被接受，**未能從現行一手文件確認**。建議照現行文件回 `200` + 空 body。

9. **`Wechatpay-Signature-Type` 是否為必檢查欄位。** 文件列出此 header 且範例值為 `WECHATPAY2-SHA256-RSA2048`，但**未明文說明**商戶是否必須驗證其值、或未來會有哪些其他值。

10. **平台證書方案的官方停用時程。** [微信支付公鑰](https://pay.weixin.qq.com/doc/v3/merchant/4012153196) 頁提供切換指引並標示公鑰為【推荐】，但**未見**平台證書的明確停用日期或強制遷移期限。

---

## 附錄：本文引用的官方頁面總表

| 主題 | URL |
|---|---|
| H5支付 產品介紹 | <https://pay.weixin.qq.com/doc/v3/merchant/4012791832> |
| H5支付 開發接入準備 | <https://pay.weixin.qq.com/doc/v3/merchant/4015614193> |
| H5支付 開發指引 | <https://pay.weixin.qq.com/doc/v3/merchant/4012791831> |
| H5支付下單 | <https://pay.weixin.qq.com/doc/v3/merchant/4012791834> |
| 支付成功回調通知 | <https://pay.weixin.qq.com/doc/v3/merchant/4012791836> |
| 查詢訂單 API | <https://pay.weixin.qq.com/doc/v3/merchant/4012791838> |
| 關閉訂單 API | <https://pay.weixin.qq.com/doc/v3/merchant/4012791839> |
| H5支付 常見問題 | <https://pay.weixin.qq.com/doc/v3/merchant/4012791845> |
| 配置H5支付域名 | <https://pay.weixin.qq.com/doc/v3/merchant/4013287193> |
| 退款接口 | <https://pay.weixin.qq.com/doc/v3/merchant/4012810597> |
| 查詢退款單 | <https://pay.weixin.qq.com/doc/v3/merchant/4012810601> |
| 退款結果通知 | <https://pay.weixin.qq.com/doc/v3/merchant/4012810605> |
| 支付回調和查單實現指引 | <https://pay.weixin.qq.com/doc/v3/merchant/4012075249> |
| 回調通知注意事項（通用規則） | <https://pay.weixin.qq.com/doc/v3/merchant/4012075420> |
| APIv3 如何簽名和驗簽（總述） | <https://pay.weixin.qq.com/doc/v3/merchant/4012365342> |
| 請求簽名（路徑參數） | <https://pay.weixin.qq.com/doc/v3/merchant/4012365334> |
| 請求簽名（Body 參數） | <https://pay.weixin.qq.com/doc/v3/merchant/4012365336> |
| 請求簽名（Query 參數） | <https://pay.weixin.qq.com/doc/v3/merchant/4012365337> |
| 驗簽（微信支付公鑰版） | <https://pay.weixin.qq.com/doc/v3/merchant/4013053249> |
| 驗簽（平台證書版） | <https://pay.weixin.qq.com/doc/v3/merchant/4013053420> |
| 解密 V3 回調通知和平台證書 | <https://pay.weixin.qq.com/doc/v3/merchant/4012071382> |
| 證書密鑰概覽 | <https://pay.weixin.qq.com/doc/v3/merchant/4024350132> |
| 開發必要參數說明 | <https://pay.weixin.qq.com/doc/v3/merchant/4013070756> |
| 微信支付公鑰 | <https://pay.weixin.qq.com/doc/v3/merchant/4012153196> |
| 從平台證書切換成微信支付公鑰 | <https://pay.weixin.qq.com/doc/v3/merchant/4012154180> |
| 申請商戶API證書 | <https://pay.weixin.qq.com/doc/v3/merchant/4012072428> |
| 配置 APIv3密鑰 | <https://pay.weixin.qq.com/doc/v3/merchant/4012072195> |
| 獲取平台證書 `/v3/certificates` | <https://pay.weixin.qq.com/doc/v3/merchant/4012551764> |
| 平台證書平滑更換 | <https://pay.weixin.qq.com/doc/v3/merchant/4012068829> |
| 商戶號綁定 APPID | <https://pay.weixin.qq.com/doc/v3/merchant/4016328613> |
| SDK & 開發工具 | <https://pay.weixin.qq.com/doc/v3/merchant/4012076498> |
| APIv3 概述 | <https://pay.weixin.qq.com/doc/v3/merchant/4012081606> |
| JSAPI支付 產品介紹（微信內備案方案） | <https://pay.weixin.qq.com/doc/v3/merchant/4012062524> |
| 官方 SDK GitHub 組織 | <https://github.com/wechatpay-apiv3> |
