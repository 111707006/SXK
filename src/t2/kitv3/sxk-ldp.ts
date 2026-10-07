/**
 * SXK-LDP（森心康学习障碍量表 · 完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_学习障碍量表_完整版_SXK-LDP.html（sha256 489845bd3a29…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-LDP",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_学习障碍量表_完整版_SXK-LDP.html",
    "sha256": "489845bd3a29894aeceda704e3ddb4b47df806fb3ff634bc7aff300575d8f625"
  },
  "title": "森心康学习障碍量表 · 完整版",
  "family": "ld",
  "options": {
    "main": [
      {
        "value": 0,
        "label": "从未",
        "hint": "没有出现"
      },
      {
        "value": 1,
        "label": "偶尔",
        "hint": "每月一两次"
      },
      {
        "value": 2,
        "label": "经常",
        "hint": "每周好几次"
      },
      {
        "value": 3,
        "label": "总是",
        "hint": "几乎每天"
      }
    ]
  },
  "forms": [
    {
      "key": "p",
      "name": "家长版",
      "sections": [
        {
          "key": "RD",
          "name": "识字与朗读流畅",
          "options": "main",
          "items": [
            {
              "key": "RD.1",
              "text": "认读拼音容易出错，掌握得不牢",
              "minGrade": 1,
              "maxGrade": 4
            },
            {
              "key": "RD.2",
              "text": "朗读速度偏慢，习惯一个字一个字地读",
              "minGrade": 1
            },
            {
              "key": "RD.3",
              "text": "朗读时漏字、跳行，或把同一行重复读",
              "minGrade": 1
            },
            {
              "key": "RD.4",
              "text": "分不清字形相近的字（如：己／已、末／未）",
              "minGrade": 1
            },
            {
              "key": "RD.5",
              "text": "朗读时常靠猜字，或把词换成别的词念出来",
              "minGrade": 1
            },
            {
              "key": "RD.6",
              "text": "常见字反复教过，仍然认不出来",
              "minGrade": 1
            },
            {
              "key": "RD.7",
              "text": "同一个字在课本上认得，换个地方就不认得",
              "minGrade": 2
            },
            {
              "key": "RD.8",
              "text": "朗读时不理会标点，一路读下去",
              "minGrade": 2
            },
            {
              "key": "RD.9",
              "text": "需要用手指或尺压着才读得下去",
              "minGrade": 1
            },
            {
              "key": "RD.10",
              "text": "念错多音字或形声字的读音",
              "minGrade": 3
            },
            {
              "key": "RD.11",
              "text": "阅读速度明显跟不上课堂进度",
              "minGrade": 3
            },
            {
              "key": "RD.12",
              "text": "抗拒朗读，或要读出声时特别紧张",
              "minGrade": 1
            }
          ]
        },
        {
          "key": "RC",
          "name": "阅读理解",
          "options": "main",
          "items": [
            {
              "key": "RC.13",
              "text": "读完一段话，说不出在讲什么",
              "minGrade": 1
            },
            {
              "key": "RC.14",
              "text": "听别人讲能听懂，自己读同样的内容却理解不了",
              "minGrade": 1
            },
            {
              "key": "RC.15",
              "text": "回答课文相关的问题，需要一再重读",
              "minGrade": 2
            },
            {
              "key": "RC.16",
              "text": "应用题读不懂题意，但题目念给他听就会做",
              "minGrade": 2
            },
            {
              "key": "RC.17",
              "text": "抓不到一段文章的重点",
              "minGrade": 3
            },
            {
              "key": "RC.18",
              "text": "无法从上下文猜出没学过的词",
              "minGrade": 3
            },
            {
              "key": "RC.19",
              "text": "需要别人把课文讲解一遍才读得懂",
              "minGrade": 3
            },
            {
              "key": "RC.20",
              "text": "读长一点的文章，前面读了后面就忘",
              "minGrade": 4
            },
            {
              "key": "RC.21",
              "text": "读不懂题目里的条件与限制（除了、至少、不包括）",
              "minGrade": 5
            },
            {
              "key": "RC.22",
              "text": "分不清文章里的事实与作者的看法",
              "minGrade": 7
            }
          ]
        },
        {
          "key": "WR",
          "name": "书写与抄写",
          "options": "main",
          "items": [
            {
              "key": "WR.23",
              "text": "握笔姿势不正确，或握得过紧、过于用力",
              "minGrade": 1
            },
            {
              "key": "WR.24",
              "text": "字迹潦草，别人很难认出写的是什么",
              "minGrade": 1
            },
            {
              "key": "WR.25",
              "text": "写字速度很慢，跟不上同学的进度",
              "minGrade": 1
            },
            {
              "key": "WR.26",
              "text": "抄写常出错，多一笔、少一笔或写成反字",
              "minGrade": 1
            },
            {
              "key": "WR.27",
              "text": "写字容易疲累，或明显抗拒动笔",
              "minGrade": 1
            },
            {
              "key": "WR.28",
              "text": "笔顺错误，纠正后仍旧写回原来的写法",
              "minGrade": 1
            },
            {
              "key": "WR.29",
              "text": "字的结构不匀称，常写出格子外",
              "minGrade": 1
            },
            {
              "key": "WR.30",
              "text": "抄黑板时要一笔一画看着抄，速度明显落后",
              "minGrade": 2
            },
            {
              "key": "WR.31",
              "text": "作业本上留下大量涂改的痕迹，或把纸擦破",
              "minGrade": 2
            },
            {
              "key": "WR.32",
              "text": "默写常常不及格，写不出来或交白卷",
              "minGrade": 2
            },
            {
              "key": "WR.33",
              "text": "同一个字在同一篇里有好几种不同写法",
              "minGrade": 3
            },
            {
              "key": "WR.34",
              "text": "标点符号漏写或用错",
              "minGrade": 3
            }
          ]
        },
        {
          "key": "WE",
          "name": "书面表达与组织",
          "options": "main",
          "items": [
            {
              "key": "WE.35",
              "text": "书写作业的水平比口头表达差很多",
              "minGrade": 3
            },
            {
              "key": "WE.36",
              "text": "作文只能勉强达意，句子不通顺",
              "minGrade": 3
            },
            {
              "key": "WE.37",
              "text": "作文的思路零乱，前后接不起来",
              "minGrade": 3
            },
            {
              "key": "WE.38",
              "text": "说话时会用的词，要写的时候写不出来",
              "minGrade": 3
            },
            {
              "key": "WE.39",
              "text": "重组句子、扩写句子的练习有困难",
              "minGrade": 3
            },
            {
              "key": "WE.40",
              "text": "检查自己的作业时，看不出错在哪里",
              "minGrade": 2
            },
            {
              "key": "WE.41",
              "text": "写出来的句子漏字或多字",
              "minGrade": 2
            },
            {
              "key": "WE.42",
              "text": "写作时语法错误多（缺主语、词序颠倒）",
              "minGrade": 3
            },
            {
              "key": "WE.43",
              "text": "作文字数明显少于同学，写不下去",
              "minGrade": 4
            },
            {
              "key": "WE.44",
              "text": "写读书报告或课堂笔记时，抓不住要写什么",
              "minGrade": 7
            },
            {
              "key": "WE.45",
              "text": "无法依提纲把一篇文章写完整",
              "minGrade": 7
            }
          ]
        },
        {
          "key": "MA",
          "name": "数学与数感",
          "options": "main",
          "items": [
            {
              "key": "MA.46",
              "text": "数数不稳，常数错或漏掉数字",
              "minGrade": 1,
              "maxGrade": 4
            },
            {
              "key": "MA.47",
              "text": "记不住加减乘除的基本口诀",
              "minGrade": 1
            },
            {
              "key": "MA.48",
              "text": "弄不清个位、十位、百位各代表什么",
              "minGrade": 1
            },
            {
              "key": "MA.49",
              "text": "难以比较数的大小或把数排出顺序",
              "minGrade": 1
            },
            {
              "key": "MA.50",
              "text": "计算时经常抄错数字或运算符号",
              "minGrade": 1
            },
            {
              "key": "MA.51",
              "text": "对时间、钱数这类数量概念理解困难",
              "minGrade": 1
            },
            {
              "key": "MA.52",
              "text": "要靠扳手指或画格子才能算简单的题",
              "minGrade": 2
            },
            {
              "key": "MA.53",
              "text": "学过的算法隔一阵子就忘光",
              "minGrade": 2
            },
            {
              "key": "MA.54",
              "text": "应用题不知道该用加还是用减",
              "minGrade": 2
            },
            {
              "key": "MA.55",
              "text": "分数、小数的意义理解不了",
              "minGrade": 4
            },
            {
              "key": "MA.56",
              "text": "几何图形的空间关系理解困难",
              "minGrade": 4
            },
            {
              "key": "MA.57",
              "text": "代数式的变换一再出错",
              "minGrade": 7
            }
          ]
        },
        {
          "key": "LG",
          "name": "口语与语言处理",
          "options": "main",
          "items": [
            {
              "key": "LG.58",
              "text": "会用的词明显比同龄孩子少",
              "minGrade": 1
            },
            {
              "key": "LG.59",
              "text": "一次交代好几个步骤的指令，做起来有困难",
              "minGrade": 1
            },
            {
              "key": "LG.60",
              "text": "分辨相近的音有困难（如：b／p、n／l）",
              "minGrade": 1,
              "maxGrade": 5
            },
            {
              "key": "LG.61",
              "text": "说话比较零乱，不容易组成完整的句子",
              "minGrade": 1
            },
            {
              "key": "LG.62",
              "text": "回答问题要想很久才说得出来",
              "minGrade": 1
            },
            {
              "key": "LG.63",
              "text": "背儿歌、念韵文明显吃力",
              "minGrade": 1,
              "maxGrade": 5
            },
            {
              "key": "LG.64",
              "text": "混淆读音相近的词",
              "minGrade": 1
            },
            {
              "key": "LG.65",
              "text": "不能复述刚听过的信息（电话号码、姓名、故事内容）",
              "minGrade": 1
            },
            {
              "key": "LG.66",
              "text": "口语里语法错误多",
              "minGrade": 1
            },
            {
              "key": "LG.67",
              "text": "说不清楚一件事的来龙去脉",
              "minGrade": 2
            },
            {
              "key": "LG.68",
              "text": "老师讲得快一点就跟不上",
              "minGrade": 3
            }
          ]
        },
        {
          "key": "AT",
          "name": "注意力、记忆与学习组织",
          "options": "main",
          "items": [
            {
              "key": "AT.69",
              "text": "上课时注意力容易涣散，常常走神",
              "minGrade": 1
            },
            {
              "key": "AT.70",
              "text": "常漏看作业的细节，或听漏交代的要求",
              "minGrade": 1
            },
            {
              "key": "AT.71",
              "text": "很难坐住把一份作业从头做完",
              "minGrade": 1
            },
            {
              "key": "AT.72",
              "text": "话还没说完就动手，行动比较冲动",
              "minGrade": 1
            },
            {
              "key": "AT.73",
              "text": "作业本、书包经常乱成一团",
              "minGrade": 1
            },
            {
              "key": "AT.74",
              "text": "常忘记当天要交的功课或该带的课本",
              "minGrade": 1
            },
            {
              "key": "AT.75",
              "text": "同一件事要重复提醒很多次才记得",
              "minGrade": 1
            },
            {
              "key": "AT.76",
              "text": "记人名、地名特别吃力",
              "minGrade": 2
            },
            {
              "key": "AT.77",
              "text": "写作业拖得很久，常做到很晚",
              "minGrade": 2
            },
            {
              "key": "AT.78",
              "text": "记不住比较复杂的课表或行程",
              "minGrade": 3
            },
            {
              "key": "AT.79",
              "text": "考试时间不够用，来不及写完",
              "minGrade": 4
            },
            {
              "key": "AT.80",
              "text": "不会安排复习的先后顺序",
              "minGrade": 5
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "LEARN",
    "levels": [
      {
        "min": 0,
        "name": "未见明显"
      },
      {
        "min": 17,
        "name": "轻微"
      },
      {
        "min": 34,
        "name": "中等"
      },
      {
        "min": 50,
        "name": "显著"
      }
    ],
    "gradeRange": [
      1,
      12
    ]
  }
};
