/**
 * SNAP-IV（SNAP-IV 评量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_SNAP-IV评量表_完整版.html（sha256 dc2503a29e9e…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SNAP-IV",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_SNAP-IV评量表_完整版.html",
    "sha256": "dc2503a29e9e8999993f81f8fea6d32561d9f0a3608b4d29ed3fc9fc071b6490"
  },
  "title": "SNAP-IV 评量表",
  "family": "snap",
  "options": {
    "main": [
      {
        "value": 0,
        "label": "完全没有"
      },
      {
        "value": 1,
        "label": "有一点点"
      },
      {
        "value": 2,
        "label": "还算不少"
      },
      {
        "value": 3,
        "label": "非常的多"
      }
    ]
  },
  "forms": [
    {
      "key": "P",
      "name": "家长版",
      "sections": [
        {
          "key": "IA",
          "name": "注意力不足",
          "options": "main",
          "items": [
            {
              "key": "IA.1",
              "text": "无法专注于细节的部分，或在做学校作业或其他活动时，出现粗心的错误"
            },
            {
              "key": "IA.2",
              "text": "很难持续专注于工作或游戏活动"
            },
            {
              "key": "IA.3",
              "text": "看起来好像没有在听别人对他(她)说话的内容"
            },
            {
              "key": "IA.4",
              "text": "没有办法遵循指示，也无法完成学校作业或家事(并不是由于对立性行为或无法了解指示的内容)"
            },
            {
              "key": "IA.5",
              "text": "组织规划工作及活动有困难"
            },
            {
              "key": "IA.6",
              "text": "逃避，或表达不愿意，或有困难于需要持续性动脑的工作(例如学校作业或家庭作业)"
            },
            {
              "key": "IA.7",
              "text": "会弄丢工作上或活动所必须的东西(例如学校作业、铅笔、书、工具或玩具)"
            },
            {
              "key": "IA.8",
              "text": "很容易受外在刺激影响而分心"
            },
            {
              "key": "IA.9",
              "text": "在日常生活中忘东忘西的"
            }
          ]
        },
        {
          "key": "HI",
          "name": "过动与冲动",
          "options": "main",
          "items": [
            {
              "key": "HI.10",
              "text": "在座位上玩弄手脚或不好好坐着"
            },
            {
              "key": "HI.11",
              "text": "在教室或其他必须持续坐着的场合，会任意离开座位"
            },
            {
              "key": "HI.12",
              "text": "在不适当的场合，乱跑或爬高爬低"
            },
            {
              "key": "HI.13",
              "text": "很难安静地玩或参与休闲活动"
            },
            {
              "key": "HI.14",
              "text": "总是一直在动或是像被马达所驱动"
            },
            {
              "key": "HI.15",
              "text": "话很多"
            },
            {
              "key": "HI.16",
              "text": "在问题还没问完前就急着回答"
            },
            {
              "key": "HI.17",
              "text": "在游戏中或团体活动中，无法排队或等待轮流"
            },
            {
              "key": "HI.18",
              "text": "打断或干扰别人(例如：插嘴或打断别人的游戏)"
            }
          ]
        },
        {
          "key": "OD",
          "name": "对立违抗",
          "options": "main",
          "items": [
            {
              "key": "OD.19",
              "text": "发脾气"
            },
            {
              "key": "OD.20",
              "text": "与大人争论"
            },
            {
              "key": "OD.21",
              "text": "主动地反抗或拒绝大人的要求与规定"
            },
            {
              "key": "OD.22",
              "text": "故意地做一些事去干扰别人"
            },
            {
              "key": "OD.23",
              "text": "因自己犯的错或不适当的行为而怪罪别人"
            },
            {
              "key": "OD.24",
              "text": "易怒的或很容易被别人激怒"
            },
            {
              "key": "OD.25",
              "text": "生气的及怨恨的"
            },
            {
              "key": "OD.26",
              "text": "恶意的或有报复心的"
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "ATT",
    "ref": {
      "IA": [
        1.2,
        1.8
      ],
      "HI": [
        1.2,
        1.8
      ],
      "OD": [
        1.2,
        1.8
      ]
    },
    "levels": [
      "低于参考点",
      "高于关注参考点",
      "高于诊断参考点"
    ],
    "grade": [
      0,
      1,
      3
    ]
  }
};
