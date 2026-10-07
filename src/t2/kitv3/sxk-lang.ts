/**
 * SXK-LANG（森心康语言能力发展量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_语言能力发展量表_完整版_SXK-LANG.html（sha256 cbc0bd9590b4…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-LANG",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_语言能力发展量表_完整版_SXK-LANG.html",
    "sha256": "cbc0bd9590b486d5ebfc17ff90a500bdf506af1d9e0efa548e914e484aae6edb"
  },
  "title": "森心康语言能力发展量表 · 完整版",
  "family": "pct",
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
    ]
  },
  "forms": [
    {
      "key": "p",
      "name": "家长报告版",
      "sections": [
        {
          "key": "PL",
          "name": "前语言与互动基础",
          "options": "main",
          "items": [
            {
              "key": "PL.1",
              "text": "对突然的声音有反应（眨眼、停住、惊动）",
              "month": 0
            },
            {
              "key": "PL.2",
              "text": "被抱起或有人对他说话时会看着人的脸",
              "month": 1
            },
            {
              "key": "PL.3",
              "text": "眼神会跟着大人的脸移动",
              "month": 2
            },
            {
              "key": "PL.4",
              "text": "心情好时会发出咕咕声",
              "month": 3
            },
            {
              "key": "PL.5",
              "text": "听到熟悉的声音会转头去找",
              "month": 4
            },
            {
              "key": "PL.6",
              "text": "会对人笑，并等着大人回应",
              "month": 4
            },
            {
              "key": "PL.7",
              "text": "会发出连续的声音玩声音（ba-ba、da-da）",
              "month": 6
            },
            {
              "key": "PL.8",
              "text": "会跟大人轮流发声（你一声、我一声）",
              "month": 8
            },
            {
              "key": "PL.9",
              "text": "会模仿大人的动作（拍手、再见）",
              "month": 10
            },
            {
              "key": "PL.10",
              "text": "会顺着大人手指的方向看过去",
              "month": 10
            },
            {
              "key": "PL.11",
              "text": "会用手指指出自己想要的东西",
              "month": 11
            },
            {
              "key": "PL.12",
              "text": "会指东西给大人看（分享，而不是要）",
              "month": 12
            },
            {
              "key": "PL.13",
              "text": "会拿东西给大人看，或请大人帮忙",
              "month": 12
            },
            {
              "key": "PL.14",
              "text": "会模仿新听到的声音或语调",
              "month": 12
            }
          ]
        },
        {
          "key": "RC",
          "name": "听觉理解",
          "options": "main",
          "items": [
            {
              "key": "RC.1",
              "text": "听到声音会转头找",
              "month": 3
            },
            {
              "key": "RC.2",
              "text": "叫名字会回应",
              "month": 9
            },
            {
              "key": "RC.3",
              "text": "听得懂「不可以」并停下来",
              "month": 12
            },
            {
              "key": "RC.4",
              "text": "听得懂「过来」「给我」",
              "month": 14
            },
            {
              "key": "RC.5",
              "text": "能依单一指令行动（把球给我）",
              "month": 15
            },
            {
              "key": "RC.6",
              "text": "能指认常见物品（杯子、鞋子）",
              "month": 18
            },
            {
              "key": "RC.7",
              "text": "能指认身体部位",
              "month": 18
            },
            {
              "key": "RC.8",
              "text": "听得懂常见的动作词（吃、抱、睡）",
              "month": 21
            },
            {
              "key": "RC.9",
              "text": "听得懂「大／小」",
              "month": 24
            },
            {
              "key": "RC.10",
              "text": "能从三、四样东西里拿对指定的那一样",
              "month": 24
            },
            {
              "key": "RC.11",
              "text": "能依两步骤指令行动",
              "month": 30
            },
            {
              "key": "RC.12",
              "text": "听得懂「你的／我的」",
              "month": 30
            },
            {
              "key": "RC.13",
              "text": "听得懂位置词（上面、里面、后面）",
              "month": 36
            },
            {
              "key": "RC.14",
              "text": "听得懂「谁／哪里／什么」的提问",
              "month": 36
            },
            {
              "key": "RC.15",
              "text": "听得懂颜色词",
              "month": 36
            },
            {
              "key": "RC.16",
              "text": "听得懂数量词（一个、很多、都）",
              "month": 36
            },
            {
              "key": "RC.17",
              "text": "听得懂「为什么／怎么办」",
              "month": 48
            },
            {
              "key": "RC.18",
              "text": "听完一小段话能回答细节",
              "month": 48
            },
            {
              "key": "RC.19",
              "text": "听得懂三步骤指令",
              "month": 54
            },
            {
              "key": "RC.20",
              "text": "能理解因果关系的说法（因为下雨，所以……）",
              "month": 54
            },
            {
              "key": "RC.21",
              "text": "听得懂比较复杂的长句",
              "month": 60
            },
            {
              "key": "RC.22",
              "text": "听得懂「先……再……」「除了……以外」",
              "month": 66
            },
            {
              "key": "RC.23",
              "text": "听得懂玩笑话、夸张或反话",
              "month": 72
            },
            {
              "key": "RC.24",
              "text": "能听懂并做到课堂上的多步骤交代",
              "month": 78
            },
            {
              "key": "RC.25",
              "text": "听老师讲解后能抓到重点",
              "month": 90
            },
            {
              "key": "RC.26",
              "text": "听得懂含条件的句子（如果……就……）",
              "month": 96
            },
            {
              "key": "RC.27",
              "text": "听完一段说明能复述主要内容",
              "month": 108
            },
            {
              "key": "RC.28",
              "text": "能听出说话者的语气与言外之意",
              "month": 120
            }
          ]
        },
        {
          "key": "EX",
          "name": "口语表达",
          "options": "main",
          "items": [
            {
              "key": "EX.1",
              "text": "会用声音表达情绪（舒服、不高兴）",
              "month": 6
            },
            {
              "key": "EX.2",
              "text": "会用声音引起大人注意",
              "month": 9
            },
            {
              "key": "EX.3",
              "text": "会说出有意义的第一个词",
              "month": 14
            },
            {
              "key": "EX.4",
              "text": "会说五个以上的词",
              "month": 16
            },
            {
              "key": "EX.5",
              "text": "会说十个以上的词",
              "month": 18
            },
            {
              "key": "EX.6",
              "text": "会用词表达需求（要、不要）",
              "month": 18
            },
            {
              "key": "EX.7",
              "text": "会说五十个以上的词",
              "month": 21
            },
            {
              "key": "EX.8",
              "text": "会把两个词组起来（喝水、妈妈抱）",
              "month": 24
            },
            {
              "key": "EX.9",
              "text": "会说自己的名字",
              "month": 30
            },
            {
              "key": "EX.10",
              "text": "会用动词讲正在做的事",
              "month": 30
            },
            {
              "key": "EX.11",
              "text": "会说三到四个词的句子",
              "month": 33
            },
            {
              "key": "EX.12",
              "text": "会用「我」「你」等称呼",
              "month": 36
            },
            {
              "key": "EX.13",
              "text": "会问「这是什么」",
              "month": 36
            },
            {
              "key": "EX.14",
              "text": "会说自己几岁",
              "month": 36
            },
            {
              "key": "EX.15",
              "text": "会用「在／的／了」等虚词",
              "month": 42
            },
            {
              "key": "EX.16",
              "text": "能讲出刚刚发生的一件事",
              "month": 42
            },
            {
              "key": "EX.17",
              "text": "会用形容词描述（大的、红的、软的）",
              "month": 48
            },
            {
              "key": "EX.18",
              "text": "能描述图片里在发生什么事",
              "month": 48
            },
            {
              "key": "EX.19",
              "text": "会用「和／还有」把两件事连起来",
              "month": 48
            },
            {
              "key": "EX.20",
              "text": "能按顺序讲完一个短故事",
              "month": 54
            },
            {
              "key": "EX.21",
              "text": "会用「因为／所以」",
              "month": 54
            },
            {
              "key": "EX.22",
              "text": "能说出反义词",
              "month": 54
            },
            {
              "key": "EX.23",
              "text": "能说出物品的用途与类别",
              "month": 54
            },
            {
              "key": "EX.24",
              "text": "能讲出等一下要做的事",
              "month": 60
            },
            {
              "key": "EX.25",
              "text": "能清楚交代一件事的人、时间、地点",
              "month": 66
            },
            {
              "key": "EX.26",
              "text": "能把一天发生的事讲成完整的一段",
              "month": 72
            },
            {
              "key": "EX.27",
              "text": "能把游戏或活动的规则说给别人听",
              "month": 78
            },
            {
              "key": "EX.28",
              "text": "能用口语说明自己的想法与理由",
              "month": 90
            },
            {
              "key": "EX.29",
              "text": "能针对一个主题讲两三分钟不离题",
              "month": 102
            },
            {
              "key": "EX.30",
              "text": "能用比较正式的说法做简短报告",
              "month": 114
            }
          ]
        },
        {
          "key": "AR",
          "name": "语音清晰度与流畅度",
          "options": "main",
          "items": [
            {
              "key": "AR.1",
              "text": "会模仿大人的语音",
              "month": 12
            },
            {
              "key": "AR.2",
              "text": "发音时嘴型有变化",
              "month": 15
            },
            {
              "key": "AR.3",
              "text": "家人能听懂他说的大部分内容",
              "month": 24
            },
            {
              "key": "AR.4",
              "text": "能正确说出常见字词的音",
              "month": 30
            },
            {
              "key": "AR.5",
              "text": "说话音量适中",
              "month": 36
            },
            {
              "key": "AR.6",
              "text": "声音音质正常（不沙哑、不过度鼻音）",
              "month": 36
            },
            {
              "key": "AR.7",
              "text": "不熟的人能听懂他说的大部分内容",
              "month": 42
            },
            {
              "key": "AR.8",
              "text": "说话速度适中",
              "month": 42
            },
            {
              "key": "AR.9",
              "text": "少有明显的语音替代（如把「哥哥」说成「多多」）",
              "month": 48
            },
            {
              "key": "AR.10",
              "text": "少有语音省略（如把「飞机」说成「飞一」）",
              "month": 48
            },
            {
              "key": "AR.11",
              "text": "说话流畅、少有卡顿",
              "month": 48
            },
            {
              "key": "AR.12",
              "text": "不会重复第一个字或第一个音",
              "month": 48
            },
            {
              "key": "AR.13",
              "text": "说话时不会伴随明显的用力、挤眉或跺脚",
              "month": 48
            },
            {
              "key": "AR.14",
              "text": "长句子也能说清楚",
              "month": 54
            },
            {
              "key": "AR.15",
              "text": "陌生人几乎都听得懂他说的话",
              "month": 60
            },
            {
              "key": "AR.16",
              "text": "卷舌音、送气音大致正确",
              "month": 66
            },
            {
              "key": "AR.17",
              "text": "朗读课文时清楚流畅",
              "month": 78
            },
            {
              "key": "AR.18",
              "text": "紧张或兴奋时说话仍不至于让人听不懂",
              "month": 84
            }
          ]
        },
        {
          "key": "PR",
          "name": "沟通功能与语用",
          "options": "main",
          "items": [
            {
              "key": "PR.1",
              "text": "会用哭以外的方式表达需求",
              "month": 9
            },
            {
              "key": "PR.2",
              "text": "会用手势表达",
              "month": 12
            },
            {
              "key": "PR.3",
              "text": "会主动叫人引起注意",
              "month": 15
            },
            {
              "key": "PR.4",
              "text": "会用语言或手势要求帮忙",
              "month": 18
            },
            {
              "key": "PR.5",
              "text": "会用语言拒绝或表示不要",
              "month": 24
            },
            {
              "key": "PR.6",
              "text": "会打招呼或说再见",
              "month": 24
            },
            {
              "key": "PR.7",
              "text": "会回应别人的问话",
              "month": 30
            },
            {
              "key": "PR.8",
              "text": "会说谢谢、对不起",
              "month": 36
            },
            {
              "key": "PR.9",
              "text": "会提问（这是什么、为什么）",
              "month": 36
            },
            {
              "key": "PR.10",
              "text": "会和同伴用语言一起玩",
              "month": 42
            },
            {
              "key": "PR.11",
              "text": "能和大人来回对话三轮以上",
              "month": 42
            },
            {
              "key": "PR.12",
              "text": "会主动开启话题",
              "month": 48
            },
            {
              "key": "PR.13",
              "text": "会等对方说完再说",
              "month": 48
            },
            {
              "key": "PR.14",
              "text": "话题偏离时能被拉回来",
              "month": 48
            },
            {
              "key": "PR.15",
              "text": "会依对象调整说话方式（对大人／对小小孩）",
              "month": 60
            },
            {
              "key": "PR.16",
              "text": "能察觉对方没听懂，并换个说法重说",
              "month": 60
            },
            {
              "key": "PR.17",
              "text": "会用语言解决冲突",
              "month": 60
            },
            {
              "key": "PR.18",
              "text": "会看场合调整音量与用词",
              "month": 72
            },
            {
              "key": "PR.19",
              "text": "能在团体里轮流发言",
              "month": 78
            },
            {
              "key": "PR.20",
              "text": "会用语言协商、说服别人",
              "month": 84
            },
            {
              "key": "PR.21",
              "text": "听得懂也会用婉转、客气的说法",
              "month": 96
            },
            {
              "key": "PR.22",
              "text": "能察觉别人的情绪并用语言回应",
              "month": 96
            },
            {
              "key": "PR.23",
              "text": "能在冲突中说明自己的立场而不失礼",
              "month": 108
            },
            {
              "key": "PR.24",
              "text": "能看对方懂多少，调整解释的详略",
              "month": 120
            }
          ]
        },
        {
          "key": "LS",
          "name": "语言学习与叙事（学龄）",
          "options": "main",
          "items": [
            {
              "key": "LS.1",
              "text": "能听出两个词押不押韵",
              "month": 60
            },
            {
              "key": "LS.2",
              "text": "能听出一个词的第一个音",
              "month": 66
            },
            {
              "key": "LS.3",
              "text": "能把一个词拆成一个一个音节",
              "month": 72
            },
            {
              "key": "LS.4",
              "text": "能说出一个常见词的意思",
              "month": 72
            },
            {
              "key": "LS.5",
              "text": "能说出两样东西的相同与不同",
              "month": 78
            },
            {
              "key": "LS.6",
              "text": "能复述刚听完的一段话",
              "month": 78
            },
            {
              "key": "LS.7",
              "text": "能按起因—经过—结果讲一个故事",
              "month": 84
            },
            {
              "key": "LS.8",
              "text": "能理解并使用课本上的词语",
              "month": 84
            },
            {
              "key": "LS.9",
              "text": "能从上下文猜出没学过的词",
              "month": 90
            },
            {
              "key": "LS.10",
              "text": "能回答需要推论的问题（他为什么会这样做）",
              "month": 90
            },
            {
              "key": "LS.11",
              "text": "能说出一段文字的重点",
              "month": 96
            },
            {
              "key": "LS.12",
              "text": "能听清楚并转述老师交代的事情",
              "month": 96
            },
            {
              "key": "LS.13",
              "text": "能分辨事实与意见",
              "month": 108
            },
            {
              "key": "LS.14",
              "text": "能有条理地说明一件事的步骤",
              "month": 108
            },
            {
              "key": "LS.15",
              "text": "能理解成语或比喻的意思",
              "month": 114
            },
            {
              "key": "LS.16",
              "text": "能依不同主题使用合适的词汇",
              "month": 120
            },
            {
              "key": "LS.17",
              "text": "能口头组织一段有论点也有例子的话",
              "month": 126
            },
            {
              "key": "LS.18",
              "text": "能理解并使用被动句、转折句等复杂句式",
              "month": 132
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
        "min": 50,
        "name": "建议安排语言治疗评估"
      },
      {
        "min": 0,
        "name": "建议尽快安排完整评估"
      }
    ],
    "minItems": 3,
    "sectionMaxMonth": {
      "PL": 60
    }
  }
};
