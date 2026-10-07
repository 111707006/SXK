/**
 * SXK-AB（森心康注意力及行为观察量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_注意力及行为观察量表_完整版_SXK-AB.html（sha256 7ac5598c3ee8…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-AB",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_注意力及行为观察量表_完整版_SXK-AB.html",
    "sha256": "7ac5598c3ee84a7ba8779aafd03000d10280f8637b15653d3a87e64673e9cf0c"
  },
  "title": "森心康注意力及行为观察量表",
  "family": "concern",
  "options": {
    "main": [
      {
        "value": 0,
        "label": "很少或没有"
      },
      {
        "value": 1,
        "label": "偶尔"
      },
      {
        "value": 2,
        "label": "经常"
      },
      {
        "value": 3,
        "label": "总是"
      }
    ],
    "impact": [
      {
        "value": 0,
        "label": "没有影响"
      },
      {
        "value": 1,
        "label": "轻微"
      },
      {
        "value": 2,
        "label": "明显"
      },
      {
        "value": 3,
        "label": "严重"
      }
    ]
  },
  "forms": [
    {
      "key": "P",
      "name": "家长版",
      "sections": [
        {
          "key": "SU",
          "name": "持续专注",
          "options": "main",
          "items": [
            {
              "key": "SU.1",
              "text": "做一件事撑不了多久就想换别的",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.2",
              "text": "听人说话时常常放空、没在听",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.3",
              "text": "需要一再提醒才能把一件事做完",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.4",
              "text": "做到一半就跑去做别的事",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.5",
              "text": "安静的活动（拼图、看书）维持不了几分钟",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.6",
              "text": "需要动脑的作业特别容易半途而废",
              "month": 48,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.7",
              "text": "交代的事听完就忘",
              "month": 48,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "SU.8",
              "text": "写作业或练习时间明显比同龄久",
              "month": 60,
              "tags": [
                "AT"
              ]
            }
          ]
        },
        {
          "key": "DI",
          "name": "抗干扰",
          "options": "main",
          "items": [
            {
              "key": "DI.1",
              "text": "旁边一有动静就被吸引过去",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.2",
              "text": "在人多的地方几乎无法专心",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.3",
              "text": "环境稍微吵就做不下去",
              "month": 36,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.4",
              "text": "东西常常掉了、忘了、找不到",
              "month": 48,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.5",
              "text": "一边做事一边被无关的念头带走",
              "month": 48,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.6",
              "text": "同时有两件事时完全乱掉",
              "month": 48,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.7",
              "text": "容易因为粗心出错，而不是不会做",
              "month": 60,
              "tags": [
                "AT"
              ]
            },
            {
              "key": "DI.8",
              "text": "做作业时需要人陪在旁边才不分心",
              "month": 60,
              "tags": [
                "AT"
              ]
            }
          ]
        },
        {
          "key": "IM",
          "name": "冲动控制",
          "options": "main",
          "items": [
            {
              "key": "IM.1",
              "text": "想要的东西马上就要拿到",
              "month": 30,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.2",
              "text": "不等别人讲完就抢着说",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.3",
              "text": "排队或轮流对他很困难",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.4",
              "text": "没想清楚后果就行动",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.5",
              "text": "被制止后还是会再做一次",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.6",
              "text": "插话或打断别人的活动",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.7",
              "text": "情绪一来就先动手或先大叫",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "IM.8",
              "text": "答题时抢快而不看清楚",
              "month": 60,
              "tags": [
                "HI"
              ]
            }
          ]
        },
        {
          "key": "HY",
          "name": "活动量",
          "options": "main",
          "items": [
            {
              "key": "HY.1",
              "text": "吃饭时坐不住",
              "month": 30,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.2",
              "text": "睡前特别难静下来",
              "month": 30,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.3",
              "text": "坐着时手脚一直动、扭来扭去",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.4",
              "text": "很难安静地玩或做静态活动",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.5",
              "text": "像装了马达一样停不下来",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.6",
              "text": "爬上爬下、跑来跑去不看场合",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.7",
              "text": "话特别多、停不下来",
              "month": 36,
              "tags": [
                "HI"
              ]
            },
            {
              "key": "HY.8",
              "text": "该坐好的场合会离开座位",
              "month": 48,
              "tags": [
                "HI"
              ]
            }
          ]
        },
        {
          "key": "EF",
          "name": "组织与执行",
          "options": "main",
          "items": [
            {
              "key": "EF.1",
              "text": "做事没有顺序，想到哪做到哪",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.2",
              "text": "多步骤的事情容易漏掉其中几步",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.3",
              "text": "遇到困难就卡住，不会换方法",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.4",
              "text": "需要大人帮忙才能开始一件事",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.5",
              "text": "同一个错误反复出现",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.6",
              "text": "时间感差，常常来不及或拖到最后",
              "month": 60,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.7",
              "text": "书包、房间、桌面长期杂乱",
              "month": 60,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "EF.8",
              "text": "计划好的事情常常没做到",
              "month": 60,
              "tags": [
                "EF"
              ]
            }
          ]
        },
        {
          "key": "OD",
          "name": "对立与情绪",
          "options": "main",
          "items": [
            {
              "key": "OD.1",
              "text": "挫折忍受度低，一不顺就爆发",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.2",
              "text": "与同伴容易起冲突",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.3",
              "text": "对大人的要求习惯性反抗",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.4",
              "text": "被纠正时会顶嘴或生气",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.5",
              "text": "情绪起伏大且不容易预期",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.6",
              "text": "因为上述表现被老师或家人反复提醒",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.7",
              "text": "情绪过后需要很久才能平复",
              "month": 36,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "OD.8",
              "text": "把错误归到别人身上",
              "month": 48,
              "tags": [
                "ER"
              ]
            }
          ]
        },
        {
          "key": "IMP",
          "name": "功能影响",
          "options": "impact",
          "items": [
            {
              "key": "imp.1",
              "text": "学业或学习进度",
              "hint": "学习表现明显低于能力"
            },
            {
              "key": "imp.2",
              "text": "同伴关系",
              "hint": "被同伴排斥、没有固定的朋友"
            },
            {
              "key": "imp.3",
              "text": "家庭关系",
              "hint": "亲子冲突频繁、家人疲于应付"
            },
            {
              "key": "imp.4",
              "text": "自信心与情绪",
              "hint": "常说自己笨、不想上学、情绪低落"
            },
            {
              "key": "imp.5",
              "text": "安全",
              "hint": "常受伤、走失或做出危险举动"
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "ATT",
    "levels": [
      {
        "max": 33,
        "name": "未见明显"
      },
      {
        "max": 50,
        "name": "部分表现需留意"
      },
      {
        "max": 100,
        "name": "建议专业评估"
      }
    ],
    "perItemMax": 3,
    "naLimit": null,
    "grade": [
      0,
      1,
      3
    ]
  }
};
