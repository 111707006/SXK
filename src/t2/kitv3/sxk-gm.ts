/**
 * SXK-GM（森心康粗大动作发展量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_粗大动作发展量表_完整版_SXK-GM.html（sha256 412bfc616fec…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-GM",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_粗大动作发展量表_完整版_SXK-GM.html",
    "sha256": "412bfc616fec09ea026632c7ab7b763987ed75e383653e0a86a064224584eaef"
  },
  "title": "森心康粗大动作发展量表 · 完整版",
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
          "key": "G1",
          "name": "俯卧与头颈控制",
          "options": "main",
          "items": [
            {
              "key": "G1.1",
              "text": "趴着时能把头转向一侧（避开口鼻）",
              "month": 0
            },
            {
              "key": "G1.2",
              "text": "趴着时能短暂把头抬离床面",
              "month": 1
            },
            {
              "key": "G1.3",
              "text": "被竖抱时头能自己稳住一下",
              "month": 2
            },
            {
              "key": "G1.4",
              "text": "趴着时用前臂撑起上身",
              "month": 3
            },
            {
              "key": "G1.5",
              "text": "趴着时头能抬起约 45 度并维持一会儿",
              "month": 3
            },
            {
              "key": "G1.6",
              "text": "被拉坐起来时头不往后垂",
              "month": 4
            },
            {
              "key": "G1.7",
              "text": "趴着时头能抬到接近 90 度",
              "month": 4
            },
            {
              "key": "G1.8",
              "text": "趴着时能用手掌撑直手臂、胸部离地",
              "month": 6
            },
            {
              "key": "G1.9",
              "text": "趴着时能单手伸出去拿玩具、另一手撑住",
              "month": 7
            },
            {
              "key": "G1.10",
              "text": "趴着时能原地转身改变方向",
              "month": 8
            },
            {
              "key": "G1.11",
              "text": "能从趴姿自己推起成四点跪",
              "month": 9
            },
            {
              "key": "G1.12",
              "text": "趴着时能把身体撑高去看远处",
              "month": 10
            }
          ]
        },
        {
          "key": "G2",
          "name": "翻身与姿势转换",
          "options": "main",
          "items": [
            {
              "key": "G2.1",
              "text": "仰躺时会踢腿、挥手，身体会左右摆动",
              "month": 1
            },
            {
              "key": "G2.2",
              "text": "能从仰躺翻成侧躺",
              "month": 4
            },
            {
              "key": "G2.3",
              "text": "能从仰躺翻成趴着",
              "month": 5
            },
            {
              "key": "G2.4",
              "text": "能从趴着翻回仰躺",
              "month": 6
            },
            {
              "key": "G2.5",
              "text": "能连续翻身移动一小段距离",
              "month": 7
            },
            {
              "key": "G2.6",
              "text": "能从趴姿自己坐起来",
              "month": 9
            },
            {
              "key": "G2.7",
              "text": "能从坐姿转成趴姿或四点跪",
              "month": 9
            },
            {
              "key": "G2.8",
              "text": "扶着东西能从坐姿站起来",
              "month": 10
            },
            {
              "key": "G2.9",
              "text": "能从地上不扶东西自己站起来",
              "month": 15
            },
            {
              "key": "G2.10",
              "text": "站着能自己蹲下再站起来",
              "month": 18
            },
            {
              "key": "G2.11",
              "text": "能自己爬上矮床或沙发并转身坐好",
              "month": 20
            },
            {
              "key": "G2.12",
              "text": "能从蹲姿一边拿东西一边站起来不跌倒",
              "month": 24
            }
          ]
        },
        {
          "key": "G3",
          "name": "坐姿与躯干控制",
          "options": "main",
          "items": [
            {
              "key": "G3.1",
              "text": "被扶坐时头能稳住",
              "month": 3
            },
            {
              "key": "G3.2",
              "text": "靠着支撑能坐一下下",
              "month": 5
            },
            {
              "key": "G3.3",
              "text": "能双手往前撑着坐一会儿",
              "month": 6
            },
            {
              "key": "G3.4",
              "text": "能自己坐稳一小段时间不用手撑",
              "month": 7
            },
            {
              "key": "G3.5",
              "text": "坐着时双手能自由玩玩具",
              "month": 8
            },
            {
              "key": "G3.6",
              "text": "坐着时能转身拿旁边的东西不倒",
              "month": 9
            },
            {
              "key": "G3.7",
              "text": "坐着被轻轻推一下能自己回正",
              "month": 10
            },
            {
              "key": "G3.8",
              "text": "能长时间坐着玩不需支撑",
              "month": 12
            },
            {
              "key": "G3.9",
              "text": "能自己坐上小椅子",
              "month": 18
            },
            {
              "key": "G3.10",
              "text": "坐在椅子上能维持端正一段时间",
              "month": 30
            },
            {
              "key": "G3.11",
              "text": "能坐着完成十分钟以上的桌面活动不趴下",
              "month": 48
            },
            {
              "key": "G3.12",
              "text": "能在地板上盘腿坐着听完一段故事",
              "month": 54
            }
          ]
        },
        {
          "key": "G4",
          "name": "爬行与移位",
          "options": "main",
          "items": [
            {
              "key": "G4.1",
              "text": "趴着时会原地转圈或向后退",
              "month": 6
            },
            {
              "key": "G4.2",
              "text": "能用肚子贴地往前移动",
              "month": 7
            },
            {
              "key": "G4.3",
              "text": "能撑成四点跪并前后摇晃",
              "month": 8
            },
            {
              "key": "G4.4",
              "text": "能手膝并用往前爬",
              "month": 9
            },
            {
              "key": "G4.5",
              "text": "扶着家具能横向移动几步",
              "month": 10
            },
            {
              "key": "G4.6",
              "text": "能爬着越过低矮的障碍",
              "month": 11
            },
            {
              "key": "G4.7",
              "text": "能爬上矮的台阶或沙发",
              "month": 12
            },
            {
              "key": "G4.8",
              "text": "能爬着上楼梯",
              "month": 15
            },
            {
              "key": "G4.9",
              "text": "能自己倒退着下楼梯或下床",
              "month": 18
            },
            {
              "key": "G4.10",
              "text": "能钻过桌子或隧道",
              "month": 20
            },
            {
              "key": "G4.11",
              "text": "能在攀爬架上爬上爬下",
              "month": 36
            },
            {
              "key": "G4.12",
              "text": "能手脚并用爬上有高度的游具",
              "month": 42
            }
          ]
        },
        {
          "key": "G5",
          "name": "站立与行走",
          "options": "main",
          "items": [
            {
              "key": "G5.1",
              "text": "被扶着腋下能用双腿承重一下",
              "month": 4
            },
            {
              "key": "G5.2",
              "text": "扶着东西能站起来",
              "month": 9
            },
            {
              "key": "G5.3",
              "text": "能自己放手站立几秒",
              "month": 11
            },
            {
              "key": "G5.4",
              "text": "能自己走稳几步",
              "month": 12
            },
            {
              "key": "G5.5",
              "text": "能独立行走不常跌倒",
              "month": 15
            },
            {
              "key": "G5.6",
              "text": "能一边走一边拿着东西",
              "month": 16
            },
            {
              "key": "G5.7",
              "text": "能扶着扶手上下楼梯",
              "month": 18
            },
            {
              "key": "G5.8",
              "text": "能推或拉着玩具走",
              "month": 18
            },
            {
              "key": "G5.9",
              "text": "能两脚一阶自己上楼梯",
              "month": 24
            },
            {
              "key": "G5.10",
              "text": "能两脚一阶自己下楼梯",
              "month": 27
            },
            {
              "key": "G5.11",
              "text": "能双脚交替上楼梯",
              "month": 36
            },
            {
              "key": "G5.12",
              "text": "能双脚交替下楼梯",
              "month": 48
            }
          ]
        },
        {
          "key": "G6",
          "name": "跑跳与下肢力量",
          "options": "main",
          "items": [
            {
              "key": "G6.1",
              "text": "扶着大人的手能往下跳一阶",
              "month": 20
            },
            {
              "key": "G6.2",
              "text": "能跑起来（双脚有腾空期）",
              "month": 24
            },
            {
              "key": "G6.3",
              "text": "能踢地上固定的球",
              "month": 24
            },
            {
              "key": "G6.4",
              "text": "能双脚同时离地跳",
              "month": 27
            },
            {
              "key": "G6.5",
              "text": "能从矮处往下跳并站稳",
              "month": 30
            },
            {
              "key": "G6.6",
              "text": "能往前连续跳两三下",
              "month": 33
            },
            {
              "key": "G6.7",
              "text": "能跑步时转弯或急停",
              "month": 36
            },
            {
              "key": "G6.8",
              "text": "能跳过地上的小障碍",
              "month": 42
            },
            {
              "key": "G6.9",
              "text": "能单脚连续往前跳",
              "month": 48
            },
            {
              "key": "G6.10",
              "text": "能双脚交替跳（原地高抬腿跳）",
              "month": 54
            },
            {
              "key": "G6.11",
              "text": "能连续跑动五分钟以上不需停下",
              "month": 60
            },
            {
              "key": "G6.12",
              "text": "能跑跳跟上同龄孩子的团体活动",
              "month": 66
            }
          ]
        },
        {
          "key": "G7",
          "name": "平衡与球类协调",
          "options": "main",
          "items": [
            {
              "key": "G7.1",
              "text": "站着弯腰捡东西不跌倒",
              "month": 15
            },
            {
              "key": "G7.2",
              "text": "能拿着球举高往前扔",
              "month": 24
            },
            {
              "key": "G7.3",
              "text": "能踢滚过来的球",
              "month": 30
            },
            {
              "key": "G7.4",
              "text": "能单脚站一两秒",
              "month": 30
            },
            {
              "key": "G7.5",
              "text": "能骑三轮车或滑步车",
              "month": 36
            },
            {
              "key": "G7.6",
              "text": "能双手接住抛来的大球",
              "month": 42
            },
            {
              "key": "G7.7",
              "text": "能沿着地上的直线走十步",
              "month": 42
            },
            {
              "key": "G7.8",
              "text": "能单脚站五秒以上",
              "month": 48
            },
            {
              "key": "G7.9",
              "text": "能连续拍球两三下",
              "month": 54
            },
            {
              "key": "G7.10",
              "text": "能脚跟对脚尖走直线一小段",
              "month": 60
            },
            {
              "key": "G7.11",
              "text": "能骑两轮脚踏车（不用辅助轮）",
              "month": 66
            },
            {
              "key": "G7.12",
              "text": "能一边跑一边控制球或跟上队形",
              "month": 72
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "MOT",
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
        "name": "建议安排物理治疗评估"
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
