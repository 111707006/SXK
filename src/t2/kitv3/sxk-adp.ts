/**
 * SXK-ADP（森心康适应能力发展量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_适应能力发展量表_完整版_SXK-ADP.html（sha256 53a5b0ab4430…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-ADP",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_适应能力发展量表_完整版_SXK-ADP.html",
    "sha256": "53a5b0ab44305618442f2f4d1756ab18a878e0bcc3ef3ed91f1f7e0db17a3cc2"
  },
  "title": "森心康适应能力发展量表 · 完整版",
  "family": "pct",
  "options": {
    "main": [
      {
        "value": 2,
        "label": "已经会",
        "hint": "稳定做得到"
      },
      {
        "value": 1,
        "label": "偶尔会",
        "hint": "有时可以、还不稳定"
      },
      {
        "value": 0,
        "label": "还不会",
        "hint": "尚未出现"
      }
    ]
  },
  "forms": [
    {
      "key": "p",
      "name": "家长报告版",
      "sections": [
        {
          "key": "A1",
          "name": "视觉注意与追踪",
          "options": "main",
          "items": [
            {
              "key": "A1.1",
              "text": "对突然的光线或移动有反应",
              "month": 0
            },
            {
              "key": "A1.2",
              "text": "会注视人的脸",
              "month": 1
            },
            {
              "key": "A1.3",
              "text": "眼睛能盯着移动的东西看",
              "month": 1
            },
            {
              "key": "A1.4",
              "text": "眼睛能跟着东西过中线",
              "month": 2
            },
            {
              "key": "A1.5",
              "text": "会寻找声音的来源",
              "month": 3
            },
            {
              "key": "A1.6",
              "text": "看到东西会伸手去碰",
              "month": 4
            },
            {
              "key": "A1.7",
              "text": "能同时注意两样东西",
              "month": 6
            },
            {
              "key": "A1.8",
              "text": "会注视掉落的东西",
              "month": 8
            },
            {
              "key": "A1.9",
              "text": "能注意到桌上很小的东西",
              "month": 9
            },
            {
              "key": "A1.10",
              "text": "能在杂乱中找到指定的物品",
              "month": 24
            },
            {
              "key": "A1.11",
              "text": "能看出两张图片的细节差异",
              "month": 42
            },
            {
              "key": "A1.12",
              "text": "能持续注视同一个活动五分钟以上",
              "month": 48
            }
          ]
        },
        {
          "key": "A2",
          "name": "物体操作与手眼协调",
          "options": "main",
          "items": [
            {
              "key": "A2.1",
              "text": "能短暂抓住放进手心的小物",
              "month": 2
            },
            {
              "key": "A2.2",
              "text": "会主动伸手抓玩具",
              "month": 5
            },
            {
              "key": "A2.3",
              "text": "会把东西从一手换到另一手",
              "month": 7
            },
            {
              "key": "A2.4",
              "text": "会用拇指食指捏起小东西",
              "month": 10
            },
            {
              "key": "A2.5",
              "text": "会把东西放进容器里",
              "month": 10
            },
            {
              "key": "A2.6",
              "text": "能叠起两三块积木",
              "month": 15
            },
            {
              "key": "A2.7",
              "text": "会翻书页",
              "month": 15
            },
            {
              "key": "A2.8",
              "text": "能叠六块以上积木",
              "month": 30
            },
            {
              "key": "A2.9",
              "text": "会把珠子串起来",
              "month": 30
            },
            {
              "key": "A2.10",
              "text": "会用剪刀沿线剪",
              "month": 42
            },
            {
              "key": "A2.11",
              "text": "能照着画出圆形或方形",
              "month": 42
            },
            {
              "key": "A2.12",
              "text": "能把小物件分类放进不同格子里",
              "month": 48
            }
          ]
        },
        {
          "key": "A3",
          "name": "问题解决与因果",
          "options": "main",
          "items": [
            {
              "key": "A3.1",
              "text": "会重复做出有结果的动作（按了会响就一直按）",
              "month": 6
            },
            {
              "key": "A3.2",
              "text": "东西被藏起来会去找",
              "month": 9
            },
            {
              "key": "A3.3",
              "text": "会把盖子打开找里面的东西",
              "month": 10
            },
            {
              "key": "A3.4",
              "text": "会拉绳子把玩具拉过来",
              "month": 12
            },
            {
              "key": "A3.5",
              "text": "会用工具拿到构不到的东西",
              "month": 15
            },
            {
              "key": "A3.6",
              "text": "会绕过障碍去拿东西",
              "month": 18
            },
            {
              "key": "A3.7",
              "text": "会拼简单拼图（三片）",
              "month": 24
            },
            {
              "key": "A3.8",
              "text": "会照顺序做完两件事",
              "month": 30
            },
            {
              "key": "A3.9",
              "text": "遇到困难会尝试别的方法",
              "month": 36
            },
            {
              "key": "A3.10",
              "text": "会拼六片以上的拼图",
              "month": 42
            },
            {
              "key": "A3.11",
              "text": "能说出简单的解决办法",
              "month": 54
            },
            {
              "key": "A3.12",
              "text": "会先想一下再动手",
              "month": 60
            }
          ]
        },
        {
          "key": "A4",
          "name": "概念理解",
          "options": "main",
          "items": [
            {
              "key": "A4.1",
              "text": "会配对相同的东西",
              "month": 15
            },
            {
              "key": "A4.2",
              "text": "知道常见物品的用途",
              "month": 18
            },
            {
              "key": "A4.3",
              "text": "懂得「大／小」",
              "month": 24
            },
            {
              "key": "A4.4",
              "text": "会依颜色或形状分类",
              "month": 30
            },
            {
              "key": "A4.5",
              "text": "懂得「多／少」",
              "month": 30
            },
            {
              "key": "A4.6",
              "text": "认得基本颜色",
              "month": 42
            },
            {
              "key": "A4.7",
              "text": "会数到十",
              "month": 42
            },
            {
              "key": "A4.8",
              "text": "懂「上面／下面」「前面／后面」",
              "month": 42
            },
            {
              "key": "A4.9",
              "text": "会按大小排出顺序",
              "month": 48
            },
            {
              "key": "A4.10",
              "text": "懂得「一样／不一样」",
              "month": 48
            },
            {
              "key": "A4.11",
              "text": "能说出物品的类别（水果、动物）",
              "month": 54
            },
            {
              "key": "A4.12",
              "text": "懂得简单的时间概念（今天、明天）",
              "month": 60
            }
          ]
        },
        {
          "key": "A5",
          "name": "记忆与学习",
          "options": "main",
          "items": [
            {
              "key": "A5.1",
              "text": "认得熟悉的人与东西",
              "month": 6
            },
            {
              "key": "A5.2",
              "text": "记得东西放在哪里",
              "month": 12
            },
            {
              "key": "A5.3",
              "text": "会模仿几天前看过的动作",
              "month": 18
            },
            {
              "key": "A5.4",
              "text": "记得交代的一件事",
              "month": 30
            },
            {
              "key": "A5.5",
              "text": "能记住并完成交代的事",
              "month": 36
            },
            {
              "key": "A5.6",
              "text": "学过的东西隔一天还记得",
              "month": 36
            },
            {
              "key": "A5.7",
              "text": "会记住游戏或活动的规则",
              "month": 42
            },
            {
              "key": "A5.8",
              "text": "能复述刚刚听过的三个词",
              "month": 48
            },
            {
              "key": "A5.9",
              "text": "记得上星期发生的事",
              "month": 54
            },
            {
              "key": "A5.10",
              "text": "会用自己的方法记住事情",
              "month": 54
            },
            {
              "key": "A5.11",
              "text": "能记住并照做三个步骤",
              "month": 60
            },
            {
              "key": "A5.12",
              "text": "记得每天的作息顺序并自己衔接",
              "month": 60
            }
          ]
        },
        {
          "key": "A6",
          "name": "生活应用与自理衔接",
          "options": "main",
          "items": [
            {
              "key": "A6.1",
              "text": "会用哭以外的方式表达需要",
              "month": 9
            },
            {
              "key": "A6.2",
              "text": "会模仿日常动作（拍手、再见）",
              "month": 12
            },
            {
              "key": "A6.3",
              "text": "会假装玩（喂娃娃、开玩具车）",
              "month": 18
            },
            {
              "key": "A6.4",
              "text": "会照生活流程行动（洗手、吃饭）",
              "month": 30
            },
            {
              "key": "A6.5",
              "text": "知道危险的东西不能碰",
              "month": 30
            },
            {
              "key": "A6.6",
              "text": "会把玩具收回原位",
              "month": 36
            },
            {
              "key": "A6.7",
              "text": "能说出自己家的信息（姓名、家人）",
              "month": 42
            },
            {
              "key": "A6.8",
              "text": "在团体里能跟着流程走",
              "month": 48
            },
            {
              "key": "A6.9",
              "text": "会等待轮到自己",
              "month": 48
            },
            {
              "key": "A6.10",
              "text": "会看情况添减衣服",
              "month": 54
            },
            {
              "key": "A6.11",
              "text": "出门前会自己检查要带的东西",
              "month": 60
            },
            {
              "key": "A6.12",
              "text": "能照图示或步骤卡完成一件事",
              "month": 60
            }
          ]
        },
        {
          "key": "A7",
          "name": "前学业准备",
          "options": "main",
          "items": [
            {
              "key": "A7.1",
              "text": "认得自己的名字",
              "month": 48
            },
            {
              "key": "A7.2",
              "text": "能分辨相似的图形",
              "month": 48
            },
            {
              "key": "A7.3",
              "text": "会依规则排出图案顺序",
              "month": 54
            },
            {
              "key": "A7.4",
              "text": "懂得数与量的对应（数到五就拿五个）",
              "month": 54
            },
            {
              "key": "A7.5",
              "text": "认得几个常见的字或符号",
              "month": 60
            },
            {
              "key": "A7.6",
              "text": "会从一数到二十",
              "month": 60
            },
            {
              "key": "A7.7",
              "text": "能比较两组东西哪一组多",
              "month": 60
            },
            {
              "key": "A7.8",
              "text": "握笔姿势大致正确",
              "month": 60
            },
            {
              "key": "A7.9",
              "text": "会写自己的名字",
              "month": 66
            },
            {
              "key": "A7.10",
              "text": "能听完一段故事并回答问题",
              "month": 66
            },
            {
              "key": "A7.11",
              "text": "懂得简单的加减（合起来、拿掉）",
              "month": 72
            },
            {
              "key": "A7.12",
              "text": "能坐着完成一份十五分钟的桌面活动",
              "month": 72
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "COG",
    "levels": [
      {
        "min": 85,
        "name": "发展中符合预期"
      },
      {
        "min": 70,
        "name": "部分项目待加强"
      },
      {
        "min": 55,
        "name": "建议安排发展评估"
      },
      {
        "min": 0,
        "name": "建议尽快安排完整评估"
      }
    ],
    "minItems": 3,
    "sectionMaxMonth": {}
  }
};
