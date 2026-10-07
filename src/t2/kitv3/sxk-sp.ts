/**
 * SXK-SP（森心康感觉处理记录量表）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_感觉处理记录量表_完整版_SXK-SP.html（sha256 618fe4e24c5c…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-SP",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_感觉处理记录量表_完整版_SXK-SP.html",
    "sha256": "618fe4e24c5cd577f19129774d0e1338fc598446ddef96d85bc662148a5e1bd4"
  },
  "title": "森心康感觉处理记录量表",
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
      "key": "H25",
      "name": "幼儿家庭版",
      "minM": 24,
      "maxM": 71,
      "sections": [
        {
          "key": "SO",
          "name": "社会参与",
          "options": "main",
          "items": [
            {
              "key": "H25.SO.1",
              "text": "和其他孩子一起玩时很快就起冲突或跑开"
            },
            {
              "key": "H25.SO.2",
              "text": "不会轮流或等待，抢先或放弃"
            },
            {
              "key": "H25.SO.3",
              "text": "跟不上其他孩子游戏的节奏或规则"
            },
            {
              "key": "H25.SO.4",
              "text": "在人多的地方（游乐场、聚会）明显退缩或失控"
            },
            {
              "key": "H25.SO.5",
              "text": "很少主动加入其他孩子"
            },
            {
              "key": "H25.SO.6",
              "text": "和大人互动比和孩子互动容易得多"
            },
            {
              "key": "H25.SO.7",
              "text": "玩的时候常常需要大人在旁边协调"
            }
          ]
        },
        {
          "key": "VI",
          "name": "视觉",
          "options": "main",
          "items": [
            {
              "key": "H25.VI.1",
              "text": "对强光或阳光特别不适"
            },
            {
              "key": "H25.VI.2",
              "text": "在图案复杂、东西多的环境中容易分心或不安"
            },
            {
              "key": "H25.VI.3",
              "text": "喜欢盯着旋转、闪烁的东西看"
            },
            {
              "key": "H25.VI.4",
              "text": "找东西时明明在眼前却看不到"
            },
            {
              "key": "H25.VI.5",
              "text": "看图画书时不容易跟着看，常常翻走"
            },
            {
              "key": "H25.VI.6",
              "text": "喜欢从特殊角度斜看东西"
            },
            {
              "key": "H25.VI.7",
              "text": "眼睛容易疲劳、揉眼"
            }
          ]
        },
        {
          "key": "AU",
          "name": "听觉",
          "options": "main",
          "items": [
            {
              "key": "H25.AU.1",
              "text": "对突然的声音（吸尘器、烘手机）过度反应"
            },
            {
              "key": "H25.AU.2",
              "text": "在吵杂环境中特别难专注或容易烦躁"
            },
            {
              "key": "H25.AU.3",
              "text": "会摀住耳朵"
            },
            {
              "key": "H25.AU.4",
              "text": "常常叫他没反应，但对小声音又很敏感"
            },
            {
              "key": "H25.AU.5",
              "text": "害怕特定的声音（打雷、气球、警报）"
            },
            {
              "key": "H25.AU.6",
              "text": "需要重复说好几次才听懂"
            },
            {
              "key": "H25.AU.7",
              "text": "自己制造声音或反复听同一段声音"
            }
          ]
        },
        {
          "key": "TA",
          "name": "触觉",
          "options": "main",
          "items": [
            {
              "key": "H25.TA.1",
              "text": "被轻轻碰到会过度反应（躲开、生气、哭）"
            },
            {
              "key": "H25.TA.2",
              "text": "讨厌某些衣物材质、标签或袜子接缝"
            },
            {
              "key": "H25.TA.3",
              "text": "不喜欢手弄脏（沙、颜料、黏土、胶水）"
            },
            {
              "key": "H25.TA.4",
              "text": "洗脸、剪指甲、剪头发特别抗拒"
            },
            {
              "key": "H25.TA.5",
              "text": "不喜欢被抱或被牵手"
            },
            {
              "key": "H25.TA.6",
              "text": "对疼痛反应特别大或特别小"
            },
            {
              "key": "H25.TA.7",
              "text": "很喜欢用力挤压、被紧紧抱住，或不停触摸经过的东西"
            }
          ]
        },
        {
          "key": "OR",
          "name": "口腔与味嗅觉",
          "options": "main",
          "items": [
            {
              "key": "H25.OR.1",
              "text": "对食物质地很挑（只吃软的或只吃脆的）"
            },
            {
              "key": "H25.OR.2",
              "text": "尝试新食物非常困难"
            },
            {
              "key": "H25.OR.3",
              "text": "经常咬东西（衣领、玩具、手指）"
            },
            {
              "key": "H25.OR.4",
              "text": "刷牙特别抗拒"
            },
            {
              "key": "H25.OR.5",
              "text": "吃饭时常把食物含在嘴里或容易作呕"
            },
            {
              "key": "H25.OR.6",
              "text": "对气味很敏感，闻到某些味道会拒绝或不舒服"
            },
            {
              "key": "H25.OR.7",
              "text": "喜欢闻东西或舔东西"
            }
          ]
        },
        {
          "key": "PR",
          "name": "本体觉与身体意识",
          "options": "main",
          "items": [
            {
              "key": "H25.PR.1",
              "text": "拿东西或涂画时力道控制不好（太用力或太轻）"
            },
            {
              "key": "H25.PR.2",
              "text": "经常撞到人或家具"
            },
            {
              "key": "H25.PR.3",
              "text": "动作显得笨拙、不协调"
            },
            {
              "key": "H25.PR.4",
              "text": "喜欢重压、钻进狭小空间"
            },
            {
              "key": "H25.PR.5",
              "text": "坐姿容易软趴，需要靠着或趴着"
            },
            {
              "key": "H25.PR.6",
              "text": "喜欢咬、啃、推重物"
            },
            {
              "key": "H25.PR.7",
              "text": "玩游戏时下手过重不自知"
            }
          ]
        },
        {
          "key": "VE",
          "name": "前庭觉与平衡",
          "options": "main",
          "items": [
            {
              "key": "H25.VE.1",
              "text": "特别怕高、怕脚离地（溜滑梯、荡秋千）"
            },
            {
              "key": "H25.VE.2",
              "text": "坐车、坐电梯容易不舒服或抗拒"
            },
            {
              "key": "H25.VE.3",
              "text": "头往后仰或倒立时特别恐惧"
            },
            {
              "key": "H25.VE.4",
              "text": "非常爱旋转、跳动而不觉得晕"
            },
            {
              "key": "H25.VE.5",
              "text": "经常动来动去、无法安静坐着"
            },
            {
              "key": "H25.VE.6",
              "text": "平衡动作明显比同龄吃力，跑步容易跌倒"
            },
            {
              "key": "H25.VE.7",
              "text": "上下楼梯或走不平的地面明显更依赖扶手或大人"
            }
          ]
        },
        {
          "key": "PL",
          "name": "动作计划与想法",
          "options": "main",
          "items": [
            {
              "key": "H25.PL.1",
              "text": "玩法单一，反复做同一个动作或同一种玩法"
            },
            {
              "key": "H25.PL.2",
              "text": "学新的动作或游戏比同龄孩子慢很多"
            },
            {
              "key": "H25.PL.3",
              "text": "不知道玩具可以怎么玩，需要大人示范"
            },
            {
              "key": "H25.PL.4",
              "text": "多步骤的事（穿衣、收玩具）做到一半就卡住"
            },
            {
              "key": "H25.PL.5",
              "text": "模仿动作时姿势不准确"
            },
            {
              "key": "H25.PL.6",
              "text": "不太会假装游戏（喂娃娃、开车车）"
            },
            {
              "key": "H25.PL.7",
              "text": "面对新的活动常说「不会」或直接放弃"
            }
          ]
        },
        {
          "key": "RG",
          "name": "调节与专注",
          "options": "main",
          "items": [
            {
              "key": "H25.RG.1",
              "text": "活动一多就明显亢奋、停不下来"
            },
            {
              "key": "H25.RG.2",
              "text": "转换环境后需要很久才能稳定"
            },
            {
              "key": "H25.RG.3",
              "text": "需要很长时间才能入睡"
            },
            {
              "key": "H25.RG.4",
              "text": "起床后需要很久才进入状况"
            },
            {
              "key": "H25.RG.5",
              "text": "一天中状态起伏很大"
            },
            {
              "key": "H25.RG.6",
              "text": "被打断后很难回到原本的活动"
            },
            {
              "key": "H25.RG.7",
              "text": "同时有多种刺激时会崩溃"
            }
          ]
        },
        {
          "key": "IMP",
          "name": "有没有影响到日常参与",
          "options": "hasnot",
          "items": [
            {
              "key": "imp.adl",
              "text": "影响生活自理（穿衣、洗澡、剪指甲、刷牙、进食）"
            },
            {
              "key": "imp.sch",
              "text": "影响入园／上学适应或团体活动参与"
            },
            {
              "key": "imp.soc",
              "text": "影响游戏、同伴互动或外出活动"
            },
            {
              "key": "imp.learn",
              "text": "影响课堂学习或作业完成"
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "dim": "SEN",
    "levels": [
      {
        "max": 28,
        "name": "未见明显"
      },
      {
        "max": 45,
        "name": "部分面向需留意"
      },
      {
        "max": 100,
        "name": "建议作业治疗评估"
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
