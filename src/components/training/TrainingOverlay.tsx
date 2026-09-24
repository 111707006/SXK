/**
 * 蓋在報告上的那幾層（樣品 `main.tsx` 的頁面堆疊＋抽屜）。
 *
 * 【怎麼疊】
 * 每一層照堆疊的順序畫：頁面是整片不透明的一層，抽屜蓋在它上面。最上面那一頁以下的頁面**留在畫面上
 * 但看不見**（`invisible`＋`inert`）：關掉詳情回到計劃頁時，計劃頁還停在剛才捲到的位置——整頁重畫
 * 會跳回頁首，而計劃頁很長。
 *
 * 【放在哪】
 * `createPortal` 到 `document.body`、`position: fixed`：報告頁外層有動畫容器，`fixed` 的東西放在裡面
 * 會改成相對那個容器定位（`index.css` 的 `.animate-fade-in` 註解記過一次）。寬度上限與報告頁相同
 *（`max-w-3xl`），手機上滿版、桌機置中，兩側暗下來。
 *
 * 【還沒做的頁】（票 7、8）
 * 詳情先是簡單版（`SimpleDetailScreen`）；示範片庫、打卡日曆落在「即将开放」。票 7／8 在這裡把
 * `detail`／`library`／`calendar` 換成真的頁，並在 `SheetContent` 接上新的抽屜。
 */
import { createPortal } from 'react-dom';
import type { Layer, Route, SheetState } from './layerStack';
import ComingSoonScreen from './ComingSoonScreen';
import ExpertSheet from './ExpertSheet';
import PlanScreen from './PlanScreen';
import SimpleDetailScreen from './SimpleDetailScreen';

function PageContent({ route }: { route: Route }) {
  switch (route.name) {
    case 'plan':
      return <PlanScreen />;
    case 'detail':
      return <SimpleDetailScreen id={route.id} from={route.from} />;
    case 'library':
    case 'calendar':
      return <ComingSoonScreen />;
    default:
      // 歷史上留著一格舊版本認得、這一版不認得的頁（部署之後按前進鍵）：不畫空白，給一句話與返回
      return <ComingSoonScreen />;
  }
}

function SheetContent({ sheet }: { sheet: SheetState }) {
  switch (sheet.kind) {
    case 'expert':
      return <ExpertSheet />;
    default:
      return null;
  }
}

function layerKey(layer: Layer, index: number): string {
  if (layer.type === 'sheet') return `${index}-sheet-${layer.sheet.kind}`;
  const route = layer.route;
  return `${index}-${route.name}-${route.name === 'detail' ? route.id : ''}`;
}

export default function TrainingOverlay({ layers }: { layers: Layer[] }) {
  if (layers.length === 0 || typeof document === 'undefined') return null;

  let topPage = -1;
  layers.forEach((l, i) => {
    if (l.type === 'page') topPage = i;
  });

  return createPortal(
    <div className="fixed inset-0 z-[80] flex justify-center" data-testid="training-overlay">
      {topPage >= 0 && <div className="absolute inset-0 bg-black/40 training-fade" aria-hidden="true" />}
      <div className="relative w-full max-w-3xl h-full overflow-hidden">
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
              <PageContent route={layer.route} />
            </div>
          );
        })}
      </div>
    </div>,
    document.body,
  );
}
