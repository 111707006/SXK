/**
 * SXK-ATT（森心康注意力及多动量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_注意力及多动量表_完整版_SXK-ATT.html（sha256 61637d18958c…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-ATT",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_注意力及多动量表_完整版_SXK-ATT.html",
    "sha256": "61637d18958c4a564b93432742ae29905b83b7636b9993ebd6900b5129f54eb8"
  },
  "title": "森心康注意力及多动量表",
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
          "key": "CL",
          "name": "课堂情境",
          "options": "main",
          "items": [
            {
              "key": "CL.1",
              "text": "听讲或听故事时东张西望，容易被旁边的动静吸引",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "CL.2",
              "text": "老师说的指令只听到一半，需要个别再说一次",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "CL.3",
              "text": "坐着时身体一直扭动，或玩手边的东西",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "CL.4",
              "text": "活动进行中离开座位或自己的位置",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "CL.5",
              "text": "老师还没问完就抢着回答或喊出来",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "CL.6",
              "text": "上课时与旁边的同学讲话或碰触同学",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "CL.7",
              "text": "活动转换（收东西、换下一项）比同学慢很多",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "CL.8",
              "text": "被提醒或纠正时反应很大（生气、哭、顶嘴）",
              "month": 48,
              "tags": [
                "ER"
              ]
            }
          ],
          "naLabel": "这个情境无法观察",
          "preName": {
            "belowM": 72,
            "name": "集体活动情境（幼儿园）"
          }
        },
        {
          "key": "HW",
          "name": "作业情境",
          "options": "main",
          "items": [
            {
              "key": "HW.1",
              "text": "开始一项作业或任务需要大人一再催促",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "HW.2",
              "text": "做到一半就跑去做别的事",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "HW.3",
              "text": "粗心：看错题目、漏题或漏字",
              "month": 72,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "HW.4",
              "text": "花的时间远超过同龄孩子",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "HW.5",
              "text": "做的时候离开座位、站起来走动",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "HW.6",
              "text": "需要大人在旁陪着才能做完",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "HW.7",
              "text": "急着做完，不检查就交",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "HW.8",
              "text": "遇到难题或做错就发脾气、撕纸或放弃",
              "month": 48,
              "tags": [
                "ER"
              ]
            }
          ],
          "naLabel": "这个情境无法观察",
          "preName": {
            "belowM": 72,
            "name": "桌面任务情境（画画、拼图、描写）"
          }
        },
        {
          "key": "HM",
          "name": "居家情境",
          "options": "main",
          "items": [
            {
              "key": "HM.1",
              "text": "交代的事情听了就忘",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "HM.2",
              "text": "早上出门、睡前的流程需要一直催",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "HM.3",
              "text": "吃饭时坐不住，常离开餐桌",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "HM.4",
              "text": "在家跑跳、攀爬，停不下来",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "HM.5",
              "text": "东西随手放，常找不到",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "HM.6",
              "text": "看平板或电视时很难叫停，一叫停就闹",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "HM.7",
              "text": "想要的东西马上就要，等不了",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "HM.8",
              "text": "为小事情绪爆发，平复需要很久",
              "month": 48,
              "tags": [
                "ER"
              ]
            }
          ]
        },
        {
          "key": "IP",
          "name": "人际情境",
          "options": "main",
          "items": [
            {
              "key": "IP.1",
              "text": "插话、打断别人说话",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "IP.2",
              "text": "排队或轮流时等不了",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "IP.3",
              "text": "抢玩具、抢先，不管游戏规则",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "IP.4",
              "text": "玩的时候动作过大，常碰撞到别人",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "IP.5",
              "text": "别人跟他说话时像没在听",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "IP.6",
              "text": "团体游戏中跟不上规则或步骤",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "IP.7",
              "text": "输了或不顺心就大哭大闹",
              "month": 48,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "IP.8",
              "text": "与同伴发生冲突的次数明显比同龄多",
              "month": 48,
              "tags": [
                "ER"
              ]
            }
          ]
        },
        {
          "key": "SM",
          "name": "自我管理",
          "options": "main",
          "items": [
            {
              "key": "SM.1",
              "text": "无法预估一件事要花多久",
              "month": 72,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "SM.2",
              "text": "计划好的事情做不到或忘记",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "SM.3",
              "text": "需要大人在旁提醒才能控制自己",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "SM.4",
              "text": "知道规则，但当下就是做不到",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "SM.5",
              "text": "受挫后很难重新开始",
              "month": 48,
              "tags": [
                "ER"
              ]
            },
            {
              "key": "SM.6",
              "text": "卡住了不会主动求助，就停在那里",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "SM.7",
              "text": "对自己的表现缺乏觉察（以为做完了其实没做完）",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "SM.8",
              "text": "丢三落四：学习用品、衣物常遗失",
              "month": 48,
              "tags": [
                "EF"
              ]
            }
          ]
        },
        {
          "key": "OU",
          "name": "户外与公共场所",
          "options": "main",
          "items": [
            {
              "key": "OU.1",
              "text": "过马路或在停车场时会突然冲出去",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "OU.2",
              "text": "在商场、餐厅等场合跑来跑去",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "OU.3",
              "text": "随手触摸展示品或别人的东西",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "OU.4",
              "text": "走在路上一直被新东西吸引，叫他也没反应",
              "month": 48,
              "tags": [
                "IN"
              ]
            },
            {
              "key": "OU.5",
              "text": "需要安静等待的场合（候诊、看演出）坐不住",
              "month": 48,
              "tags": [
                "HY"
              ]
            },
            {
              "key": "OU.6",
              "text": "出门要带的东西常忘记",
              "month": 48,
              "tags": [
                "EF"
              ]
            },
            {
              "key": "OU.7",
              "text": "攀爬到危险的高处",
              "month": 48,
              "tags": [
                "IM"
              ]
            },
            {
              "key": "OU.8",
              "text": "不能如愿时在公共场合大哭大闹",
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
              "hint": "学习表现明显低于他的能力"
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
        "max": 25,
        "name": "未见明显"
      },
      {
        "max": 42,
        "name": "部分情境需留意"
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
