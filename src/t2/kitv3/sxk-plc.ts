/**
 * SXK-PLC（森心康语言前能力发展量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_语言前能力发展量表_完整版_SXK-PLC.html（sha256 bfd49ace274d…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-PLC",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_语言前能力发展量表_完整版_SXK-PLC.html",
    "sha256": "bfd49ace274dadacbb9e0054b5046f21ec85acc35669accb169f3a175ea26c9e"
  },
  "title": "森心康语言前能力发展量表 · 完整版",
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
          "key": "L1",
          "name": "互动与依附",
          "options": "main",
          "items": [
            {
              "key": "L1.1",
              "text": "被抱起或轻拍会安静下来",
              "month": 0
            },
            {
              "key": "L1.2",
              "text": "喂食时会看着喂他的人",
              "month": 1
            },
            {
              "key": "L1.3",
              "text": "会自发地笑",
              "month": 2
            },
            {
              "key": "L1.4",
              "text": "被逗弄时会用笑或动作回应",
              "month": 3
            },
            {
              "key": "L1.5",
              "text": "对熟悉的人与陌生人反应不同",
              "month": 5
            },
            {
              "key": "L1.6",
              "text": "熟悉的人靠近会表现出高兴",
              "month": 6
            },
            {
              "key": "L1.7",
              "text": "会主动发出声音找人",
              "month": 8
            },
            {
              "key": "L1.8",
              "text": "熟悉的人离开会表现不安",
              "month": 9
            },
            {
              "key": "L1.9",
              "text": "会把头靠向人或主动要抱",
              "month": 12
            },
            {
              "key": "L1.10",
              "text": "遇到困难会看向大人求助",
              "month": 15
            },
            {
              "key": "L1.11",
              "text": "会主动把大人拉进自己的活动里",
              "month": 20
            },
            {
              "key": "L1.12",
              "text": "能与熟悉的人维持一段来回的互动",
              "month": 24
            }
          ]
        },
        {
          "key": "L2",
          "name": "沟通功能与语用",
          "options": "main",
          "items": [
            {
              "key": "L2.1",
              "text": "会用不同的哭声表达不同需要",
              "month": 1
            },
            {
              "key": "L2.2",
              "text": "别人对他说话时会用声音回应",
              "month": 4
            },
            {
              "key": "L2.3",
              "text": "会用声音或动作要求想要的东西",
              "month": 8
            },
            {
              "key": "L2.4",
              "text": "会推开或转头表示拒绝",
              "month": 9
            },
            {
              "key": "L2.5",
              "text": "会用声音或手势跟人打招呼、道别",
              "month": 12
            },
            {
              "key": "L2.6",
              "text": "会把东西拿给人看以分享",
              "month": 14
            },
            {
              "key": "L2.7",
              "text": "会用词或手势要求「还要」",
              "month": 16
            },
            {
              "key": "L2.8",
              "text": "会用说的表达拒绝",
              "month": 20
            },
            {
              "key": "L2.9",
              "text": "会开口提问（这是什么、在哪里）",
              "month": 26
            },
            {
              "key": "L2.10",
              "text": "会在对话里轮流，你一句我一句",
              "month": 30
            },
            {
              "key": "L2.11",
              "text": "会主动开启一个话题",
              "month": 33
            },
            {
              "key": "L2.12",
              "text": "能依对象调整说话方式（对大人与对小小孩不同）",
              "month": 42
            }
          ]
        },
        {
          "key": "L3",
          "name": "手势与肢体沟通",
          "options": "main",
          "items": [
            {
              "key": "L3.1",
              "text": "想要抱抱时会把手举高",
              "month": 8
            },
            {
              "key": "L3.2",
              "text": "会伸手指向想要的方向",
              "month": 9
            },
            {
              "key": "L3.3",
              "text": "会挥手表示再见或你好",
              "month": 11
            },
            {
              "key": "L3.4",
              "text": "会用手指出想要的东西",
              "month": 12
            },
            {
              "key": "L3.5",
              "text": "会用手指分享有趣的事（不是为了要）",
              "month": 14
            },
            {
              "key": "L3.6",
              "text": "会摇头表示不要",
              "month": 14
            },
            {
              "key": "L3.7",
              "text": "会点头表示要",
              "month": 16
            },
            {
              "key": "L3.8",
              "text": "会拉大人的手去拿或去看",
              "month": 16
            },
            {
              "key": "L3.9",
              "text": "会用手势表示「没有了」「都吃完了」",
              "month": 18
            },
            {
              "key": "L3.10",
              "text": "会用动作模仿日常行为（假装讲电话）",
              "month": 20
            },
            {
              "key": "L3.11",
              "text": "会用手势补充说不清楚的话",
              "month": 24
            },
            {
              "key": "L3.12",
              "text": "能用动作把一件事比给别人看",
              "month": 30
            }
          ]
        },
        {
          "key": "L4",
          "name": "游戏与象征",
          "options": "main",
          "items": [
            {
              "key": "L4.1",
              "text": "会注视手上的玩具一段时间",
              "month": 3
            },
            {
              "key": "L4.2",
              "text": "会伸手抓并摇晃玩具",
              "month": 5
            },
            {
              "key": "L4.3",
              "text": "东西掉了会去找",
              "month": 9
            },
            {
              "key": "L4.4",
              "text": "会按照物品的用途玩（拿梳子梳头）",
              "month": 12
            },
            {
              "key": "L4.5",
              "text": "会假装喝水或吃东西",
              "month": 15
            },
            {
              "key": "L4.6",
              "text": "会喂娃娃或帮娃娃盖被子",
              "month": 18
            },
            {
              "key": "L4.7",
              "text": "会把两个动作连起来玩（倒水再喝）",
              "month": 22
            },
            {
              "key": "L4.8",
              "text": "会用一个东西代替另一个（积木当电话）",
              "month": 24
            },
            {
              "key": "L4.9",
              "text": "会扮演角色（当医生、当妈妈）",
              "month": 30
            },
            {
              "key": "L4.10",
              "text": "会和同伴一起玩有情节的假装游戏",
              "month": 36
            },
            {
              "key": "L4.11",
              "text": "会自己编出一段故事情节来玩",
              "month": 40
            },
            {
              "key": "L4.12",
              "text": "能在游戏中和同伴协商角色与规则",
              "month": 42
            }
          ]
        },
        {
          "key": "L5",
          "name": "语言理解",
          "options": "main",
          "items": [
            {
              "key": "L5.1",
              "text": "听到声音会安静下来或有反应",
              "month": 0
            },
            {
              "key": "L5.2",
              "text": "听到熟悉的声音会转头找",
              "month": 3
            },
            {
              "key": "L5.3",
              "text": "叫他的名字会回头",
              "month": 8
            },
            {
              "key": "L5.4",
              "text": "听到「不可以」会停下动作",
              "month": 11
            },
            {
              "key": "L5.5",
              "text": "能听懂并指出常见的物品",
              "month": 13
            },
            {
              "key": "L5.6",
              "text": "能听懂并指出自己的身体部位",
              "month": 16
            },
            {
              "key": "L5.7",
              "text": "能听懂一步的简单指令",
              "month": 18
            },
            {
              "key": "L5.8",
              "text": "能在几样东西里拿对指定的一样",
              "month": 20
            },
            {
              "key": "L5.9",
              "text": "能听懂两步的指令",
              "month": 27
            },
            {
              "key": "L5.10",
              "text": "能听懂「在上面／里面」这类位置词",
              "month": 33
            },
            {
              "key": "L5.11",
              "text": "能回答「谁、哪里、做什么」的问题",
              "month": 36
            },
            {
              "key": "L5.12",
              "text": "能听完一段短故事并回答问题",
              "month": 42
            }
          ]
        },
        {
          "key": "L6",
          "name": "语言表达",
          "options": "main",
          "items": [
            {
              "key": "L6.1",
              "text": "除了哭之外会发出其他声音",
              "month": 1
            },
            {
              "key": "L6.2",
              "text": "会发出「啊、喔」这类元音",
              "month": 3
            },
            {
              "key": "L6.3",
              "text": "会发出带子音的连串声音（ba-ba、da-da）",
              "month": 7
            },
            {
              "key": "L6.4",
              "text": "会模仿听到的声音",
              "month": 9
            },
            {
              "key": "L6.5",
              "text": "会有意义地叫爸爸妈妈",
              "month": 12
            },
            {
              "key": "L6.6",
              "text": "会说出三到五个不同的词",
              "month": 15
            },
            {
              "key": "L6.7",
              "text": "会主动命名看到的东西",
              "month": 18
            },
            {
              "key": "L6.8",
              "text": "会把两个词连起来说（妈妈抱）",
              "month": 22
            },
            {
              "key": "L6.9",
              "text": "会用三到四个词说一句话",
              "month": 30
            },
            {
              "key": "L6.10",
              "text": "会用「我、你」等人称词",
              "month": 33
            },
            {
              "key": "L6.11",
              "text": "能说出刚刚发生的事",
              "month": 36
            },
            {
              "key": "L6.12",
              "text": "说的话大部分外人也听得懂",
              "month": 42
            }
          ]
        },
        {
          "key": "L7",
          "name": "口腔动作与进食",
          "options": "main",
          "items": [
            {
              "key": "L7.1",
              "text": "吸吮有力、喝奶顺畅不常呛到",
              "month": 0
            },
            {
              "key": "L7.2",
              "text": "会把手或玩具放进嘴里探索",
              "month": 4
            },
            {
              "key": "L7.3",
              "text": "能接受汤匙喂食并闭唇把食物刮下",
              "month": 6
            },
            {
              "key": "L7.4",
              "text": "会做出上下咬合的动作",
              "month": 8
            },
            {
              "key": "L7.5",
              "text": "能吃软的块状食物",
              "month": 10
            },
            {
              "key": "L7.6",
              "text": "能用吸管或敞口杯喝水",
              "month": 14
            },
            {
              "key": "L7.7",
              "text": "能做出左右咀嚼的动作",
              "month": 18
            },
            {
              "key": "L7.8",
              "text": "清醒时口水大致能控制住",
              "month": 24
            },
            {
              "key": "L7.9",
              "text": "能吃和家人一样质地的食物",
              "month": 24
            },
            {
              "key": "L7.10",
              "text": "会模仿嘟嘴、吐舌、鼓腮等口部动作",
              "month": 30
            },
            {
              "key": "L7.11",
              "text": "能吹气吹动纸条或泡泡",
              "month": 33
            },
            {
              "key": "L7.12",
              "text": "能依指令做出连续的口部动作",
              "month": 42
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "LANG",
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
        "name": "建议安排语言评估"
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
