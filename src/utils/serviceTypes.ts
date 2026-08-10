/**
 * 四種諮詢服務（issue #21）。
 *
 * 家長可以約的四種：線上諮詢說明（既有的那一種）、線上干預訓練指導、
 * 線下干預訓練、線下諮詢。四種**共用同一張預約表、同一個通知、同一個後台分頁**
 * —— 差別只有這一個欄位。
 *
 * 【為什麼是一個模組而不是四個字串】
 * 這個值決定客服接到電話之後要怎麼接：線上的排連線、線下的排時間與地點。
 * 「這一筆是哪一種」若散在後端、通知、後台與家長端各判斷一次，新增第五種時
 * 一定會漏掉其中一處，而漏掉的樣子是一張沒有標籤的預約單。
 *
 * 【線下的地點不在這裡，也不在任何地方】
 * 據點資訊常變，寫進系統只會多一張要維護的表；既有的預約狀態流轉
 * （new→contacted→scheduled→done）本來就是為「由客服接手安排」設計的。
 * 這個模組只負責說出「這是線下的」，讓通知與畫面都把那句話講清楚。
 */

export type ServiceType =
  | 'online_consult'
  | 'online_training'
  | 'offline_training'
  | 'offline_consult';

/** 線上還是線下。**衍生的事實，不是第五個欄位** —— 只此一處推導。 */
export type ServiceVenue = 'online' | 'offline';

/** 諮詢還是干預訓練。 */
export type ServiceTopic = 'consult' | 'training';

export interface ServiceTypeDescriptor {
  type: ServiceType;
  venue: ServiceVenue;
  topic: ServiceTopic;
  /** 通知、後台與家長端共用的中文名稱。客服照著這幾個字分辨要怎麼接。 */
  label: string;
  /** 家長端卡片上的一句說明。 */
  description: string;
}

/**
 * 順序即畫面上的順序：線上兩種在前，線下兩種在後。
 *
 * 預設的那一種排第一，因為它是絕大多數家長要的東西，也是這個功能之前唯一
 * 存在的那一種。
 */
const DESCRIPTORS: readonly ServiceTypeDescriptor[] = [
  {
    type: 'online_consult',
    venue: 'online',
    topic: 'consult',
    label: '线上咨询说明',
    description: '专家连线为您逐项解读这份报告，说明每个维度的意思与接下来的方向。',
  },
  {
    type: 'online_training',
    venue: 'online',
    topic: 'training',
    label: '线上干预训练指导',
    description: '专家连线带您做一次训练动作，看着孩子的反应即时调整做法。',
  },
  {
    type: 'offline_training',
    venue: 'offline',
    topic: 'training',
    label: '线下干预训练',
    description: '到机构由专家带孩子实际训练。地点与时间由客服电话与您确认。',
  },
  {
    type: 'offline_consult',
    venue: 'offline',
    topic: 'consult',
    label: '线下咨询',
    description: '到机构与专家面对面谈这份报告。地点与时间由客服电话与您确认。',
  },
];

export const SERVICE_TYPES: readonly ServiceType[] = DESCRIPTORS.map(d => d.type);

/**
 * 沒有指定時算哪一種。
 *
 * **必須是既有的那一種。** 這個欄位是本 issue 新增的，既有的家長端建置、
 * 以及資料庫裡遷移之前的每一列，都沒有它 —— 而那些全部都是線上諮詢說明。
 */
export const DEFAULT_SERVICE_TYPE: ServiceType = 'online_consult';

const BY_TYPE = new Map<string, ServiceTypeDescriptor>(DESCRIPTORS.map(d => [d.type, d]));

export function describeServiceType(type: ServiceType): ServiceTypeDescriptor {
  return BY_TYPE.get(type) ?? DESCRIPTORS[0];
}

/**
 * 可顯示的名稱。認不得的值有替代說法 —— 資料庫裡遷移之前的舊列讀出來可能是
 * 空值或別的東西，畫面上一個空白會看起來像壞掉。
 */
export function serviceTypeLabel(type: ServiceType | string | null | undefined): string {
  if (typeof type !== 'string') return '未记录服务类型';
  return BY_TYPE.get(type)?.label ?? '未记录服务类型';
}

/** 服務類型的順序化清單，供畫面直接走訪。 */
export function serviceTypeDescriptors(): readonly ServiceTypeDescriptor[] {
  return DESCRIPTORS;
}

/**
 * 這一筆要不要多說一句「地點由客服安排」。
 *
 * 收 `string` 而不是 `ServiceType`：這個判斷的呼叫端之一是後台，而後台的值
 * 讀自資料庫 —— 遷移之前的舊列讀出來可能是任何東西。
 *
 * **認不得一律回 false。** 方向是刻意的：把一筆線上預約標成線下，客服會去
 * 安排一個沒有人要去的場地；反過來只是少一行提示，而那筆預約的類型欄位
 * 本來就已經顯示成「未记录服务类型」了。
 */
export function isOfflineService(type: string | null | undefined): boolean {
  return typeof type === 'string' && BY_TYPE.get(type)?.venue === 'offline';
}

/**
 * 讀請求 body 裡的服務類型。
 *
 * **缺省與認不得是兩件事，處置刻意相反：**
 *
 * - 缺省（`undefined` / `null` / 空字串）→ 預設的線上諮詢說明。既有的家長端
 *   根本不送這個欄位，這裡若拒絕，專案 B 唯一的轉換點會當場停擺。
 * - 認不得 → `null`，呼叫端一律答 400。悄悄落回預設值的話，一個拼錯的類型
 *   會變成一筆線上諮詢說明，而家長以為自己約的是線下訓練 —— 沒有任何一個
 *   畫面看得出這個落差，直到客服在線上等、家長在機構門口等。
 *
 * 刻意**不** trim、不轉小寫：這個值不是人打的，是畫面上四顆按鈕之一送出來的。
 * 帶著空白或大小寫不同的值代表送它的東西已經不是那四顆按鈕，那時候該停下來。
 */
export function readServiceType(raw: unknown): ServiceType | null {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_SERVICE_TYPE;
  if (typeof raw !== 'string') return null;
  return BY_TYPE.has(raw) ? (raw as ServiceType) : null;
}
