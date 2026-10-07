/**
 * SXK-ADL（森心康生活自理功能量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_生活自理功能量表_完整版_SXK-ADL.html（sha256 23de09f0dfb8…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-ADL",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_生活自理功能量表_完整版_SXK-ADL.html",
    "sha256": "23de09f0dfb8a188adafe23299c3b2dc50c86f0f27fe86cdc408cf2ddf8e314d"
  },
  "title": "森心康生活自理功能量表",
  "family": "adl",
  "options": {
    "main": [
      {
        "value": 7,
        "label": "完全自己做",
        "hint": "从头到尾自己完成，时间与安全都没问题，不需要有人在旁"
      },
      {
        "value": 6,
        "label": "自己做但需条件",
        "hint": "自己做得到，但需要辅具、改装环境，或比同龄明显久"
      },
      {
        "value": 5,
        "label": "需要口头引导或看着",
        "hint": "大人在旁看着、提醒或一步一步说，但不用动手碰他"
      },
      {
        "value": 4,
        "label": "需要起头或收尾",
        "hint": "大人动手帮开始或收尾，中间他自己做"
      },
      {
        "value": 3,
        "label": "需要一起做",
        "hint": "大人和他一起做，两个人都出力"
      },
      {
        "value": 2,
        "label": "大人做为主",
        "hint": "主要由大人完成，他只做其中一两个步骤"
      },
      {
        "value": 1,
        "label": "完全由大人做",
        "hint": "他几乎没有参与"
      }
    ]
  },
  "forms": [
    {
      "key": "main",
      "name": "生活自理",
      "sections": [
        {
          "key": "EA",
          "name": "进食与餐桌",
          "options": "main",
          "items": [
            {
              "key": "EA.1",
              "text": "用手拿食物吃",
              "month": 12
            },
            {
              "key": "EA.2",
              "text": "用杯子喝水（可有把手）",
              "month": 15
            },
            {
              "key": "EA.3",
              "text": "用汤匙把食物送进嘴里",
              "month": 18
            },
            {
              "key": "EA.4",
              "text": "用吸管喝饮料",
              "month": 18
            },
            {
              "key": "EA.5",
              "text": "自己吃完一餐，不需要大人喂",
              "month": 30
            },
            {
              "key": "EA.6",
              "text": "用筷子或叉子夹／叉起食物",
              "month": 42
            },
            {
              "key": "EA.7",
              "text": "自己倒水或倒饮料",
              "month": 48
            },
            {
              "key": "EA.8",
              "text": "打开常见的包装或餐盒",
              "month": 48
            },
            {
              "key": "EA.9",
              "text": "餐后把餐具放到指定位置",
              "month": 60
            },
            {
              "key": "EA.10",
              "text": "用餐刀切软的食物或涂抹果酱",
              "month": 84
            }
          ]
        },
        {
          "key": "GR",
          "name": "清洁与梳洗",
          "options": "main",
          "items": [
            {
              "key": "GR.1",
              "text": "洗手并擦干",
              "month": 30
            },
            {
              "key": "GR.2",
              "text": "擦嘴、擤鼻涕或擦鼻涕",
              "month": 30
            },
            {
              "key": "GR.3",
              "text": "刷牙（含挤牙膏、漱口）",
              "month": 42
            },
            {
              "key": "GR.4",
              "text": "洗脸并擦干",
              "month": 42
            },
            {
              "key": "GR.5",
              "text": "梳头或整理头发",
              "month": 54
            },
            {
              "key": "GR.6",
              "text": "洗澡时擦洗身体各部位",
              "month": 54
            },
            {
              "key": "GR.7",
              "text": "洗头并冲干净",
              "month": 72
            },
            {
              "key": "GR.8",
              "text": "剪指甲或整理仪容（照镜子整理衣服）",
              "month": 108
            }
          ]
        },
        {
          "key": "DR",
          "name": "穿脱衣物",
          "options": "main",
          "items": [
            {
              "key": "DR.1",
              "text": "脱袜子与鞋子",
              "month": 18
            },
            {
              "key": "DR.2",
              "text": "脱开襟外套或上衣",
              "month": 24
            },
            {
              "key": "DR.3",
              "text": "穿套头上衣",
              "month": 36
            },
            {
              "key": "DR.4",
              "text": "穿裤子（松紧带）",
              "month": 36
            },
            {
              "key": "DR.5",
              "text": "穿魔术贴鞋子",
              "month": 36
            },
            {
              "key": "DR.6",
              "text": "扣上大扣子",
              "month": 48
            },
            {
              "key": "DR.7",
              "text": "拉上拉链（含对准拉链头）",
              "month": 54
            },
            {
              "key": "DR.8",
              "text": "分清左右脚穿鞋",
              "month": 54
            },
            {
              "key": "DR.9",
              "text": "依天气或场合选衣服",
              "month": 72
            },
            {
              "key": "DR.10",
              "text": "系鞋带",
              "month": 72
            }
          ]
        },
        {
          "key": "TO",
          "name": "如厕与括约肌",
          "options": "main",
          "items": [
            {
              "key": "TO.1",
              "text": "会用语言或动作表示要上厕所",
              "month": 24
            },
            {
              "key": "TO.2",
              "text": "白天膀胱控制（不尿湿）",
              "month": 30
            },
            {
              "key": "TO.3",
              "text": "大便控制（能表示并在马桶完成）",
              "month": 30
            },
            {
              "key": "TO.4",
              "text": "如厕时自己脱穿裤子",
              "month": 36
            },
            {
              "key": "TO.5",
              "text": "便后自己擦拭",
              "month": 48
            },
            {
              "key": "TO.6",
              "text": "冲水、洗手，完成整个如厕流程",
              "month": 48
            },
            {
              "key": "TO.7",
              "text": "夜间不尿床",
              "month": 60
            },
            {
              "key": "TO.8",
              "text": "外出时能使用公共厕所",
              "month": 72
            }
          ]
        },
        {
          "key": "MO",
          "name": "转位与移动",
          "options": "main",
          "items": [
            {
              "key": "MO.1",
              "text": "自己坐上或离开椅子",
              "month": 15
            },
            {
              "key": "MO.2",
              "text": "在平地行走或移动约 50 米",
              "month": 18
            },
            {
              "key": "MO.3",
              "text": "自己上下床",
              "month": 24
            },
            {
              "key": "MO.4",
              "text": "自己上下马桶",
              "month": 30
            },
            {
              "key": "MO.5",
              "text": "上下楼梯（可扶扶手）",
              "month": 30
            },
            {
              "key": "MO.6",
              "text": "上下楼梯时两脚交替",
              "month": 42
            },
            {
              "key": "MO.7",
              "text": "进出淋浴间或浴缸",
              "month": 42
            },
            {
              "key": "MO.8",
              "text": "上下汽车并坐好",
              "month": 48
            },
            {
              "key": "MO.9",
              "text": "在户外不平的地面或人多的地方移动",
              "month": 48
            },
            {
              "key": "MO.10",
              "text": "背着书包走完上下学的一段路",
              "month": 60
            }
          ]
        },
        {
          "key": "CO",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "CO.1",
              "text": "听懂日常的一步指令",
              "month": 15
            },
            {
              "key": "CO.2",
              "text": "表达自己的需求",
              "month": 18
            },
            {
              "key": "CO.3",
              "text": "回答简单的问题（谁、什么、哪里）",
              "month": 30
            },
            {
              "key": "CO.4",
              "text": "听懂两到三个步骤的指令",
              "month": 36
            },
            {
              "key": "CO.5",
              "text": "说清楚刚刚发生的事",
              "month": 48
            },
            {
              "key": "CO.6",
              "text": "在陌生人面前表达需求或求助",
              "month": 60
            }
          ]
        },
        {
          "key": "SC",
          "name": "社会认知与安全",
          "options": "main",
          "items": [
            {
              "key": "SC.1",
              "text": "与人互动（打招呼、轮流、一起玩）",
              "month": 24
            },
            {
              "key": "SC.2",
              "text": "把注意力维持在一件事上直到完成",
              "month": 30
            },
            {
              "key": "SC.3",
              "text": "解决日常小问题（东西拿不到会想办法）",
              "month": 36
            },
            {
              "key": "SC.4",
              "text": "记住并完成交代的一件事",
              "month": 36
            },
            {
              "key": "SC.5",
              "text": "跟上日常作息（起床、吃饭、出门）",
              "month": 36
            },
            {
              "key": "SC.6",
              "text": "知道常见危险并避开（烫、马路、高处）",
              "month": 42
            },
            {
              "key": "SC.7",
              "text": "情绪激动时能求助或自己慢慢平复",
              "month": 48
            },
            {
              "key": "SC.8",
              "text": "管理自己的物品（书包、水壶不遗失）",
              "month": 60
            },
            {
              "key": "SC.9",
              "text": "有时间观念，能在约定时间内完成",
              "month": 84
            },
            {
              "key": "SC.10",
              "text": "在熟悉的地方自己买东西或完成简单交易",
              "month": 120
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "ADL",
    "levels": [
      {
        "min": 72,
        "name": "独立性良好"
      },
      {
        "min": 45,
        "name": "部分活动需协助"
      },
      {
        "min": 0,
        "name": "多数活动需协助"
      }
    ],
    "minItems": 2,
    "grade": [
      0,
      1,
      3
    ]
  }
};
