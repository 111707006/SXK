/**
 * SXK-VOC（森心康 0–3 词汇量检核表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_0-3词汇量检核表_完整版_SXK-VOC.html（sha256 07e12d30aea4…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-VOC",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_0-3词汇量检核表_完整版_SXK-VOC.html",
    "sha256": "07e12d30aea43c22566f4c0b3644699c866e1ee2bec470ec8623fb63b0a991d3"
  },
  "title": "森心康 0–3 词汇量检核表",
  "family": "voc",
  "options": {
    "main": [
      {
        "value": 2,
        "label": "已经会"
      },
      {
        "value": 1,
        "label": "偶尔会"
      },
      {
        "value": 0,
        "label": "还不会"
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
    ],
    "can": [
      {
        "value": 1,
        "label": "会"
      },
      {
        "value": 0,
        "label": "还不会"
      }
    ]
  },
  "forms": [
    {
      "key": "main",
      "name": "填表人",
      "sections": [
        {
          "key": "V1",
          "name": "理解词汇",
          "options": "main",
          "items": [
            {
              "key": "V1.1",
              "text": "听到自己的名字有反应",
              "month": 8
            },
            {
              "key": "V1.2",
              "text": "听得懂「不可以」",
              "month": 10
            },
            {
              "key": "V1.3",
              "text": "听得懂「爸爸」「妈妈」",
              "month": 10
            },
            {
              "key": "V1.4",
              "text": "能指认三种常见物品",
              "month": 15
            },
            {
              "key": "V1.5",
              "text": "听得懂常见动作词（吃、喝、抱）",
              "month": 15
            },
            {
              "key": "V1.6",
              "text": "听得懂十个以上的词",
              "month": 15
            },
            {
              "key": "V1.7",
              "text": "能指认五个以上物品",
              "month": 18
            },
            {
              "key": "V1.8",
              "text": "能指认身体部位",
              "month": 18
            },
            {
              "key": "V1.9",
              "text": "能指认图片中的物品",
              "month": 18
            },
            {
              "key": "V1.10",
              "text": "听得懂家中常见地点",
              "month": 20
            }
          ]
        },
        {
          "key": "V2",
          "name": "表达词汇",
          "options": "main",
          "items": [
            {
              "key": "V2.1",
              "text": "会用声音表达需求",
              "month": 9
            },
            {
              "key": "V2.2",
              "text": "会说第一个有意义的词",
              "month": 14
            },
            {
              "key": "V2.3",
              "text": "会说三个以上的词",
              "month": 16
            },
            {
              "key": "V2.4",
              "text": "会说五个以上的词",
              "month": 17
            },
            {
              "key": "V2.5",
              "text": "会说十个以上的词",
              "month": 18
            },
            {
              "key": "V2.6",
              "text": "会说二十个以上的词",
              "month": 21
            },
            {
              "key": "V2.7",
              "text": "会说五十个以上的词",
              "month": 24
            },
            {
              "key": "V2.8",
              "text": "会把两个词组起来",
              "month": 24
            },
            {
              "key": "V2.9",
              "text": "会说一百个以上的词",
              "month": 30
            },
            {
              "key": "V2.10",
              "text": "会说三个词的句子",
              "month": 33
            }
          ]
        },
        {
          "key": "V3",
          "name": "词类广度",
          "options": "main",
          "items": [
            {
              "key": "V3.1",
              "text": "会说人的称呼（爸爸、妈妈、阿姨）",
              "month": 14
            },
            {
              "key": "V3.2",
              "text": "会说食物的名称",
              "month": 18
            },
            {
              "key": "V3.3",
              "text": "会说日常用品的名称",
              "month": 18
            },
            {
              "key": "V3.4",
              "text": "会说身体部位的名称",
              "month": 20
            },
            {
              "key": "V3.5",
              "text": "会说动物的名称",
              "month": 20
            },
            {
              "key": "V3.6",
              "text": "会说动作词（抱、吃、走）",
              "month": 20
            },
            {
              "key": "V3.7",
              "text": "会说形容词（大、热、好吃）",
              "month": 26
            },
            {
              "key": "V3.8",
              "text": "会说方位词（上面、里面）",
              "month": 30
            },
            {
              "key": "V3.9",
              "text": "会说「我」「你」",
              "month": 30
            },
            {
              "key": "V3.10",
              "text": "会说数字或数量词",
              "month": 30
            }
          ]
        },
        {
          "key": "GEST",
          "name": "手势与沟通行为",
          "options": "hasnot",
          "items": [
            {
              "key": "gest.1",
              "text": "会把东西举起来给大人看",
              "maxMonth": 17
            },
            {
              "key": "gest.2",
              "text": "会用手指指想要的东西",
              "maxMonth": 17
            },
            {
              "key": "gest.3",
              "text": "会用手指指远处有趣的东西给大人看",
              "maxMonth": 17
            },
            {
              "key": "gest.4",
              "text": "会挥手再见",
              "maxMonth": 17
            },
            {
              "key": "gest.5",
              "text": "会摇头表示不要",
              "maxMonth": 17
            },
            {
              "key": "gest.6",
              "text": "会点头表示要",
              "maxMonth": 17
            },
            {
              "key": "gest.7",
              "text": "会伸手要抱",
              "maxMonth": 17
            },
            {
              "key": "gest.8",
              "text": "会把东西递给大人再拿回来（来回玩）",
              "maxMonth": 17
            },
            {
              "key": "gest.9",
              "text": "会拍手",
              "maxMonth": 17
            },
            {
              "key": "gest.10",
              "text": "会模仿大人的动作（打电话、梳头）",
              "maxMonth": 17
            },
            {
              "key": "gest.11",
              "text": "会用手势加声音来要求",
              "maxMonth": 17
            },
            {
              "key": "gest.12",
              "text": "会假装喂娃娃或自己假装吃",
              "maxMonth": 17
            },
            {
              "key": "gest.13",
              "text": "会飞吻或亲亲",
              "maxMonth": 17
            },
            {
              "key": "gest.14",
              "text": "会指自己的身体部位",
              "maxMonth": 17
            },
            {
              "key": "gest.15",
              "text": "会跟着做手指谣的动作",
              "maxMonth": 17
            },
            {
              "key": "gest.16",
              "text": "会用动作回答（问「鞋子呢」会去拿）",
              "maxMonth": 17
            },
            {
              "key": "gest.17",
              "text": "会拉大人的手去拿东西",
              "maxMonth": 17
            },
            {
              "key": "gest.18",
              "text": "会玩躲猫猫并期待下一步",
              "maxMonth": 17
            }
          ]
        },
        {
          "key": "GRAM",
          "name": "词组与句子",
          "options": "can",
          "items": [
            {
              "key": "gram.1",
              "text": "会把两个词连起来说（妈妈抱、要水水）",
              "month": 18
            },
            {
              "key": "gram.2",
              "text": "会说「不要＋东西」（不要吃、不要睡）",
              "month": 20
            },
            {
              "key": "gram.3",
              "text": "会用「我的」表示东西是他的",
              "month": 22
            },
            {
              "key": "gram.4",
              "text": "会说三个词以上的句子",
              "month": 26
            },
            {
              "key": "gram.5",
              "text": "会用「在＋地方」（在这里、在外面）",
              "month": 26
            },
            {
              "key": "gram.6",
              "text": "会用「了」表示做完了（吃完了、掉了）",
              "month": 26
            },
            {
              "key": "gram.7",
              "text": "会问「这是什么」",
              "month": 26
            },
            {
              "key": "gram.8",
              "text": "会用「和」把两样东西连起来",
              "month": 30
            },
            {
              "key": "gram.9",
              "text": "会用「因为」「所以」",
              "month": 33
            },
            {
              "key": "gram.10",
              "text": "会用「不是…是…」",
              "month": 33
            },
            {
              "key": "gram.11",
              "text": "会说过去发生的事（刚刚、昨天）",
              "month": 33
            },
            {
              "key": "gram.12",
              "text": "会问「为什么」「在哪里」",
              "month": 33
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
        "min": 80,
        "name": "发展中符合预期"
      },
      {
        "min": 60,
        "name": "部分项目待加强"
      },
      {
        "min": 0,
        "name": "建议进一步评估"
      }
    ],
    "grade": [
      0,
      1,
      3
    ]
  }
};
