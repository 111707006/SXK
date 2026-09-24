/**
 * 報告第六段「线上干预」（Keep 規格 K11、K12）：取代票 #60 的 `T2WeeklyPlan`。
 *
 * `T2Report.tsx` 只掛這一個元件。它持有三樣東西，交給底下每一頁：
 * - 資料（`useTrainingData`）：每週活動與打卡，一份。
 * - 頁面堆疊（`useLayerStack`）：推一層＝推一格歷史，返回鍵關最上面那一層。
 * - 報告快照、孩子名字、預約與重新評估兩個出口。
 *
 * 畫在報告裡的是入口（`ReportEntry`）；計劃頁、詳情、抽屜蓋在報告上（`TrainingOverlay`）。
 *
 * 【給票 7、8】
 * 新頁：在 `layerStack.ts` 的 `Route` 加（或用已列好的 detail／library／calendar），在
 * `TrainingOverlay.tsx` 的 `PageContent` 換成真的頁。新抽屜：`SheetState` 加一種 `kind`、在
 * `SheetContent` 接上，畫面用 `ui.tsx` 的 `Sheet`、關掉用 `nav.back()`。打卡之後呼叫
 * `data.reloadCheckins()`，入口與計劃頁的次數、x/4 跟著變。新畫面的字加在 `src/t2/trainingCopy.ts`。
 */
import './training.css';
import { useMemo } from 'react';
import type { ServiceType } from '../../utils/serviceTypes';
import type { T2Findings } from '../../t2/types';
import { useLayerStack } from './layerStack';
import ReportEntry from './ReportEntry';
import { TrainingProvider, type TrainingContextValue } from './TrainingContext';
import TrainingOverlay from './TrainingOverlay';
import { useTrainingData } from './useTrainingData';

export interface TrainingSectionProps {
  findings: T2Findings;
  childName?: string;
  onBookService: (type: ServiceType) => void;
  onReassess?: () => void;
}

export default function TrainingSection({ findings, childName, onBookService, onReassess }: TrainingSectionProps) {
  const data = useTrainingData();
  const stack = useLayerStack();
  const { layers, openPage, openSheet, replacePage, back, popTo } = stack;

  const value = useMemo<TrainingContextValue>(
    () => ({
      data,
      nav: { openPage, openSheet, replacePage, back, popTo },
      findings,
      childName,
      onBookService,
      onReassess,
    }),
    [data, openPage, openSheet, replacePage, back, popTo, findings, childName, onBookService, onReassess],
  );

  return (
    <TrainingProvider value={value}>
      <ReportEntry />
      <TrainingOverlay layers={layers} />
    </TrainingProvider>
  );
}
