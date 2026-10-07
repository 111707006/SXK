/**
 * SXK-ASB（森心康自闭行为量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_自闭行为量表_完整版_SXK-ASB.html（sha256 5377793199ed…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-ASB",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_自闭行为量表_完整版_SXK-ASB.html",
    "sha256": "5377793199ed196f5bf2c2fec26743ea2be3de8fe030cc0d22d007770e7f6c5e"
  },
  "title": "森心康自闭行为量表",
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
    "hasnot": [
      {
        "value": 1,
        "label": "有"
      },
      {
        "value": 0,
        "label": "没有"
      }
    ]
  },
  "forms": [
    {
      "key": "P",
      "name": "家长版",
      "sections": [
        {
          "key": "REG",
          "name": "能力倒退",
          "options": "hasnot",
          "items": [
            {
              "key": "reg.1",
              "text": "语言：以前会说的词或句子，现在不说了"
            },
            {
              "key": "reg.2",
              "text": "社交：以前有眼神、会回应或会叫人，现在没有了"
            },
            {
              "key": "reg.3",
              "text": "游戏：以前会玩的游戏或会模仿，现在不玩了"
            },
            {
              "key": "reg.4",
              "text": "自理：以前会自己吃饭、如厕等，现在不会了"
            }
          ]
        },
        {
          "key": "SE",
          "name": "感觉反应",
          "options": "main",
          "items": [
            {
              "key": "SE.1",
              "text": "对声音过度反应或完全没有反应",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.2",
              "text": "对疼痛的反应异常（过强或几乎没有）",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.3",
              "text": "长时间盯着旋转或闪烁的东西",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.4",
              "text": "喜欢闻或舔不是食物的东西",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.5",
              "text": "对某些材质（衣服标签、沙子、胶水）强烈抗拒",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.6",
              "text": "对光线特别敏感",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.7",
              "text": "喜欢用眼角余光斜看东西",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.8",
              "text": "对冷热的反应异常",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.9",
              "text": "喜欢反复触摸特定的表面",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.10",
              "text": "听到特定声音会摀住耳朵",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.11",
              "text": "对食物的质地极度挑剔",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SE.12",
              "text": "喜欢反复制造并聆听特定的声响",
              "month": 18,
              "tags": [
                "B"
              ]
            }
          ]
        },
        {
          "key": "RE",
          "name": "人际关系",
          "options": "main",
          "items": [
            {
              "key": "RE.1",
              "text": "很少主动与人互动",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.2",
              "text": "眼神接触短暂或回避",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.3",
              "text": "叫他的名字没有反应",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.4",
              "text": "不会用手指指东西给你看（只为了分享，不是要东西）",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.5",
              "text": "你指着远处的东西时，他不会顺着看过去",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.6",
              "text": "不会把东西拿过来给你看",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.7",
              "text": "不会主动分享有趣的事",
              "month": 30,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.8",
              "text": "对别人的情绪（哭、笑、生气）没有反应",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.9",
              "text": "喜欢独处胜过与人相处",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.10",
              "text": "对同龄的孩子没有兴趣",
              "month": 24,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.11",
              "text": "很难与同龄孩子建立关系",
              "month": 36,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.12",
              "text": "把大人当工具使用（拉大人的手去拿东西）",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.13",
              "text": "对熟人与陌生人的反应没有差别",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.14",
              "text": "难过或受伤时不会来找人安慰",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.15",
              "text": "很少模仿别人的动作或表情",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.16",
              "text": "不玩假装游戏（假装喂娃娃、打电话）",
              "month": 24,
              "tags": [
                "A"
              ]
            },
            {
              "key": "RE.17",
              "text": "对表情或语气的变化不敏感",
              "month": 36,
              "tags": [
                "A"
              ]
            }
          ]
        },
        {
          "key": "BO",
          "name": "身体与动作",
          "options": "main",
          "items": [
            {
              "key": "BO.1",
              "text": "出现重复的手部动作（甩手、拍手、在眼前晃手指）",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.2",
              "text": "身体前后摇晃或原地转圈",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.3",
              "text": "踮着脚尖走路",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.4",
              "text": "走路姿势特别",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "BO.5",
              "text": "长时间维持某个特定姿势",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.6",
              "text": "对物品做重复动作（转、拍、排成一列）",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.7",
              "text": "动作协调明显笨拙",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "BO.8",
              "text": "突然冲出去或无目的地跑来跑去",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "BO.9",
              "text": "喜欢跳跃或撞击东西",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.10",
              "text": "对身体某部位有特别的固着（反复看手、摸某处）",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "BO.11",
              "text": "模仿动作有困难",
              "month": 18,
              "tags": [
                "A"
              ]
            }
          ]
        },
        {
          "key": "LA",
          "name": "语言沟通",
          "options": "main",
          "items": [
            {
              "key": "LA.1",
              "text": "没有语言或语言明显落后",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "LA.2",
              "text": "说话像背诵，或重复别人说过的话（仿说）",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "LA.3",
              "text": "说话的声调平板或怪异",
              "month": 30,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.4",
              "text": "你、我、他混用（把「你」说成「我」）",
              "month": 30,
              "tags": [
                "B"
              ]
            },
            {
              "key": "LA.5",
              "text": "很少主动开口说话",
              "month": 24,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.6",
              "text": "说的内容与当下情境无关",
              "month": 30,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.7",
              "text": "反复问同样的问题",
              "month": 30,
              "tags": [
                "B"
              ]
            },
            {
              "key": "LA.8",
              "text": "不会用点头、摇头、挥手等手势辅助表达",
              "month": 18,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.9",
              "text": "听不懂比喻或玩笑",
              "month": 48,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.10",
              "text": "对话无法维持来回",
              "month": 36,
              "tags": [
                "A"
              ]
            },
            {
              "key": "LA.11",
              "text": "常自言自语或重复广告、动画台词",
              "month": 30,
              "tags": [
                "B"
              ]
            },
            {
              "key": "LA.12",
              "text": "用词过于正式或特别，不像同龄孩子",
              "month": 48,
              "tags": [
                "B"
              ]
            }
          ]
        },
        {
          "key": "SH",
          "name": "自理与适应",
          "options": "main",
          "items": [
            {
              "key": "SH.1",
              "text": "日常流程改变时强烈抗拒",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SH.2",
              "text": "进食种类极度受限",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SH.3",
              "text": "睡眠模式异常（难入睡、夜醒多）",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.4",
              "text": "如厕训练明显困难",
              "month": 36,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.5",
              "text": "学习穿脱衣物明显困难",
              "month": 36,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.6",
              "text": "对危险缺乏警觉",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.7",
              "text": "情绪爆发强烈，而且很难安抚",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.8",
              "text": "出现自伤行为（撞头、咬手）",
              "month": 18,
              "tags": [
                "O"
              ]
            },
            {
              "key": "SH.9",
              "text": "对特定物品有强烈依附，拿走就崩溃",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SH.10",
              "text": "从一个活动转换到另一个活动特别困难",
              "month": 18,
              "tags": [
                "B"
              ]
            },
            {
              "key": "SH.11",
              "text": "对某个主题的兴趣特别强烈、狭窄（只谈车牌、地图、恐龙）",
              "month": 36,
              "tags": [
                "B"
              ]
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
        "max": 22,
        "name": "未见明显"
      },
      {
        "max": 40,
        "name": "部分行为需留意"
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
