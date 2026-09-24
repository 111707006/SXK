/**
 * 家庭訓練那幾層共用的東西：資料（`useTrainingData`）、導覽（`useLayerStack`）、報告快照、
 * 以及報告頁交下來的兩個出口（預約、重新評估）。`TrainingSection` 提供，各頁 `useTraining()` 取。
 */
import { createContext, useContext } from 'react';
import type { ServiceType } from '../../utils/serviceTypes';
import type { T2Findings } from '../../t2/types';
import type { LayerNav } from './layerStack';
import type { TrainingData } from './useTrainingData';

export interface TrainingContextValue {
  data: TrainingData;
  nav: LayerNav;
  /** 報告快照（`T2Report.tsx` 手上那一份）：評估結果的儀表與各維度的卡。 */
  findings: T2Findings;
  childName?: string;
  /** 開預約表、預選那一種服務（既有的出口；App 會換頁，這幾層隨之卸載）。 */
  onBookService: (type: ServiceType) => void;
  /** 「重新评估」→ T2 入口。沒給就不出那顆按鈕。 */
  onReassess?: () => void;
}

const TrainingContext = createContext<TrainingContextValue | null>(null);

export const TrainingProvider = TrainingContext.Provider;

export function useTraining(): TrainingContextValue {
  const value = useContext(TrainingContext);
  if (!value) throw new Error('useTraining() must be called inside <TrainingSection>');
  return value;
}
