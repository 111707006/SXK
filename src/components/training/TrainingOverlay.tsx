/**
 * 蓋在報告上的那幾層（樣品 `main.tsx` 的頁面堆疊＋抽屜）。
 *
 * 【怎麼疊】
 * 每一層照堆疊的順序畫：頁面是整片不透明的一層，抽屜蓋在它上面。最上面那一頁以下的頁面**留在畫面上
 * 但看不見**（`invisible`＋`inert`）：關掉詳情回到計劃頁時，計劃頁還停在剛才捲到的位置——整頁重畫
 * 會跳回頁首，而計劃頁很長。詳情知道自己是不是最上面那一頁（`active`）：被播放器蓋住時，大圖的
 * 示範片停下來，不在背後播。
 *
 * 【放在哪】
 * `createPortal` 到 `document.body`、`position: fixed`：報告頁外層有動畫容器，`fixed` 的東西放在裡面
 * 會改成相對那個容器定位（`index.css` 的 `.animate-fade-in` 註解記過一次）。寬度上限與報告頁相同
 *（`max-w-3xl`），手機上滿版、桌機置中，兩側暗下來。
 *
 * 【頁】計劃（票 6）、詳情／播放器／打卡成功（票 7）、示範片庫與打卡日曆（票 8）；認不得的頁落在「即将开放」。
 */
import { createPortal } from 'react-dom';
import type { Layer, Route, SheetState } from './layerStack';
import CalendarScreen from './CalendarScreen';
import CheckinScreen from './CheckinScreen';
import ComingSoonScreen from './ComingSoonScreen';
import DetailScreen from './DetailScreen';
import { ActionsSheet, CastSheet, EquipSheet, ModeSheet } from './DetailSheets';
import ExpertSheet from './ExpertSheet';
import LibraryScreen from './LibraryScreen';
import PlanScreen from './PlanScreen';
import PlayerScreen from './PlayerScreen';
import ReminderSheet from './ReminderSheet';
import { useDesktopLayout } from '../../desktop/useDesktopLayout';

function PageContent({ route, active }: { route: Route; active: boolean }) {
  switch (route.name) {
    case 'plan':
      return <PlanScreen />;
    case 'detail':
      return <DetailScreen id={route.id} from={route.from} active={active} />;
    case 'go':
      return <PlayerScreen id={route.id} from={route.from} mode={route.mode} />;
    case 'checkin':
      return <CheckinScreen id={route.id} checkinId={route.checkinId} times={route.times} date={route.date} />;
    case 'library':
      return <LibraryScreen />;
    case 'calendar':
      return <CalendarScreen />;
    default:
      // 歷史上留著一格舊版本認得、這一版不認得的頁（部署之後按前進鍵）：不畫空白，給一句話與返回
      return <ComingSoonScreen />;
  }
}

function SheetContent({ sheet }: { sheet: SheetState }) {
  switch (sheet.kind) {
    case 'expert':
      return <ExpertSheet />;
    case 'actions':
      return <ActionsSheet id={sheet.id} from={sheet.from} />;
    case 'equip':
      return <EquipSheet id={sheet.id} />;
    case 'mode':
      return <ModeSheet id={sheet.id} />;
    case 'cast':
      return <CastSheet hasVideo={sheet.hasVideo} />;
    case 'calendar':
      return <ReminderSheet />;
    default:
      return null;
  }
}

function layerKey(layer: Layer, index: number): string {
  if (layer.type === 'sheet') return `${index}-sheet-${layer.sheet.kind}`;
  const route = layer.route;
  switch (route.name) {
    case 'detail':
    case 'go':
      return `${index}-${route.name}-${route.id}`;
    case 'checkin':
      return `${index}-checkin-${route.checkinId}`;
    default:
      return `${index}-${route.name}`;
  }
}

export default function TrainingOverlay({ layers }: { layers: Layer[] }) {
  // 電腦版（VITE_DESKTOP_LAYOUT）：面板放寬到內容區那麼寬、上下留邊、圓角；各頁自己分兩欄。
  const desk = useDesktopLayout();
  if (layers.length === 0 || typeof document === 'undefined') return null;

  let topPage = -1;
  layers.forEach((l, i) => {
    if (l.type === 'page') topPage = i;
  });
  // 電腦版：跟練（播放器）與打卡成功是一步一步的流程，面板維持窄的置中；其他頁用寬面板、分兩欄。
  const top = topPage >= 0 ? layers[topPage] : null;
  const focused = top?.type === 'page' && (top.route.name === 'go' || top.route.name === 'checkin');

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-center" data-testid="training-overlay">
      {topPage >= 0 && <div className="absolute inset-0 bg-black/40 training-fade" aria-hidden="true" />}
      <div className={desk ? `relative my-6 w-full ${focused ? 'max-w-3xl' : 'max-w-6xl'} h-[calc(100%-48px)] overflow-hidden rounded-[32px] shadow-2xl` : 'relative w-full max-w-3xl h-full overflow-hidden'}>
        {layers.map((layer, i) => {
          if (layer.type === 'sheet') {
            return (
              <div key={layerKey(layer, i)} className="absolute inset-0 z-10">
                <SheetContent sheet={layer.sheet} />
              </div>
            );
          }
          const hidden = i < topPage;
          return (
            <div
              key={layerKey(layer, i)}
              className={`absolute inset-0 bg-white training-push ${hidden ? 'invisible' : ''}`}
              aria-hidden={hidden || undefined}
              inert={hidden || undefined}
            >
              <PageContent route={layer.route} active={!hidden} />
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
