# 首页两张人物照：生成提示词

规格 `docs/specs/client-changes-2026-10-17.md` §5.2、D17：生成前先给使用者看提示词。
构图照客户 10/17 pptx 首页示意图；画面里**不放任何文字、logo、品牌**（卡上的标题由网页画）。
可灵帐号 2026-10-18 查过是 0 点数，按 D17 改用 OpenAI 图片 API（`gpt-image-1`，品质 high）。

## 1. 线上家庭干预练习（首页大卡，3:2）

> Photorealistic lifestyle photo, warm and candid. A Chinese multi-generational family sitting close together on a light beige sofa in a bright, tidy living room: grandfather with gray hair and glasses, grandmother, mother and father in their thirties, a boy about 4 and a girl about 3 sitting on the grandparents' laps. Everyone is laughing naturally and looking at the children, who are playing a simple hand-clapping game. Soft afternoon window light from the left, sheer curtains, neutral beige, cream and soft sage-green tones. Natural skin texture, relaxed everyday clothing (knit cardigans, linen shirts). Eye-level, medium-wide shot, shallow depth of field. No text, no logos, no watermark.

## 2. T1 综合评估（首页小卡，16:9）

> Photorealistic photo in a bright, friendly pediatric consultation room. A kind Chinese pediatrician in his forties, white coat and stethoscope, sitting at a low table and smiling at a 3-year-old child who is stacking colorful wooden blocks. The child's mother and father stand slightly behind, the mother's hand on the child's shoulder, both looking on warmly. Soft pastel walls with a few simple house-shaped shelves and a potted plant, clean natural daylight, cream and light blue tones. Calm, reassuring mood, nothing clinical or scary. Medium shot, eye-level. No text, no logos, no watermark.

## 交付

每张各出 1 张 → 裁到卡的比例、压成 WebP＋JPG（各 ≤300 KB）→ `public/home/home-training.*`、`public/home/home-t1.*`，
接到 `src/home/HomePage.tsx` 的 `CARD_ART`（同医院照的 `photo` 写法）。

确认纪录：使用者 2026-10-18 对话中回「The prompts are fine. Generate the two photos with OpenAI and wire them into the homepage.」
同日以 `gpt-image-1`、1536×1024、品质 high 各出一张，没有重抽；大卡缩成 1200×800，小卡裁成 16:9（960×540）。
