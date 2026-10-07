/**
 * SXK-SOC（森心康社会能力发展量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_社会能力发展量表_完整版_SXK-SOC.html（sha256 4562e4af867b…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-SOC",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_社会能力发展量表_完整版_SXK-SOC.html",
    "sha256": "4562e4af867b1cf12b2b689deff203704ef602606d6bbdfbe6a4ae9152a42249"
  },
  "title": "森心康社会能力发展量表 · 完整版",
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
          "key": "S1",
          "name": "人际注意与眼神",
          "options": "main",
          "items": [
            {
              "key": "S1.1",
              "text": "会注视靠近的人的脸",
              "month": 0
            },
            {
              "key": "S1.2",
              "text": "眼睛会跟着走动的人转",
              "month": 1
            },
            {
              "key": "S1.3",
              "text": "被抱起来时会看着抱他的人",
              "month": 2
            },
            {
              "key": "S1.4",
              "text": "听到熟悉的人说话会转头找",
              "month": 3
            },
            {
              "key": "S1.5",
              "text": "会分辨熟人与陌生人，反应不同",
              "month": 6
            },
            {
              "key": "S1.6",
              "text": "叫他的名字会回头看",
              "month": 9
            },
            {
              "key": "S1.7",
              "text": "会看大人的脸来决定要不要做（察言观色）",
              "month": 12
            },
            {
              "key": "S1.8",
              "text": "在一群人中能认出并走向熟悉的人",
              "month": 18
            },
            {
              "key": "S1.9",
              "text": "跟人说话时会看着对方",
              "month": 24
            },
            {
              "key": "S1.10",
              "text": "能与人维持一段时间的眼神交流",
              "month": 30
            },
            {
              "key": "S1.11",
              "text": "会注意到别人加入或离开",
              "month": 42
            },
            {
              "key": "S1.12",
              "text": "能同时注意好几个人的互动（谁在跟谁说话）",
              "month": 60
            }
          ]
        },
        {
          "key": "S2",
          "name": "情绪互动与依附",
          "options": "main",
          "items": [
            {
              "key": "S2.1",
              "text": "被抱起或轻拍时会安静下来",
              "month": 0
            },
            {
              "key": "S2.2",
              "text": "会自发地笑",
              "month": 2
            },
            {
              "key": "S2.3",
              "text": "被逗弄时会用笑、发声或手脚动作回应",
              "month": 3
            },
            {
              "key": "S2.4",
              "text": "会主动对熟悉的人笑",
              "month": 5
            },
            {
              "key": "S2.5",
              "text": "熟悉的人离开会表现不安或寻找",
              "month": 8
            },
            {
              "key": "S2.6",
              "text": "难过或害怕时会走向大人寻求安慰",
              "month": 12
            },
            {
              "key": "S2.7",
              "text": "会用表情或动作表达喜欢与不喜欢",
              "month": 15
            },
            {
              "key": "S2.8",
              "text": "跌倒或受挫时会看大人的反应",
              "month": 18
            },
            {
              "key": "S2.9",
              "text": "会说出简单的情绪词（高兴、生气、怕）",
              "month": 30
            },
            {
              "key": "S2.10",
              "text": "被拒绝时能在大人陪伴下平复下来",
              "month": 36
            },
            {
              "key": "S2.11",
              "text": "会主动跟人分享开心的事",
              "month": 42
            },
            {
              "key": "S2.12",
              "text": "能说出自己为什么不开心",
              "month": 54
            }
          ]
        },
        {
          "key": "S3",
          "name": "共同注意与社交启动",
          "options": "main",
          "items": [
            {
              "key": "S3.1",
              "text": "会顺着大人的手势或视线看过去",
              "month": 9
            },
            {
              "key": "S3.2",
              "text": "想要东西时会看人、发声或伸手要求",
              "month": 9
            },
            {
              "key": "S3.3",
              "text": "会把东西递给大人",
              "month": 11
            },
            {
              "key": "S3.4",
              "text": "会用手指出想要的东西",
              "month": 12
            },
            {
              "key": "S3.5",
              "text": "会指出有趣的东西给人看（不是为了要）",
              "month": 14
            },
            {
              "key": "S3.6",
              "text": "拿到新东西会转头看大人的反应",
              "month": 15
            },
            {
              "key": "S3.7",
              "text": "会把玩具拿给人看并等待回应",
              "month": 18
            },
            {
              "key": "S3.8",
              "text": "会主动拉大人去看或去做某件事",
              "month": 20
            },
            {
              "key": "S3.9",
              "text": "会主动开口找大人说话或提问",
              "month": 30
            },
            {
              "key": "S3.10",
              "text": "会主动邀请别人一起玩",
              "month": 36
            },
            {
              "key": "S3.11",
              "text": "能把发生过的事说给别人听",
              "month": 48
            },
            {
              "key": "S3.12",
              "text": "能在团体中适时加入话题",
              "month": 60
            }
          ]
        },
        {
          "key": "S4",
          "name": "模仿与社会学习",
          "options": "main",
          "items": [
            {
              "key": "S4.1",
              "text": "会模仿大人的表情（张嘴、吐舌）",
              "month": 2
            },
            {
              "key": "S4.2",
              "text": "会模仿发出的声音",
              "month": 6
            },
            {
              "key": "S4.3",
              "text": "会模仿简单的动作（拍手、再见）",
              "month": 9
            },
            {
              "key": "S4.4",
              "text": "会模仿日常的动作（讲电话、擦桌子）",
              "month": 14
            },
            {
              "key": "S4.5",
              "text": "会模仿新看到的动作（当下没做过的）",
              "month": 18
            },
            {
              "key": "S4.6",
              "text": "会模仿同伴正在玩的方式",
              "month": 24
            },
            {
              "key": "S4.7",
              "text": "会在游戏中扮演大人的角色",
              "month": 30
            },
            {
              "key": "S4.8",
              "text": "会模仿别人说的整句话",
              "month": 30
            },
            {
              "key": "S4.9",
              "text": "会观察别人之后自己试新方法",
              "month": 42
            },
            {
              "key": "S4.10",
              "text": "会照着别人的做法修正自己的做法",
              "month": 48
            },
            {
              "key": "S4.11",
              "text": "会主动向别人请教怎么做",
              "month": 54
            },
            {
              "key": "S4.12",
              "text": "能在团体中跟着示范完成多步骤的活动",
              "month": 60
            }
          ]
        },
        {
          "key": "S5",
          "name": "游戏与同伴互动",
          "options": "main",
          "items": [
            {
              "key": "S5.1",
              "text": "玩躲猫猫这类来回游戏会有反应",
              "month": 8
            },
            {
              "key": "S5.2",
              "text": "对其他小孩有兴趣、会注视",
              "month": 10
            },
            {
              "key": "S5.3",
              "text": "会跟大人玩简单的来回游戏（你丢我接）",
              "month": 12
            },
            {
              "key": "S5.4",
              "text": "会在其他小孩旁边玩（各玩各的）",
              "month": 18
            },
            {
              "key": "S5.5",
              "text": "会把玩具拿给其他小孩",
              "month": 24
            },
            {
              "key": "S5.6",
              "text": "会跟同伴玩同一个游戏",
              "month": 30
            },
            {
              "key": "S5.7",
              "text": "在提醒下会轮流",
              "month": 36
            },
            {
              "key": "S5.8",
              "text": "会跟同伴玩扮家家酒这类角色游戏",
              "month": 42
            },
            {
              "key": "S5.9",
              "text": "有固定会一起玩的伙伴",
              "month": 48
            },
            {
              "key": "S5.10",
              "text": "能与同伴合作完成一件事",
              "month": 54
            },
            {
              "key": "S5.11",
              "text": "与同伴起冲突时会用说的解决",
              "month": 60
            },
            {
              "key": "S5.12",
              "text": "能加入正在进行中的团体游戏",
              "month": 66
            }
          ]
        },
        {
          "key": "S6",
          "name": "规则与自我调节",
          "options": "main",
          "items": [
            {
              "key": "S6.1",
              "text": "听到「不可以」会停下动作",
              "month": 12
            },
            {
              "key": "S6.2",
              "text": "会跟着大人做简单的收拾",
              "month": 18
            },
            {
              "key": "S6.3",
              "text": "在提醒下能等一下下",
              "month": 24
            },
            {
              "key": "S6.4",
              "text": "会遵守家里的简单规则",
              "month": 30
            },
            {
              "key": "S6.5",
              "text": "活动要结束时能在预告后配合转换",
              "month": 36
            },
            {
              "key": "S6.6",
              "text": "知道哪些事在外面不可以做",
              "month": 42
            },
            {
              "key": "S6.7",
              "text": "会举手或用说的表达需要，而不是直接抢",
              "month": 48
            },
            {
              "key": "S6.8",
              "text": "能在团体活动中遵守游戏规则",
              "month": 48
            },
            {
              "key": "S6.9",
              "text": "能排队等轮到自己",
              "month": 54
            },
            {
              "key": "S6.10",
              "text": "生气时能忍住不动手",
              "month": 60
            },
            {
              "key": "S6.11",
              "text": "能在没有大人盯着时维持规则",
              "month": 66
            },
            {
              "key": "S6.12",
              "text": "能在团体中跟着流程走完一堂课",
              "month": 72
            }
          ]
        },
        {
          "key": "S7",
          "name": "同理与社会理解",
          "options": "main",
          "items": [
            {
              "key": "S7.1",
              "text": "听到别人哭会有反应",
              "month": 12
            },
            {
              "key": "S7.2",
              "text": "会察觉身边的人不开心",
              "month": 24
            },
            {
              "key": "S7.3",
              "text": "会去安慰难过的人",
              "month": 30
            },
            {
              "key": "S7.4",
              "text": "会主动帮忙做事",
              "month": 36
            },
            {
              "key": "S7.5",
              "text": "懂得「轮流」与「大家的」",
              "month": 42
            },
            {
              "key": "S7.6",
              "text": "会说出别人为什么不开心",
              "month": 48
            },
            {
              "key": "S7.7",
              "text": "知道做错事要道歉",
              "month": 48
            },
            {
              "key": "S7.8",
              "text": "懂得别人想要的可能跟自己不一样",
              "month": 54
            },
            {
              "key": "S7.9",
              "text": "能分辨真的不小心与故意的",
              "month": 60
            },
            {
              "key": "S7.10",
              "text": "会为别人着想而改变自己的做法",
              "month": 66
            },
            {
              "key": "S7.11",
              "text": "能理解开玩笑与认真的差别",
              "month": 72
            },
            {
              "key": "S7.12",
              "text": "能说出一件事从别人的角度看是怎样",
              "month": 78
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "SOC",
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
