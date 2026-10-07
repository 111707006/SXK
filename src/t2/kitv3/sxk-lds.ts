/**
 * SXK-LDS（森心康学习障碍量表 · 中学完整版）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_学习障碍量表_中学完整版_SXK-LDS.html（sha256 31e928c8ae34…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-LDS",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_学习障碍量表_中学完整版_SXK-LDS.html",
    "sha256": "31e928c8ae346370e8ea6cfe4428b92029628b5beab76cbe8775ca1215d9f548"
  },
  "title": "森心康学习障碍量表 · 中学完整版",
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
          "name": "识字与阅读流畅",
          "options": "main",
          "items": [
            {
              "key": "RD.1",
              "text": "朗读时读错字或跳字，需要回头重读",
              "minGrade": 7
            },
            {
              "key": "RD.2",
              "text": "阅读速度明显比同学慢，考试常读不完题目",
              "minGrade": 7
            },
            {
              "key": "RD.3",
              "text": "念课文时不顺，断句奇怪",
              "minGrade": 7
            },
            {
              "key": "RD.4",
              "text": "认得字，但读音常错（多音字、形声字）",
              "minGrade": 7
            },
            {
              "key": "RD.5",
              "text": "读到没学过的词就卡住，无法拼读出来",
              "minGrade": 7
            },
            {
              "key": "RD.6",
              "text": "阅读时需要用手指或尺辅助才读得下去",
              "minGrade": 7
            },
            {
              "key": "RD.7",
              "text": "长时间阅读后眼睛疲劳、注意力涣散",
              "minGrade": 7
            },
            {
              "key": "RD.8",
              "text": "学科术语反复出现，仍记不住怎么念",
              "minGrade": 7
            },
            {
              "key": "RD.9",
              "text": "默读时必须出声或动嘴才读得下去",
              "minGrade": 7
            },
            {
              "key": "RD.10",
              "text": "抗拒在课堂上朗读",
              "minGrade": 7
            },
            {
              "key": "RD.11",
              "text": "文言文或古诗词的字音特别吃力",
              "minGrade": 7
            },
            {
              "key": "RD.12",
              "text": "英语单词的拼读明显吃力",
              "minGrade": 7
            }
          ]
        },
        {
          "key": "RC",
          "name": "阅读理解与学科阅读",
          "options": "main",
          "items": [
            {
              "key": "RC.13",
              "text": "读完一段，说不出重点在哪",
              "minGrade": 7
            },
            {
              "key": "RC.14",
              "text": "字都读得懂，却说不出整段在讲什么",
              "minGrade": 7
            },
            {
              "key": "RC.15",
              "text": "数理应用题读不懂题意，题目讲给他听就会做",
              "minGrade": 7
            },
            {
              "key": "RC.16",
              "text": "读不懂题目里的条件与限制（除了、至少、不包括）",
              "minGrade": 7
            },
            {
              "key": "RC.17",
              "text": "无法从上下文推论没学过的词",
              "minGrade": 7
            },
            {
              "key": "RC.18",
              "text": "看不懂图表、说明文与实验步骤",
              "minGrade": 7
            },
            {
              "key": "RC.19",
              "text": "读长文时，前面读了后面就忘",
              "minGrade": 7
            },
            {
              "key": "RC.20",
              "text": "分不清作者的立场与客观事实",
              "minGrade": 7
            },
            {
              "key": "RC.21",
              "text": "需要别人讲解一遍才读得懂课本",
              "minGrade": 7
            },
            {
              "key": "RC.22",
              "text": "读不出文章的隐含意思或修辞",
              "minGrade": 8
            },
            {
              "key": "RC.23",
              "text": "自习时看课本没有效果，只能靠听讲",
              "minGrade": 8
            },
            {
              "key": "RC.24",
              "text": "读论说文、议论文特别吃力",
              "minGrade": 10
            }
          ]
        },
        {
          "key": "WR",
          "name": "书写与抄写速度",
          "options": "main",
          "items": [
            {
              "key": "WR.25",
              "text": "抄板书跟不上，笔记不完整",
              "minGrade": 7
            },
            {
              "key": "WR.26",
              "text": "字迹潦草，自己回头也看不懂",
              "minGrade": 7
            },
            {
              "key": "WR.27",
              "text": "书写速度慢，考试写不完",
              "minGrade": 7
            },
            {
              "key": "WR.28",
              "text": "写字容易手酸，明显抗拒动笔",
              "minGrade": 7
            },
            {
              "key": "WR.29",
              "text": "抄写常漏字、跳行",
              "minGrade": 7
            },
            {
              "key": "WR.30",
              "text": "同一个字有好几种不同写法",
              "minGrade": 7
            },
            {
              "key": "WR.31",
              "text": "错别字多，反复订正仍会出现",
              "minGrade": 7
            },
            {
              "key": "WR.32",
              "text": "标点符号漏写或用错",
              "minGrade": 7
            },
            {
              "key": "WR.33",
              "text": "笔记杂乱，事后无法拿来复习",
              "minGrade": 7
            },
            {
              "key": "WR.34",
              "text": "英文拼写错误频繁",
              "minGrade": 7
            },
            {
              "key": "WR.35",
              "text": "数学算式写得乱，导致自己看错",
              "minGrade": 7
            },
            {
              "key": "WR.36",
              "text": "用电脑打字明显比手写顺很多",
              "minGrade": 7
            }
          ]
        },
        {
          "key": "WE",
          "name": "书面表达与作文组织",
          "options": "main",
          "items": [
            {
              "key": "WE.37",
              "text": "口头说得清楚，写出来差很多",
              "minGrade": 7
            },
            {
              "key": "WE.38",
              "text": "作文不知道怎么开头",
              "minGrade": 7
            },
            {
              "key": "WE.39",
              "text": "文章结构松散，前后接不起来",
              "minGrade": 7
            },
            {
              "key": "WE.40",
              "text": "作文字数写不出来，常常不足",
              "minGrade": 7
            },
            {
              "key": "WE.41",
              "text": "想得到内容，但组织不成段落",
              "minGrade": 7
            },
            {
              "key": "WE.42",
              "text": "语句不通顺，缺主语或词序颠倒",
              "minGrade": 7
            },
            {
              "key": "WE.43",
              "text": "不会分段，整篇挤成一大块",
              "minGrade": 7
            },
            {
              "key": "WE.44",
              "text": "无法依提纲把一篇文章写完整",
              "minGrade": 7
            },
            {
              "key": "WE.45",
              "text": "检查自己的文章，看不出错在哪里",
              "minGrade": 7
            },
            {
              "key": "WE.46",
              "text": "申论题只写得出零碎的要点",
              "minGrade": 8
            },
            {
              "key": "WE.47",
              "text": "读书报告、小论文不知道从何写起",
              "minGrade": 10
            },
            {
              "key": "WE.48",
              "text": "引用与举例用不上，只会复述课本",
              "minGrade": 10
            }
          ]
        },
        {
          "key": "MA",
          "name": "数学与数量推理",
          "options": "main",
          "items": [
            {
              "key": "MA.49",
              "text": "基本四则运算不熟练，仍要靠计算器",
              "minGrade": 7
            },
            {
              "key": "MA.50",
              "text": "记不住公式，或记住了不会用",
              "minGrade": 7
            },
            {
              "key": "MA.51",
              "text": "代数符号的意义理解困难",
              "minGrade": 7
            },
            {
              "key": "MA.52",
              "text": "应用题不知道该用哪一个公式",
              "minGrade": 7
            },
            {
              "key": "MA.53",
              "text": "计算过程频繁出现不规律的错误",
              "minGrade": 7
            },
            {
              "key": "MA.54",
              "text": "分数、小数、百分比互相换算困难",
              "minGrade": 7
            },
            {
              "key": "MA.55",
              "text": "几何图形的空间关系理解困难",
              "minGrade": 7
            },
            {
              "key": "MA.56",
              "text": "比例、估算、单位换算薄弱",
              "minGrade": 7
            },
            {
              "key": "MA.57",
              "text": "看不懂统计图表",
              "minGrade": 7
            },
            {
              "key": "MA.58",
              "text": "金钱、时间等日常数量规划困难",
              "minGrade": 7
            },
            {
              "key": "MA.59",
              "text": "函数与坐标的概念理解困难",
              "minGrade": 8
            },
            {
              "key": "MA.60",
              "text": "物理、化学的计算题特别吃力",
              "minGrade": 8
            }
          ]
        },
        {
          "key": "LG",
          "name": "语言处理与外语学习",
          "options": "main",
          "items": [
            {
              "key": "LG.61",
              "text": "听课时跟不上老师说话的速度",
              "minGrade": 7
            },
            {
              "key": "LG.62",
              "text": "口头回答需要很长时间才组织得出来",
              "minGrade": 7
            },
            {
              "key": "LG.63",
              "text": "说话词不达意、绕圈子",
              "minGrade": 7
            },
            {
              "key": "LG.64",
              "text": "记不住口头交代的事情",
              "minGrade": 7
            },
            {
              "key": "LG.65",
              "text": "一次交代多个步骤的指令做不到",
              "minGrade": 7
            },
            {
              "key": "LG.66",
              "text": "英语听力理解明显吃力",
              "minGrade": 7
            },
            {
              "key": "LG.67",
              "text": "英语单词背了就忘",
              "minGrade": 7
            },
            {
              "key": "LG.68",
              "text": "外语的发音与拼读规则掌握不了",
              "minGrade": 7
            },
            {
              "key": "LG.69",
              "text": "课堂讨论时插不上话",
              "minGrade": 7
            },
            {
              "key": "LG.70",
              "text": "把一件事的来龙去脉说清楚有困难",
              "minGrade": 7
            },
            {
              "key": "LG.71",
              "text": "记不住人名、地名、年代等名词",
              "minGrade": 7
            },
            {
              "key": "LG.72",
              "text": "口头报告的表现明显低于书面作业",
              "minGrade": 8
            }
          ]
        },
        {
          "key": "EF",
          "name": "学习组织、时间管理与考试策略",
          "options": "main",
          "items": [
            {
              "key": "EF.73",
              "text": "作业常忘记交，或忘记有作业",
              "minGrade": 7
            },
            {
              "key": "EF.74",
              "text": "开始写作业困难，一再拖延",
              "minGrade": 7
            },
            {
              "key": "EF.75",
              "text": "不会安排复习的先后顺序",
              "minGrade": 7
            },
            {
              "key": "EF.76",
              "text": "考试时间分配不当，来不及写完",
              "minGrade": 7
            },
            {
              "key": "EF.77",
              "text": "多科并行时，优先级混乱",
              "minGrade": 7
            },
            {
              "key": "EF.78",
              "text": "书包、文件、讲义杂乱，常找不到",
              "minGrade": 7
            },
            {
              "key": "EF.79",
              "text": "长期作业（报告、专题）无法按进度完成",
              "minGrade": 7
            },
            {
              "key": "EF.80",
              "text": "上课容易走神，要靠事后补笔记",
              "minGrade": 7
            },
            {
              "key": "EF.81",
              "text": "考前才临时抱佛脚",
              "minGrade": 7
            },
            {
              "key": "EF.82",
              "text": "手机、社交媒体一拿起来就停不下来",
              "minGrade": 7
            },
            {
              "key": "EF.83",
              "text": "考试容易紧张到影响表现",
              "minGrade": 7
            },
            {
              "key": "EF.84",
              "text": "读书计划订了做不到",
              "minGrade": 8
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
      7,
      12
    ]
  }
};
