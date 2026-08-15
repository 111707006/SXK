/**
 * 干預包在家長端的**取得**與**說法**（issue #26）。
 *
 * 配對邏輯本身在 `interventionMatch.ts`（純函式，伺服器與測試共用）；這裡只負責
 * 兩件在瀏覽器才存在的事：向後端要那一格，以及每一種「拿不到」在畫面上該說什麼。
 *
 * 作法沿用 `utils/specialists.ts`：**空的內容配一個明確的原因碼**。空陣列本身
 * 說不出話，而幾種空法對家長是完全不同的事 —— 「這一格還在準備」要導向專家，
 * 「這個維度沒被標記」是好消息，「暫時讀不到」是請他等一下再看。
 *
 * **任何一種原因都不會退回別的格子。** 這個模組裡沒有備援內容可以退，是刻意的。
 */
import { useEffect, useState } from 'react';
import { authFetch } from './api';
import type { InterventionPack, MaterialCell } from './interventionMatch';

/**
 * 拿不到素材時的原因。前四種由後端 `/api/intervention-pack` 給，
 * 後兩種是前端自己的狀態。
 */
export type InterventionStatus =
  /** 這一格有啟用中的素材 */
  | 'ok'
  /** 這一格還沒有可用素材（沒建立，或建了又停用）—— 對家長是同一件事 */
  | 'preparing'
  /** 這個維度沒被標記，本來就不需要干預 */
  | 'not_flagged'
  /** 維度、月齡或嚴重度認不得 —— 資料壞掉，不是內容還沒到 */
  | 'out_of_scope'
  /** 這個部署沒有資料庫（展示站），或讀取失敗 */
  | 'unavailable'
  /** 還在讀 */
  | 'loading';

export interface InterventionState {
  status: InterventionStatus;
  /** 對應的格子。`out_of_scope` 與部分失敗情形下為 `null`。 */
  cell: MaterialCell | null;
  /** 只有 `status === 'ok'` 時有內容。 */
  pack: InterventionPack | null;
}

const EMPTY: InterventionState = { status: 'loading', cell: null, pack: null };

function readStatus(raw: unknown): InterventionStatus {
  return raw === 'ok' || raw === 'preparing' || raw === 'not_flagged' || raw === 'out_of_scope'
    ? raw
    : 'unavailable';
}

/**
 * 取這個孩子在這個維度的干預包。
 *
 * @param dimensionId 哪一個維度。`null` 代表還不知道要問哪一個，整個請求不發。
 * @param ageMonth 孩子的**實足月齡**（今天幾個月大），不是測評月齡 ——
 *   訓練的難度要配得上他今天做得到什麼。理由見 `resolveInterventionCell`。
 * @param severity 這個維度的判定；`null` 代表沒有讀得懂的成績，此時不發請求。
 */
export function useInterventionPack(
  dimensionId: string | null,
  ageMonth: number | null,
  severity: string | null
): InterventionState {
  const [state, setState] = useState<InterventionState>(EMPTY);

  useEffect(() => {
    // 三個值缺一個就問不出一格來。這與「問了但那一格是空的」是兩件事：
    // 前者是這份報告上沒有足以判斷的資料，後者才是「準備中」。
    if (!dimensionId || ageMonth === null || !severity) {
      setState({ status: 'out_of_scope', cell: null, pack: null });
      return;
    }

    let cancelled = false;
    setState(EMPTY);

    (async () => {
      try {
        const qs = new URLSearchParams({ dimensionId, ageMonth: String(ageMonth), severity });
        const resp = await authFetch(`/api/intervention-pack?${qs}`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (cancelled) return;

        const status = readStatus(data?.status);
        setState({
          status,
          cell: data?.cell ?? null,
          // 只有真的說 ok 才顯示內容。回應形狀不對時當成讀不到 ——
          // 半份步驟比沒有步驟更糟，家長會照著做完他手上的那幾步。
          pack: status === 'ok' && data?.pack?.steps?.length ? data.pack : null,
        });
      } catch (err) {
        if (cancelled) return;
        console.warn('[Intervention] 干预素材读取失败', err);
        setState({ status: 'unavailable', cell: null, pack: null });
      }
    })();

    return () => { cancelled = true; };
  }, [dimensionId, ageMonth, severity]);

  // 說 ok 卻沒有內容時，對家長就是拿不到 —— 讓這條路只有一個出口。
  return state.status === 'ok' && !state.pack
    ? { ...state, status: 'unavailable' }
    : state;
}

export interface InterventionMessage {
  title: string;
  body: string;
  /** 這一種原因要不要給「聯繫專家」那顆按鈕。 */
  offerExpert: boolean;
}

/**
 * 拿不到素材時，那一塊要說什麼。**每一種原因都說得不一樣。**
 *
 * 「準備中」刻意不假裝成別的東西：素材還沒到位就說還沒到位，並把家長導向專家 ——
 * 端一份鄰近年齡段或通用的訓練給他，看起來體貼，實際上是給一個孩子做不到的
 * 任務，而家長會以為孩子又失敗了一次。
 */
export function interventionMessage(status: InterventionStatus, cell: MaterialCell | null): InterventionMessage {
  const where = cell ? `${cell.dimensionName}・${cell.ageBandName}` : '该维度';
  switch (status) {
    case 'preparing':
      return {
        title: '这一组训练内容正在准备中',
        body: `${where}的家庭训练步骤尚未上线。我们不提供其他年龄段或通用的训练内容——发育训练的年龄差很关键，做不到的任务只会让孩子和您都受挫。在内容上线前，建议由专家为您做一对一指导。`,
        offerExpert: true,
      };
    case 'not_flagged':
      return {
        title: '这个维度目前不需要专项训练',
        body: '本维度的评估结果没有被标记，暂时不需要额外的家庭训练。报告中的日常建议照常适用。',
        offerExpert: false,
      };
    case 'loading':
      return { title: '正在读取家庭训练步骤…', body: '', offerExpert: false };
    case 'out_of_scope':
      return {
        title: '暂时无法为这份报告匹配训练内容',
        body: '这份报告缺少匹配训练内容所需的信息（孩子的月龄或该维度的评估结论）。请确认儿童档案中的出生日期已填写，或联系专家为您一对一说明。',
        offerExpert: true,
      };
    case 'unavailable':
    default:
      return {
        title: '训练内容暂时读取不到',
        body: '请稍后重新载入页面。若持续读取不到，可直接联系专家为您一对一说明。',
        offerExpert: true,
      };
  }
}
