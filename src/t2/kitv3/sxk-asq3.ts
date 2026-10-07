/**
 * SXK-ASQ3（森心康分龄发育综合评估）—— 完整版題庫 kit-20260923。
 *
 * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。
 *   NEWT2/森心康评估工具包_完整版_20260923.zip → 森心康_分龄发育综合评估_完整版_SXK-ASQ3.html（sha256 665455f80531…）
 */

import type { KitV3Bank } from './types';

export const BANK: KitV3Bank = {
  "code": "SXK-ASQ3",
  "source": {
    "zip": "NEWT2/森心康评估工具包_完整版_20260923.zip",
    "file": "森心康_分龄发育综合评估_完整版_SXK-ASQ3.html",
    "sha256": "665455f80531054356a007e8421956eb69c33577ea2f41af41e892a3e17468b1"
  },
  "title": "森心康分龄发育综合评估",
  "family": "asq3",
  "options": {
    "main": [
      {
        "value": 10,
        "label": "已经会"
      },
      {
        "value": 5,
        "label": "偶尔会"
      },
      {
        "value": 0,
        "label": "还不会"
      }
    ],
    "yesno": [
      {
        "value": 1,
        "label": "是"
      },
      {
        "value": 0,
        "label": "否"
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
      "key": "3",
      "name": "3 个月题组",
      "minM": 3,
      "maxM": 3,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "3.cm.1",
              "text": "听到声音会安静下来或转头找"
            },
            {
              "key": "3.cm.2",
              "text": "会发出「啊」「呜」这类喉音"
            },
            {
              "key": "3.cm.3",
              "text": "被逗弄时会用声音回应"
            },
            {
              "key": "3.cm.4",
              "text": "哭声听得出不同（饿、困、不舒服）"
            },
            {
              "key": "3.cm.5",
              "text": "安静时会自己「咕咕」地发声玩"
            },
            {
              "key": "3.cm.6",
              "text": "听到熟悉的声音会有反应（安静、动一动）"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "3.gm.1",
              "text": "趴着时能把头抬起来一下下"
            },
            {
              "key": "3.gm.2",
              "text": "被抱起时头能自己稳住、不往后仰"
            },
            {
              "key": "3.gm.3",
              "text": "仰躺时会踢腿、挥动手臂"
            },
            {
              "key": "3.gm.4",
              "text": "趴着时能用前臂把上身撑起来"
            },
            {
              "key": "3.gm.5",
              "text": "躺着时头能自己转向两边"
            },
            {
              "key": "3.gm.6",
              "text": "被扶成站姿时两腿会短暂用力踩"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "3.fm.1",
              "text": "手大部分时间是张开的，不总是握拳"
            },
            {
              "key": "3.fm.2",
              "text": "会把手放进嘴里"
            },
            {
              "key": "3.fm.3",
              "text": "两只手会在胸前碰在一起"
            },
            {
              "key": "3.fm.4",
              "text": "放进手心的摇铃能握住一下下"
            },
            {
              "key": "3.fm.5",
              "text": "眼睛会跟着自己的手看"
            },
            {
              "key": "3.fm.6",
              "text": "看到想要的东西会挥动手臂"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "3.ps.1",
              "text": "眼睛能盯着慢慢移动的东西看"
            },
            {
              "key": "3.ps.2",
              "text": "对突然的声音会有反应（眨眼、身体一震）"
            },
            {
              "key": "3.ps.3",
              "text": "会看向光亮或颜色鲜艳的东西"
            },
            {
              "key": "3.ps.4",
              "text": "能注视人脸一段时间"
            },
            {
              "key": "3.ps.5",
              "text": "会重复做让自己舒服的动作（吸手指）"
            },
            {
              "key": "3.ps.6",
              "text": "被摆成熟悉的喂奶姿势会安静下来等待"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "3.so.1",
              "text": "会注视大人的脸"
            },
            {
              "key": "3.so.2",
              "text": "被逗时会露出笑容"
            },
            {
              "key": "3.so.3",
              "text": "被抱起来会安静下来"
            },
            {
              "key": "3.so.4",
              "text": "会用眼神跟着走动的人"
            },
            {
              "key": "3.so.5",
              "text": "会主动对人笑，不只是睡着时的反射"
            },
            {
              "key": "3.so.6",
              "text": "喜欢有人陪，自己待久了会不安"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "4",
      "name": "4 个月题组",
      "minM": 4,
      "maxM": 4,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "4.cm.1",
              "text": "会转头去找说话的人"
            },
            {
              "key": "4.cm.2",
              "text": "会发出笑声"
            },
            {
              "key": "4.cm.3",
              "text": "会用声音表达高兴或不满"
            },
            {
              "key": "4.cm.4",
              "text": "会发出不同的母音（啊、呜、咿）"
            },
            {
              "key": "4.cm.5",
              "text": "大人跟他说话时会用声音「回话」"
            },
            {
              "key": "4.cm.6",
              "text": "听到自己的名字会有反应（停下动作、看过来）"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "4.gm.1",
              "text": "趴着时能用手掌把胸部撑起来"
            },
            {
              "key": "4.gm.2",
              "text": "被扶着坐时头能稳住不晃"
            },
            {
              "key": "4.gm.3",
              "text": "会从仰躺翻成侧躺"
            },
            {
              "key": "4.gm.4",
              "text": "被拉着坐起来时头不会往后掉"
            },
            {
              "key": "4.gm.5",
              "text": "仰躺时会抓自己的脚或膝盖"
            },
            {
              "key": "4.gm.6",
              "text": "被扶站时腿能撑住一部分体重"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "4.fm.1",
              "text": "看到东西会伸手去碰"
            },
            {
              "key": "4.fm.2",
              "text": "两只手会一起抓住奶瓶或玩具"
            },
            {
              "key": "4.fm.3",
              "text": "会把手上的东西送到嘴边"
            },
            {
              "key": "4.fm.4",
              "text": "会用整只手掌把东西握住并摇晃"
            },
            {
              "key": "4.fm.5",
              "text": "会伸手去拿眼前的玩具"
            },
            {
              "key": "4.fm.6",
              "text": "手上的东西会从一只手换到另一只手（偶尔）"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "4.ps.1",
              "text": "会一直盯着自己的手看"
            },
            {
              "key": "4.ps.2",
              "text": "东西离开视线会用眼睛去找"
            },
            {
              "key": "4.ps.3",
              "text": "对按了会响的玩具有兴趣"
            },
            {
              "key": "4.ps.4",
              "text": "会把东西放进嘴里探索"
            },
            {
              "key": "4.ps.5",
              "text": "会重复拍打玩具让它发出声音"
            },
            {
              "key": "4.ps.6",
              "text": "看到奶瓶或乳房会兴奋期待"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "4.so.1",
              "text": "会认得每天照顾他的人"
            },
            {
              "key": "4.so.2",
              "text": "看到熟人会笑或手脚兴奋挥动"
            },
            {
              "key": "4.so.3",
              "text": "会用表情回应别人的表情"
            },
            {
              "key": "4.so.4",
              "text": "照镜子时会看着镜中的自己"
            },
            {
              "key": "4.so.5",
              "text": "互动被中断时会表示不满"
            },
            {
              "key": "4.so.6",
              "text": "会主动用声音或动作引起大人注意"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "6",
      "name": "6 个月题组",
      "minM": 5,
      "maxM": 6,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "6.cm.1",
              "text": "会发出「ba」「ma」「da」这类子音"
            },
            {
              "key": "6.cm.2",
              "text": "会对着人发声想引起注意"
            },
            {
              "key": "6.cm.3",
              "text": "会转头去看声音来自哪里（左右）"
            },
            {
              "key": "6.cm.4",
              "text": "会跟着大人的语调忽高忽低"
            },
            {
              "key": "6.cm.5",
              "text": "听到自己的名字会转头"
            },
            {
              "key": "6.cm.6",
              "text": "会用不同的声音表达不同的情绪"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "6.gm.1",
              "text": "能自己翻过去再翻回来"
            },
            {
              "key": "6.gm.2",
              "text": "被扶着坐时背能挺住"
            },
            {
              "key": "6.gm.3",
              "text": "趴着时能用手撑起把胸腹离地"
            },
            {
              "key": "6.gm.4",
              "text": "扶着腋下能站着蹦跳"
            },
            {
              "key": "6.gm.5",
              "text": "坐着时能用手撑在前面稳住"
            },
            {
              "key": "6.gm.6",
              "text": "趴着时会原地转圈或往后退"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "6.fm.1",
              "text": "看到东西会伸手去抓并抓到"
            },
            {
              "key": "6.fm.2",
              "text": "会把东西从一只手换到另一只手"
            },
            {
              "key": "6.fm.3",
              "text": "会用整只手掌握住小积木"
            },
            {
              "key": "6.fm.4",
              "text": "两只手能同时各拿一个东西"
            },
            {
              "key": "6.fm.5",
              "text": "会去抓垂在眼前的绳子或玩具"
            },
            {
              "key": "6.fm.6",
              "text": "会用手拍打桌面或玩具"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "6.ps.1",
              "text": "东西掉了会看向掉下去的方向"
            },
            {
              "key": "6.ps.2",
              "text": "会伸手拿被布盖住一半的玩具"
            },
            {
              "key": "6.ps.3",
              "text": "会重复摇晃玩具让它发出声音"
            },
            {
              "key": "6.ps.4",
              "text": "看到没见过的东西会盯着看比较久"
            },
            {
              "key": "6.ps.5",
              "text": "会拿着东西翻来覆去地看"
            },
            {
              "key": "6.ps.6",
              "text": "会把两个东西一起敲（偶尔）"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "6.so.1",
              "text": "看到陌生人会先观察一下"
            },
            {
              "key": "6.so.2",
              "text": "会主动伸手要抱"
            },
            {
              "key": "6.so.3",
              "text": "玩躲猫猫时会笑"
            },
            {
              "key": "6.so.4",
              "text": "会对镜子里的自己笑或伸手摸"
            },
            {
              "key": "6.so.5",
              "text": "被大人逗弄时会来回互动好几轮"
            },
            {
              "key": "6.so.6",
              "text": "会用表情和动作表示要或不要"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "8",
      "name": "8 个月题组",
      "minM": 7,
      "maxM": 8,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "8.cm.1",
              "text": "会发出「爸爸」「妈妈」这类连续音（不一定有意义）"
            },
            {
              "key": "8.cm.2",
              "text": "听到「不可以」会停一下"
            },
            {
              "key": "8.cm.3",
              "text": "会模仿咳嗽、咂嘴这类声音"
            },
            {
              "key": "8.cm.4",
              "text": "叫他名字会回头"
            },
            {
              "key": "8.cm.5",
              "text": "会用声音叫人"
            },
            {
              "key": "8.cm.6",
              "text": "会跟着大人一起发出笑声或叫声"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "8.gm.1",
              "text": "能自己坐稳一小段时间不用手撑"
            },
            {
              "key": "8.gm.2",
              "text": "会用肚子贴地往前爬或往后退"
            },
            {
              "key": "8.gm.3",
              "text": "扶着东西能撑起身体跪着"
            },
            {
              "key": "8.gm.4",
              "text": "坐着时能转身拿旁边的东西"
            },
            {
              "key": "8.gm.5",
              "text": "趴着能用手脚把身体往前推"
            },
            {
              "key": "8.gm.6",
              "text": "扶着大人的手能站住几秒"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "8.fm.1",
              "text": "能用手指和拇指一起把小东西耙进手心"
            },
            {
              "key": "8.fm.2",
              "text": "会把两个东西对着敲"
            },
            {
              "key": "8.fm.3",
              "text": "会把东西放进大口容器里"
            },
            {
              "key": "8.fm.4",
              "text": "会用食指去戳或抠小洞"
            },
            {
              "key": "8.fm.5",
              "text": "会自己拿着饼干咬"
            },
            {
              "key": "8.fm.6",
              "text": "会把手上的东西故意放开、丢下"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "8.ps.1",
              "text": "东西被布完全盖住会去找"
            },
            {
              "key": "8.ps.2",
              "text": "会拉绳子把玩具弄过来"
            },
            {
              "key": "8.ps.3",
              "text": "会把盖子打开找里面的东西"
            },
            {
              "key": "8.ps.4",
              "text": "会往下看掉下去的东西"
            },
            {
              "key": "8.ps.5",
              "text": "会把挡住的东西拨开去拿后面的玩具"
            },
            {
              "key": "8.ps.6",
              "text": "会模仿简单动作（拍手、拍桌）"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "8.so.1",
              "text": "会认得熟悉的人，对陌生人比较警觉"
            },
            {
              "key": "8.so.2",
              "text": "玩躲猫猫会有反应"
            },
            {
              "key": "8.so.3",
              "text": "会主动把东西递给大人"
            },
            {
              "key": "8.so.4",
              "text": "会看大人的表情决定要不要做"
            },
            {
              "key": "8.so.5",
              "text": "和照顾者分开时会有情绪"
            },
            {
              "key": "8.so.6",
              "text": "会用声音或动作引起大人注意"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "9",
      "name": "9 个月题组",
      "minM": 9,
      "maxM": 9,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "9.cm.1",
              "text": "会用手势表达（伸手要、挥手再见）"
            },
            {
              "key": "9.cm.2",
              "text": "听得懂「不」「来」这些常用的词"
            },
            {
              "key": "9.cm.3",
              "text": "会发出两个不同子音组合的音（ba-da）"
            },
            {
              "key": "9.cm.4",
              "text": "大人说话时会看着大人的嘴"
            },
            {
              "key": "9.cm.5",
              "text": "会用声音表示「要」"
            },
            {
              "key": "9.cm.6",
              "text": "听到熟悉的儿歌会有反应"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "9.gm.1",
              "text": "能自己从趴着坐起来"
            },
            {
              "key": "9.gm.2",
              "text": "会用手膝爬"
            },
            {
              "key": "9.gm.3",
              "text": "扶着家具能自己站起来"
            },
            {
              "key": "9.gm.4",
              "text": "坐着时可以往前趴再坐回来"
            },
            {
              "key": "9.gm.5",
              "text": "扶着东西站着时能弯腰捡东西"
            },
            {
              "key": "9.gm.6",
              "text": "扶着家具能横着移动一两步"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "9.fm.1",
              "text": "能用拇指和食指捏起小东西"
            },
            {
              "key": "9.fm.2",
              "text": "会把容器里的东西倒出来"
            },
            {
              "key": "9.fm.3",
              "text": "会用食指指东西"
            },
            {
              "key": "9.fm.4",
              "text": "两手各拿一块积木能互相敲"
            },
            {
              "key": "9.fm.5",
              "text": "会把小东西放进杯子"
            },
            {
              "key": "9.fm.6",
              "text": "会翻厚纸板书的书页（一次好几页）"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "9.ps.1",
              "text": "会把盖住的玩具找出来"
            },
            {
              "key": "9.ps.2",
              "text": "会模仿用汤匙搅拌的动作"
            },
            {
              "key": "9.ps.3",
              "text": "知道东西掉下去会有声音，会往下看"
            },
            {
              "key": "9.ps.4",
              "text": "会把玩具放进去再拿出来，反复玩"
            },
            {
              "key": "9.ps.5",
              "text": "会看着大人指的方向"
            },
            {
              "key": "9.ps.6",
              "text": "会用同一个方法重复得到想要的结果（按键让玩具响）"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "9.so.1",
              "text": "会主动伸手给大人看手上的东西"
            },
            {
              "key": "9.so.2",
              "text": "会玩你来我往的互动游戏（递东西）"
            },
            {
              "key": "9.so.3",
              "text": "会对不认识的人害羞或躲"
            },
            {
              "key": "9.so.4",
              "text": "会用眼神和声音「叫」大人"
            },
            {
              "key": "9.so.5",
              "text": "会拿杯子喝水（大人扶着）"
            },
            {
              "key": "9.so.6",
              "text": "会模仿大人拍手、挥手"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "10",
      "name": "10 个月题组",
      "minM": 10,
      "maxM": 10,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "10.cm.1",
              "text": "会摇头表示不要"
            },
            {
              "key": "10.cm.2",
              "text": "会说一个有意义的词（爸爸、妈妈、抱）"
            },
            {
              "key": "10.cm.3",
              "text": "听得懂「拜拜」「给我」等简单指令"
            },
            {
              "key": "10.cm.4",
              "text": "会指认熟悉的人或东西"
            },
            {
              "key": "10.cm.5",
              "text": "会模仿没听过的新声音"
            },
            {
              "key": "10.cm.6",
              "text": "会用声音配合手势来要求东西"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "10.gm.1",
              "text": "会扶着家具横着走"
            },
            {
              "key": "10.gm.2",
              "text": "能自己从坐着扶东西站起来"
            },
            {
              "key": "10.gm.3",
              "text": "扶着能蹲下再站起来"
            },
            {
              "key": "10.gm.4",
              "text": "爬得很快，能跨过地上的小障碍"
            },
            {
              "key": "10.gm.5",
              "text": "扶着大人的两只手能走几步"
            },
            {
              "key": "10.gm.6",
              "text": "不扶东西能站一两秒"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "10.fm.1",
              "text": "会把小东西放进口比较小的容器"
            },
            {
              "key": "10.fm.2",
              "text": "能把两块积木叠起来（偶尔）"
            },
            {
              "key": "10.fm.3",
              "text": "会自己拿汤匙往嘴里送（会洒）"
            },
            {
              "key": "10.fm.4",
              "text": "会用食指指出想要的东西"
            },
            {
              "key": "10.fm.5",
              "text": "会把小东西塞进缝隙或洞里"
            },
            {
              "key": "10.fm.6",
              "text": "会拿笔在纸上戳或点"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "10.ps.1",
              "text": "会模仿大人操作玩具的方式"
            },
            {
              "key": "10.ps.2",
              "text": "会找完全被盖住的玩具"
            },
            {
              "key": "10.ps.3",
              "text": "知道常见东西的用途（把电话放到耳边）"
            },
            {
              "key": "10.ps.4",
              "text": "会把套环拿下来"
            },
            {
              "key": "10.ps.5",
              "text": "记得东西平常放在哪里"
            },
            {
              "key": "10.ps.6",
              "text": "会把东西放进容器再倒出来"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "10.so.1",
              "text": "会把玩具拿给大人、要求一起玩"
            },
            {
              "key": "10.so.2",
              "text": "会模仿大人做家事的样子"
            },
            {
              "key": "10.so.3",
              "text": "会指东西给大人看"
            },
            {
              "key": "10.so.4",
              "text": "看到其他小宝宝会盯着看、发出声音"
            },
            {
              "key": "10.so.5",
              "text": "穿衣时会配合伸手伸脚"
            },
            {
              "key": "10.so.6",
              "text": "会自己用手拿东西吃"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "12",
      "name": "12 个月题组",
      "minM": 11,
      "maxM": 12,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "12.cm.1",
              "text": "会说两三个有意义的词"
            },
            {
              "key": "12.cm.2",
              "text": "听得懂简单指令（把球给我）"
            },
            {
              "key": "12.cm.3",
              "text": "会用手指指想要的东西并出声"
            },
            {
              "key": "12.cm.4",
              "text": "听到「鞋子」「杯子」会看向那个东西"
            },
            {
              "key": "12.cm.5",
              "text": "会跟着大人说词的尾音"
            },
            {
              "key": "12.cm.6",
              "text": "会挥手再见、拍手表示高兴"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "12.gm.1",
              "text": "扶着一只手能走"
            },
            {
              "key": "12.gm.2",
              "text": "能不扶东西站几秒"
            },
            {
              "key": "12.gm.3",
              "text": "会自己从地上站起来（可扶）"
            },
            {
              "key": "12.gm.4",
              "text": "会蹲下捡东西再扶着站起来"
            },
            {
              "key": "12.gm.5",
              "text": "能自己走两三步（不稳也算）"
            },
            {
              "key": "12.gm.6",
              "text": "会爬上矮的台阶"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "12.fm.1",
              "text": "能叠起两块积木"
            },
            {
              "key": "12.fm.2",
              "text": "会一次翻一两页书"
            },
            {
              "key": "12.fm.3",
              "text": "会把圆形块放进对应的洞"
            },
            {
              "key": "12.fm.4",
              "text": "会自己拿笔在纸上涂"
            },
            {
              "key": "12.fm.5",
              "text": "会把小球投进洞里"
            },
            {
              "key": "12.fm.6",
              "text": "会用两只手把纸撕开"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "12.ps.1",
              "text": "会把东西放回原来的位置"
            },
            {
              "key": "12.ps.2",
              "text": "会拉、转、按不同的机关"
            },
            {
              "key": "12.ps.3",
              "text": "会模仿大人连续两个动作"
            },
            {
              "key": "12.ps.4",
              "text": "东西藏在两个地方之一，会找对"
            },
            {
              "key": "12.ps.5",
              "text": "会把盖子盖回去"
            },
            {
              "key": "12.ps.6",
              "text": "认得镜子里的是自己"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "12.so.1",
              "text": "会主动把玩具拿给大人看"
            },
            {
              "key": "12.so.2",
              "text": "分开时会有情绪，回来能被安抚"
            },
            {
              "key": "12.so.3",
              "text": "会自己拿杯子喝几口"
            },
            {
              "key": "12.so.4",
              "text": "会用眼神或声音引起大人注意"
            },
            {
              "key": "12.so.5",
              "text": "听到「不可以」会先看大人的反应"
            },
            {
              "key": "12.so.6",
              "text": "会对熟悉的人表现出亲近"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "14",
      "name": "14 个月题组",
      "minM": 13,
      "maxM": 14,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "14.cm.1",
              "text": "会说三到五个有意义的词"
            },
            {
              "key": "14.cm.2",
              "text": "听得懂「过来」「坐下」这类指令"
            },
            {
              "key": "14.cm.3",
              "text": "会指认一两个身体部位"
            },
            {
              "key": "14.cm.4",
              "text": "会用「嗯」「不」表示要或不要"
            },
            {
              "key": "14.cm.5",
              "text": "会跟着大人说新的词"
            },
            {
              "key": "14.cm.6",
              "text": "听得懂爷爷、奶奶这些称呼指的是谁"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "14.gm.1",
              "text": "能自己走几步不用扶"
            },
            {
              "key": "14.gm.2",
              "text": "会蹲下捡东西再站起来"
            },
            {
              "key": "14.gm.3",
              "text": "会推着玩具车往前走"
            },
            {
              "key": "14.gm.4",
              "text": "能自己爬上矮沙发"
            },
            {
              "key": "14.gm.5",
              "text": "走路时能停下来再转身"
            },
            {
              "key": "14.gm.6",
              "text": "扶着栏杆能上楼梯"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "14.fm.1",
              "text": "能叠起两三块积木"
            },
            {
              "key": "14.fm.2",
              "text": "会把小球投进洞里"
            },
            {
              "key": "14.fm.3",
              "text": "会用汤匙舀东西（洒得多）"
            },
            {
              "key": "14.fm.4",
              "text": "会把圆形块放进对应的洞"
            },
            {
              "key": "14.fm.5",
              "text": "会翻开书找图片"
            },
            {
              "key": "14.fm.6",
              "text": "会把盖子转开一点"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "14.ps.1",
              "text": "会假装玩（喂娃娃、开玩具车）"
            },
            {
              "key": "14.ps.2",
              "text": "知道梳子、电话这些东西怎么用"
            },
            {
              "key": "14.ps.3",
              "text": "会模仿大人连续两个动作"
            },
            {
              "key": "14.ps.4",
              "text": "会把东西放回原来的位置"
            },
            {
              "key": "14.ps.5",
              "text": "会拉、转、按不同的机关拿到玩具"
            },
            {
              "key": "14.ps.6",
              "text": "会把两块相同的东西配在一起"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "14.so.1",
              "text": "会模仿大人做家事"
            },
            {
              "key": "14.so.2",
              "text": "会把玩具拿给大人看"
            },
            {
              "key": "14.so.3",
              "text": "会自己拿食物吃"
            },
            {
              "key": "14.so.4",
              "text": "看到其他孩子会靠过去"
            },
            {
              "key": "14.so.5",
              "text": "会用亲亲或抱抱表达喜欢"
            },
            {
              "key": "14.so.6",
              "text": "听到「不可以」会先看大人的反应"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "16",
      "name": "16 个月题组",
      "minM": 15,
      "maxM": 16,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "16.cm.1",
              "text": "会说六到十个有意义的词"
            },
            {
              "key": "16.cm.2",
              "text": "会用词表达需求（要、不要、抱）"
            },
            {
              "key": "16.cm.3",
              "text": "听得懂两个词组成的指令（拿鞋子来）"
            },
            {
              "key": "16.cm.4",
              "text": "会指认图片里的东西"
            },
            {
              "key": "16.cm.5",
              "text": "会跟着做手指谣的动作"
            },
            {
              "key": "16.cm.6",
              "text": "会叫出一两个人的名字"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "16.gm.1",
              "text": "能走得稳，不常跌倒"
            },
            {
              "key": "16.gm.2",
              "text": "走过去能把球踢到"
            },
            {
              "key": "16.gm.3",
              "text": "扶着能上下楼梯"
            },
            {
              "key": "16.gm.4",
              "text": "会倒退走几步"
            },
            {
              "key": "16.gm.5",
              "text": "会拉着有绳子的玩具走"
            },
            {
              "key": "16.gm.6",
              "text": "能自己爬上小椅子坐好"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "16.fm.1",
              "text": "能叠起三块积木"
            },
            {
              "key": "16.fm.2",
              "text": "会自己把书翻开来看"
            },
            {
              "key": "16.fm.3",
              "text": "会用手指把贴纸撕下来"
            },
            {
              "key": "16.fm.4",
              "text": "会转开简单的盖子"
            },
            {
              "key": "16.fm.5",
              "text": "会把小东西放进口小的瓶子"
            },
            {
              "key": "16.fm.6",
              "text": "会自己脱袜子"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "16.ps.1",
              "text": "会把一样的东西配成对"
            },
            {
              "key": "16.ps.2",
              "text": "东西藏在两个地方之一，会找对"
            },
            {
              "key": "16.ps.3",
              "text": "会照着大人的样子把玩具收进对的盒子"
            },
            {
              "key": "16.ps.4",
              "text": "会拿一个东西假装成另一个（积木当电话）"
            },
            {
              "key": "16.ps.5",
              "text": "会把三块形状板放对位置"
            },
            {
              "key": "16.ps.6",
              "text": "知道自己的东西放在哪里"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "16.so.1",
              "text": "对同龄孩子有兴趣、会靠近看"
            },
            {
              "key": "16.so.2",
              "text": "会指有趣的东西给大人看"
            },
            {
              "key": "16.so.3",
              "text": "会表达生气或高兴"
            },
            {
              "key": "16.so.4",
              "text": "会自己拿杯子喝水"
            },
            {
              "key": "16.so.5",
              "text": "会帮忙把东西放回去"
            },
            {
              "key": "16.so.6",
              "text": "尿湿了会表示不舒服"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "18",
      "name": "18 个月题组",
      "minM": 17,
      "maxM": 18,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "18.cm.1",
              "text": "会说十个以上有意义的词"
            },
            {
              "key": "18.cm.2",
              "text": "会用手指指着东西同时说出名字"
            },
            {
              "key": "18.cm.3",
              "text": "听得懂「把杯子放到桌上」这类指令"
            },
            {
              "key": "18.cm.4",
              "text": "会说「不要」表示拒绝"
            },
            {
              "key": "18.cm.5",
              "text": "会指认三个以上身体部位"
            },
            {
              "key": "18.cm.6",
              "text": "会模仿大人说的两个词"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "18.gm.1",
              "text": "会跑几步（不稳也算）"
            },
            {
              "key": "18.gm.2",
              "text": "会踢球不跌倒"
            },
            {
              "key": "18.gm.3",
              "text": "会自己扶着上楼梯"
            },
            {
              "key": "18.gm.4",
              "text": "会从小椅子上自己坐上去、下来"
            },
            {
              "key": "18.gm.5",
              "text": "会往前丢球"
            },
            {
              "key": "18.gm.6",
              "text": "会蹲着玩一段时间再站起来"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "18.fm.1",
              "text": "能叠起三四块积木"
            },
            {
              "key": "18.fm.2",
              "text": "会用蜡笔在纸上画出线条"
            },
            {
              "key": "18.fm.3",
              "text": "会把豆子一颗一颗放进瓶子"
            },
            {
              "key": "18.fm.4",
              "text": "会一次翻一页书"
            },
            {
              "key": "18.fm.5",
              "text": "会把套套杯一个套一个"
            },
            {
              "key": "18.fm.6",
              "text": "会自己脱帽子"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "18.ps.1",
              "text": "会假装喂娃娃、抱娃娃睡觉"
            },
            {
              "key": "18.ps.2",
              "text": "会依形状把东西放对位置"
            },
            {
              "key": "18.ps.3",
              "text": "会用棍子或工具把构不到的东西拿到"
            },
            {
              "key": "18.ps.4",
              "text": "会指出图片中的两三个东西"
            },
            {
              "key": "18.ps.5",
              "text": "会把东西按颜色分成两堆（简单）"
            },
            {
              "key": "18.ps.6",
              "text": "会模仿大人没做过的新动作"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "18.so.1",
              "text": "会和其他孩子在同一个空间各玩各的"
            },
            {
              "key": "18.so.2",
              "text": "会自己用汤匙吃（会洒也算）"
            },
            {
              "key": "18.so.3",
              "text": "会表达简单情绪（生气、开心）"
            },
            {
              "key": "18.so.4",
              "text": "想要东西时会用手指或出声表示，而不是直接抢"
            },
            {
              "key": "18.so.5",
              "text": "脱袜子、脱帽子会自己来"
            },
            {
              "key": "18.so.6",
              "text": "会主动亲吻或拥抱家人"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "20",
      "name": "20 个月题组",
      "minM": 19,
      "maxM": 20,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "20.cm.1",
              "text": "会说二十个以上的词"
            },
            {
              "key": "20.cm.2",
              "text": "会把两个词连起来说（妈妈抱、要水水）"
            },
            {
              "key": "20.cm.3",
              "text": "听得懂「拿鞋子给爸爸」这类两步骤指令"
            },
            {
              "key": "20.cm.4",
              "text": "会指认图片里五个以上的东西"
            },
            {
              "key": "20.cm.5",
              "text": "会说「我的」表示东西是他的"
            },
            {
              "key": "20.cm.6",
              "text": "会回答「这是什么」（简单的）"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "20.gm.1",
              "text": "能走得稳，也会小跑"
            },
            {
              "key": "20.gm.2",
              "text": "会原地双脚跳（跳得起来就算）"
            },
            {
              "key": "20.gm.3",
              "text": "会把球过肩丢出去"
            },
            {
              "key": "20.gm.4",
              "text": "能跨过地上的小障碍"
            },
            {
              "key": "20.gm.5",
              "text": "会自己上下楼梯（可以扶）"
            },
            {
              "key": "20.gm.6",
              "text": "会踢滚过来的球"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "20.fm.1",
              "text": "会照着画直线（像就算）"
            },
            {
              "key": "20.fm.2",
              "text": "能叠起四五块积木"
            },
            {
              "key": "20.fm.3",
              "text": "会把门把转开"
            },
            {
              "key": "20.fm.4",
              "text": "会把盖子压回盒子上"
            },
            {
              "key": "20.fm.5",
              "text": "会把大珠子串起来一两颗"
            },
            {
              "key": "20.fm.6",
              "text": "会用蜡笔画出圆圈状的涂鸦"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "20.ps.1",
              "text": "会假装玩一连串动作（喂娃娃再哄睡）"
            },
            {
              "key": "20.ps.2",
              "text": "会打开盒子，找出藏在里面的东西"
            },
            {
              "key": "20.ps.3",
              "text": "懂得「一个」和「很多」的差别"
            },
            {
              "key": "20.ps.4",
              "text": "东西被换了位置也找得到"
            },
            {
              "key": "20.ps.5",
              "text": "会把积木排成一排"
            },
            {
              "key": "20.ps.6",
              "text": "会找出成对的鞋子或袜子"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "20.so.1",
              "text": "会自己用汤匙吃，不太需要喂"
            },
            {
              "key": "20.so.2",
              "text": "会说「不要」表示拒绝"
            },
            {
              "key": "20.so.3",
              "text": "会帮忙做简单的事（拿东西、丢垃圾）"
            },
            {
              "key": "20.so.4",
              "text": "看到别人哭会有反应"
            },
            {
              "key": "20.so.5",
              "text": "会自己脱鞋"
            },
            {
              "key": "20.so.6",
              "text": "会靠近其他孩子、看他们玩"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "22",
      "name": "22 个月题组",
      "minM": 21,
      "maxM": 22,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "22.cm.1",
              "text": "会说三十个以上的词"
            },
            {
              "key": "22.cm.2",
              "text": "会说两个词的短句（爸爸车车、不要吃）"
            },
            {
              "key": "22.cm.3",
              "text": "听得懂「里面」「上面」这类简单位置词"
            },
            {
              "key": "22.cm.4",
              "text": "会说出熟悉的动物或东西的名称"
            },
            {
              "key": "22.cm.5",
              "text": "会重复大人说的最后一个词"
            },
            {
              "key": "22.cm.6",
              "text": "会跟着唱简单的儿歌"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "22.gm.1",
              "text": "会跑，但转弯还不太顺"
            },
            {
              "key": "22.gm.2",
              "text": "双脚能同时离地跳一下"
            },
            {
              "key": "22.gm.3",
              "text": "会踢滚到脚边的球"
            },
            {
              "key": "22.gm.4",
              "text": "会自己上楼梯（两脚一阶、可以扶）"
            },
            {
              "key": "22.gm.5",
              "text": "会倒退走一小段"
            },
            {
              "key": "22.gm.6",
              "text": "能站着踢球不跌倒"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "22.fm.1",
              "text": "会自己拿笔画出线条，不只是乱涂"
            },
            {
              "key": "22.fm.2",
              "text": "能叠起五六块积木不倒"
            },
            {
              "key": "22.fm.3",
              "text": "会把纸对折（不用对齐）"
            },
            {
              "key": "22.fm.4",
              "text": "会打开有盖子的盒子"
            },
            {
              "key": "22.fm.5",
              "text": "会用手指捏起小豆子放进碗里"
            },
            {
              "key": "22.fm.6",
              "text": "会转开瓶盖"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "22.ps.1",
              "text": "会照着大人排好的样子，排出两三个积木"
            },
            {
              "key": "22.ps.2",
              "text": "会假装玩具是别的东西"
            },
            {
              "key": "22.ps.3",
              "text": "会找被藏起来的东西"
            },
            {
              "key": "22.ps.4",
              "text": "会把东西依一种特征分成两堆"
            },
            {
              "key": "22.ps.5",
              "text": "知道常见东西的用途"
            },
            {
              "key": "22.ps.6",
              "text": "会拼两片的拼图"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "22.so.1",
              "text": "吃饭能自己坐着吃完"
            },
            {
              "key": "22.so.2",
              "text": "大小便后会表示"
            },
            {
              "key": "22.so.3",
              "text": "会自己脱鞋袜"
            },
            {
              "key": "22.so.4",
              "text": "会指东西给大人看并期待回应"
            },
            {
              "key": "22.so.5",
              "text": "会帮忙把玩具放回去"
            },
            {
              "key": "22.so.6",
              "text": "会用「我」或自己的名字指自己"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "24",
      "name": "24 个月题组",
      "minM": 23,
      "maxM": 25,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "24.cm.1",
              "text": "会说五十个以上的词"
            },
            {
              "key": "24.cm.2",
              "text": "会说两三个词的短句"
            },
            {
              "key": "24.cm.3",
              "text": "听得懂两步骤的指令"
            },
            {
              "key": "24.cm.4",
              "text": "会回答「要不要」「是不是」的问题"
            },
            {
              "key": "24.cm.5",
              "text": "会用「你」「我」"
            },
            {
              "key": "24.cm.6",
              "text": "会说出自己的名字"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "24.gm.1",
              "text": "会跑，方向大致控制得住"
            },
            {
              "key": "24.gm.2",
              "text": "会双脚一起往前跳"
            },
            {
              "key": "24.gm.3",
              "text": "会踢固定在地上的球"
            },
            {
              "key": "24.gm.4",
              "text": "会自己上下楼梯（两脚一阶）"
            },
            {
              "key": "24.gm.5",
              "text": "会踮着脚走几步"
            },
            {
              "key": "24.gm.6",
              "text": "会从最后一阶楼梯跳下来"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "24.fm.1",
              "text": "会照着画直线"
            },
            {
              "key": "24.fm.2",
              "text": "会用手指把豆子一颗一颗放进小碗"
            },
            {
              "key": "24.fm.3",
              "text": "会自己拉上或拉下拉链"
            },
            {
              "key": "24.fm.4",
              "text": "会一手压住纸、一手画画"
            },
            {
              "key": "24.fm.5",
              "text": "会把圆形和方形放进对应的洞"
            },
            {
              "key": "24.fm.6",
              "text": "能叠起六块积木"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "24.ps.1",
              "text": "会把相同颜色的东西放在一起"
            },
            {
              "key": "24.ps.2",
              "text": "会拼两三片的拼图"
            },
            {
              "key": "24.ps.3",
              "text": "会指出两张图里不一样的地方"
            },
            {
              "key": "24.ps.4",
              "text": "假装游戏里会扮演一个角色（当妈妈、当医生）"
            },
            {
              "key": "24.ps.5",
              "text": "会数出「一个」「两个」"
            },
            {
              "key": "24.ps.6",
              "text": "东西不见了会到平常放的地方去找"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "24.so.1",
              "text": "会自己用汤匙吃，只洒出一点"
            },
            {
              "key": "24.so.2",
              "text": "会自己坐上小马桶"
            },
            {
              "key": "24.so.3",
              "text": "会自己穿上没有扣子的衣服"
            },
            {
              "key": "24.so.4",
              "text": "会在旁边看其他孩子玩并模仿他们"
            },
            {
              "key": "24.so.5",
              "text": "会说出自己是高兴还是生气"
            },
            {
              "key": "24.so.6",
              "text": "会跟着大人一起收玩具"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "27",
      "name": "27 个月题组",
      "minM": 26,
      "maxM": 28,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "27.cm.1",
              "text": "会说三个词组成的句子"
            },
            {
              "key": "27.cm.2",
              "text": "会用「不」「没有」造句"
            },
            {
              "key": "27.cm.3",
              "text": "听得懂「大／小」"
            },
            {
              "key": "27.cm.4",
              "text": "会问「这是什么」"
            },
            {
              "key": "27.cm.5",
              "text": "家人听得懂他大部分的话"
            },
            {
              "key": "27.cm.6",
              "text": "会说出两三种颜色或动物的名称"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "27.gm.1",
              "text": "会双脚连续往前跳两三下"
            },
            {
              "key": "27.gm.2",
              "text": "会跑并停下来不跌倒"
            },
            {
              "key": "27.gm.3",
              "text": "会单脚站一秒（扶着也算）"
            },
            {
              "key": "27.gm.4",
              "text": "会自己上楼梯不扶"
            },
            {
              "key": "27.gm.5",
              "text": "会把球踢到指定方向"
            },
            {
              "key": "27.gm.6",
              "text": "会骑没有踏板的滑步车或坐着滑"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "27.fm.1",
              "text": "会照着画圆圈"
            },
            {
              "key": "27.fm.2",
              "text": "能叠起七八块积木"
            },
            {
              "key": "27.fm.3",
              "text": "会用剪刀剪开纸（一刀）"
            },
            {
              "key": "27.fm.4",
              "text": "会把珠子串起来三颗以上"
            },
            {
              "key": "27.fm.5",
              "text": "会把纸对折再对折"
            },
            {
              "key": "27.fm.6",
              "text": "会扣上大颗的按扣"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "27.ps.1",
              "text": "会依颜色或形状分类"
            },
            {
              "key": "27.ps.2",
              "text": "懂得「大／小」"
            },
            {
              "key": "27.ps.3",
              "text": "会照顺序做两件事"
            },
            {
              "key": "27.ps.4",
              "text": "会拼三片以上拼图"
            },
            {
              "key": "27.ps.5",
              "text": "会用工具拿到构不到的东西"
            },
            {
              "key": "27.ps.6",
              "text": "会玩需要记住位置的游戏（翻牌配对，两三对）"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "27.so.1",
              "text": "会自己脱简单衣物"
            },
            {
              "key": "27.so.2",
              "text": "白天大小便能自己表示"
            },
            {
              "key": "27.so.3",
              "text": "会和其他孩子在同一空间玩"
            },
            {
              "key": "27.so.4",
              "text": "会说自己的名字"
            },
            {
              "key": "27.so.5",
              "text": "会等一下下"
            },
            {
              "key": "27.so.6",
              "text": "会安慰哭的人或玩偶"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "30",
      "name": "30 个月题组",
      "minM": 29,
      "maxM": 31,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "30.cm.1",
              "text": "会说三到四个词的句子"
            },
            {
              "key": "30.cm.2",
              "text": "能依两步骤指令行动"
            },
            {
              "key": "30.cm.3",
              "text": "会用「我」称呼自己"
            },
            {
              "key": "30.cm.4",
              "text": "会回答「这是谁」「在哪里」的问题"
            },
            {
              "key": "30.cm.5",
              "text": "会说出刚发生的事（简单的）"
            },
            {
              "key": "30.cm.6",
              "text": "会用「和」把两样东西连起来说"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "30.gm.1",
              "text": "能双脚同时离地跳"
            },
            {
              "key": "30.gm.2",
              "text": "能自己上下楼梯"
            },
            {
              "key": "30.gm.3",
              "text": "能单脚站一两秒"
            },
            {
              "key": "30.gm.4",
              "text": "能踢固定的球"
            },
            {
              "key": "30.gm.5",
              "text": "能跑步并控制方向"
            },
            {
              "key": "30.gm.6",
              "text": "能从矮处往下跳"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "30.fm.1",
              "text": "会照着画直线或圆圈"
            },
            {
              "key": "30.fm.2",
              "text": "能叠六块以上积木"
            },
            {
              "key": "30.fm.3",
              "text": "会转开瓶盖"
            },
            {
              "key": "30.fm.4",
              "text": "会把珠子串起来"
            },
            {
              "key": "30.fm.5",
              "text": "会自己拿笔涂鸦成形"
            },
            {
              "key": "30.fm.6",
              "text": "会用剪刀剪开纸"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "30.ps.1",
              "text": "会依颜色或形状分类"
            },
            {
              "key": "30.ps.2",
              "text": "懂得「大／小」"
            },
            {
              "key": "30.ps.3",
              "text": "会照顺序做两件事"
            },
            {
              "key": "30.ps.4",
              "text": "会拼三片以上拼图"
            },
            {
              "key": "30.ps.5",
              "text": "会用工具拿到构不到的东西"
            },
            {
              "key": "30.ps.6",
              "text": "懂得「多／少」"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "30.so.1",
              "text": "会自己用汤匙吃完一餐"
            },
            {
              "key": "30.so.2",
              "text": "白天大小便能自己表示"
            },
            {
              "key": "30.so.3",
              "text": "会自己脱简单衣物"
            },
            {
              "key": "30.so.4",
              "text": "会和其他孩子在同一空间玩"
            },
            {
              "key": "30.so.5",
              "text": "会说自己的名字"
            },
            {
              "key": "30.so.6",
              "text": "会等一下下"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "33",
      "name": "33 个月题组",
      "minM": 32,
      "maxM": 34,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "33.cm.1",
              "text": "会说四个词以上的句子"
            },
            {
              "key": "33.cm.2",
              "text": "别人大致听得懂他说的话"
            },
            {
              "key": "33.cm.3",
              "text": "会问「为什么」"
            },
            {
              "key": "33.cm.4",
              "text": "会说出自己的性别和年龄"
            },
            {
              "key": "33.cm.5",
              "text": "听得懂「上面／下面」「前面／后面」"
            },
            {
              "key": "33.cm.6",
              "text": "会说完整一件简单的事（谁做了什么）"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "33.gm.1",
              "text": "能单脚站两三秒"
            },
            {
              "key": "33.gm.2",
              "text": "会双脚交替上楼梯（可扶）"
            },
            {
              "key": "33.gm.3",
              "text": "会骑三轮车踩几下"
            },
            {
              "key": "33.gm.4",
              "text": "会接住抛过来的大球（用身体也算）"
            },
            {
              "key": "33.gm.5",
              "text": "会单脚往前跳一下"
            },
            {
              "key": "33.gm.6",
              "text": "会沿着线走几步"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "33.fm.1",
              "text": "会照着画十字"
            },
            {
              "key": "33.fm.2",
              "text": "会自己扣大颗钮扣"
            },
            {
              "key": "33.fm.3",
              "text": "会用剪刀连续剪"
            },
            {
              "key": "33.fm.4",
              "text": "能叠起八块以上积木"
            },
            {
              "key": "33.fm.5",
              "text": "会把纸对折对齐"
            },
            {
              "key": "33.fm.6",
              "text": "画的人有头和一两个部位"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "33.ps.1",
              "text": "会数到五"
            },
            {
              "key": "33.ps.2",
              "text": "认得两三种颜色"
            },
            {
              "key": "33.ps.3",
              "text": "会拼四片以上拼图"
            },
            {
              "key": "33.ps.4",
              "text": "会把东西依大小排顺序（三个）"
            },
            {
              "key": "33.ps.5",
              "text": "会说出常见东西是做什么用的"
            },
            {
              "key": "33.ps.6",
              "text": "懂「一样／不一样」"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "33.so.1",
              "text": "会和其他孩子一起玩、有来有往（短时间）"
            },
            {
              "key": "33.so.2",
              "text": "会轮流（需要提醒）"
            },
            {
              "key": "33.so.3",
              "text": "能自己穿脱大部分衣物"
            },
            {
              "key": "33.so.4",
              "text": "会自己上厕所（需协助擦拭）"
            },
            {
              "key": "33.so.5",
              "text": "会遵守简单的规则"
            },
            {
              "key": "33.so.6",
              "text": "会说出朋友的名字"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "36",
      "name": "36 个月题组",
      "minM": 35,
      "maxM": 38,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "36.cm.1",
              "text": "会说四五个词组成的句子"
            },
            {
              "key": "36.cm.2",
              "text": "会讲刚刚发生的事"
            },
            {
              "key": "36.cm.3",
              "text": "会用「为什么」提问"
            },
            {
              "key": "36.cm.4",
              "text": "不熟的人也大致听得懂他说话"
            },
            {
              "key": "36.cm.5",
              "text": "会用「和」「跟」把两件事连起来"
            },
            {
              "key": "36.cm.6",
              "text": "听得懂三个步骤的指令"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "36.gm.1",
              "text": "会双脚交替上楼梯，不用扶"
            },
            {
              "key": "36.gm.2",
              "text": "能单脚站三秒以上"
            },
            {
              "key": "36.gm.3",
              "text": "会骑三轮车或滑步车"
            },
            {
              "key": "36.gm.4",
              "text": "会单脚往前跳一两下"
            },
            {
              "key": "36.gm.5",
              "text": "能接住抛过来的大球"
            },
            {
              "key": "36.gm.6",
              "text": "会侧着走或倒退走一段"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "36.fm.1",
              "text": "会照着画十字或方形"
            },
            {
              "key": "36.fm.2",
              "text": "会自己扣大颗钮扣"
            },
            {
              "key": "36.fm.3",
              "text": "会用剪刀沿着线剪"
            },
            {
              "key": "36.fm.4",
              "text": "握笔的姿势比较稳定了"
            },
            {
              "key": "36.fm.5",
              "text": "会照样把纸对折一次"
            },
            {
              "key": "36.fm.6",
              "text": "画的人会有头和身体"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "36.ps.1",
              "text": "会数到十"
            },
            {
              "key": "36.ps.2",
              "text": "认得基本颜色"
            },
            {
              "key": "36.ps.3",
              "text": "懂「上面／下面」「前面／后面」"
            },
            {
              "key": "36.ps.4",
              "text": "会拼六片以上的拼图"
            },
            {
              "key": "36.ps.5",
              "text": "会说出常见东西是做什么用的"
            },
            {
              "key": "36.ps.6",
              "text": "会把东西依大小排顺序"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "36.so.1",
              "text": "会和其他孩子一起玩、有来有往"
            },
            {
              "key": "36.so.2",
              "text": "会轮流（可能需要提醒）"
            },
            {
              "key": "36.so.3",
              "text": "能自己穿脱大部分衣物"
            },
            {
              "key": "36.so.4",
              "text": "会自己上厕所（可能需协助擦拭）"
            },
            {
              "key": "36.so.5",
              "text": "会遵守简单的规则"
            },
            {
              "key": "36.so.6",
              "text": "会说出朋友的名字"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "42",
      "name": "42 个月题组",
      "minM": 39,
      "maxM": 44,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "42.cm.1",
              "text": "会说五六个词的句子"
            },
            {
              "key": "42.cm.2",
              "text": "会讲一件事的经过（简单的先后）"
            },
            {
              "key": "42.cm.3",
              "text": "会回答「什么时候」「怎么了」的问题"
            },
            {
              "key": "42.cm.4",
              "text": "会用「因为」"
            },
            {
              "key": "42.cm.5",
              "text": "会说出自己的全名"
            },
            {
              "key": "42.cm.6",
              "text": "会跟着唱完整一首儿歌"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "42.gm.1",
              "text": "能单脚站四五秒"
            },
            {
              "key": "42.gm.2",
              "text": "会单脚连续跳三下"
            },
            {
              "key": "42.gm.3",
              "text": "会双脚交替下楼梯（可扶）"
            },
            {
              "key": "42.gm.4",
              "text": "会接住反弹的球"
            },
            {
              "key": "42.gm.5",
              "text": "会踢球踢准目标"
            },
            {
              "key": "42.gm.6",
              "text": "会在低平衡木上走几步"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "42.fm.1",
              "text": "会照着画方形"
            },
            {
              "key": "42.fm.2",
              "text": "会自己扣扣子和拉拉链"
            },
            {
              "key": "42.fm.3",
              "text": "会用剪刀剪出直线"
            },
            {
              "key": "42.fm.4",
              "text": "画的人有头、身体和四肢"
            },
            {
              "key": "42.fm.5",
              "text": "会写出几个像字的笔画"
            },
            {
              "key": "42.fm.6",
              "text": "会用练习筷夹东西"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "42.ps.1",
              "text": "会数到十五以上"
            },
            {
              "key": "42.ps.2",
              "text": "能比较长短、高矮"
            },
            {
              "key": "42.ps.3",
              "text": "认得部分数字"
            },
            {
              "key": "42.ps.4",
              "text": "会说出简单的解决办法"
            },
            {
              "key": "42.ps.5",
              "text": "会照两个特征分类"
            },
            {
              "key": "42.ps.6",
              "text": "会说出一天中先做什么再做什么"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "42.so.1",
              "text": "能和同伴合作玩一个游戏"
            },
            {
              "key": "42.so.2",
              "text": "会安慰或帮助别人"
            },
            {
              "key": "42.so.3",
              "text": "输了游戏大致能接受"
            },
            {
              "key": "42.so.4",
              "text": "能自己穿脱衣鞋（不含鞋带）"
            },
            {
              "key": "42.so.5",
              "text": "上厕所能大致自己来"
            },
            {
              "key": "42.so.6",
              "text": "会自己收拾玩具"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "48",
      "name": "48 个月题组",
      "minM": 45,
      "maxM": 50,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "48.cm.1",
              "text": "能把一件事的经过讲完整"
            },
            {
              "key": "48.cm.2",
              "text": "会用「因为」「所以」"
            },
            {
              "key": "48.cm.3",
              "text": "会说出反义词（大－小、高－矮）"
            },
            {
              "key": "48.cm.4",
              "text": "听得懂含条件的话并照做（吃完点心才可以玩）"
            },
            {
              "key": "48.cm.5",
              "text": "说话的发音大致清楚"
            },
            {
              "key": "48.cm.6",
              "text": "会把听过的故事复述一遍"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "48.gm.1",
              "text": "能单脚站五秒以上"
            },
            {
              "key": "48.gm.2",
              "text": "会单脚连续跳好几下"
            },
            {
              "key": "48.gm.3",
              "text": "会双脚交替下楼梯不扶"
            },
            {
              "key": "48.gm.4",
              "text": "能踢球踢准目标"
            },
            {
              "key": "48.gm.5",
              "text": "会连续拍球三次以上"
            },
            {
              "key": "48.gm.6",
              "text": "能在一条线上走直线不掉下来"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "48.fm.1",
              "text": "会照着画三角形"
            },
            {
              "key": "48.fm.2",
              "text": "会自己扣扣子、拉拉链"
            },
            {
              "key": "48.fm.3",
              "text": "剪贴的作品能大致完成"
            },
            {
              "key": "48.fm.4",
              "text": "会画人，有头、身体和四肢"
            },
            {
              "key": "48.fm.5",
              "text": "会写出自己名字的部分笔画"
            },
            {
              "key": "48.fm.6",
              "text": "会用筷子或练习筷夹东西"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "48.ps.1",
              "text": "会数到二十以上"
            },
            {
              "key": "48.ps.2",
              "text": "能比较大小、长短、轻重"
            },
            {
              "key": "48.ps.3",
              "text": "认得部分数字或常见的字"
            },
            {
              "key": "48.ps.4",
              "text": "会说出简单的解决办法"
            },
            {
              "key": "48.ps.5",
              "text": "会照规则把东西分类（两个特征）"
            },
            {
              "key": "48.ps.6",
              "text": "知道今天要做什么、接下来做什么"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "48.so.1",
              "text": "能和同伴合作完成一件事"
            },
            {
              "key": "48.so.2",
              "text": "会安慰或帮助别人"
            },
            {
              "key": "48.so.3",
              "text": "输了游戏大致能接受"
            },
            {
              "key": "48.so.4",
              "text": "能自己完全穿脱衣鞋"
            },
            {
              "key": "48.so.5",
              "text": "上厕所能全程自己来"
            },
            {
              "key": "48.so.6",
              "text": "会自己收拾玩具"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "54",
      "name": "54 个月题组",
      "minM": 51,
      "maxM": 56,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "54.cm.1",
              "text": "能按顺序说出一件事的经过（先…再…）"
            },
            {
              "key": "54.cm.2",
              "text": "会用「如果…就…」"
            },
            {
              "key": "54.cm.3",
              "text": "会解释为什么要这样做"
            },
            {
              "key": "54.cm.4",
              "text": "会问有意义的问题并听懂回答"
            },
            {
              "key": "54.cm.5",
              "text": "发音清楚，偶尔有错音"
            },
            {
              "key": "54.cm.6",
              "text": "会说出自己家在哪里（地址或标志）"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "54.gm.1",
              "text": "能单脚站八秒左右"
            },
            {
              "key": "54.gm.2",
              "text": "会单脚交替跳几步"
            },
            {
              "key": "54.gm.3",
              "text": "会边跑边闪避障碍"
            },
            {
              "key": "54.gm.4",
              "text": "会接住小球"
            },
            {
              "key": "54.gm.5",
              "text": "会自己荡秋千"
            },
            {
              "key": "54.gm.6",
              "text": "会连续拍球五次以上"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "54.fm.1",
              "text": "会照着画菱形（大致像）"
            },
            {
              "key": "54.fm.2",
              "text": "会写自己的名字（部分）"
            },
            {
              "key": "54.fm.3",
              "text": "会用剪刀剪出曲线或简单形状"
            },
            {
              "key": "54.fm.4",
              "text": "画的人有六个以上的部位"
            },
            {
              "key": "54.fm.5",
              "text": "会自己系扣子、穿有鞋带的鞋（不打结）"
            },
            {
              "key": "54.fm.6",
              "text": "会照着描简单的字"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "54.ps.1",
              "text": "会做五以内的加减（用手指也算）"
            },
            {
              "key": "54.ps.2",
              "text": "懂得左右（自己的）"
            },
            {
              "key": "54.ps.3",
              "text": "会说出事情的先后顺序与原因"
            },
            {
              "key": "54.ps.4",
              "text": "认得一些字或数字"
            },
            {
              "key": "54.ps.5",
              "text": "会自己想办法解决遇到的问题"
            },
            {
              "key": "54.ps.6",
              "text": "能照着两三个步骤完成一件事"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "54.so.1",
              "text": "能在团体中遵守规则"
            },
            {
              "key": "54.so.2",
              "text": "能主动邀请别人一起玩"
            },
            {
              "key": "54.so.3",
              "text": "有固定会一起玩的朋友"
            },
            {
              "key": "54.so.4",
              "text": "会看情况添减衣服（提醒后）"
            },
            {
              "key": "54.so.5",
              "text": "会自己准备简单的点心"
            },
            {
              "key": "54.so.6",
              "text": "遇到冲突会试着用说的解决"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    },
    {
      "key": "60",
      "name": "60 个月题组",
      "minM": 57,
      "maxM": 66,
      "sections": [
        {
          "key": "cm",
          "name": "沟通",
          "options": "main",
          "items": [
            {
              "key": "60.cm.1",
              "text": "能按顺序把一件事说清楚（先…然后…最后…）"
            },
            {
              "key": "60.cm.2",
              "text": "会解释游戏规则给别人听"
            },
            {
              "key": "60.cm.3",
              "text": "会问有深度的问题并听懂回答"
            },
            {
              "key": "60.cm.4",
              "text": "能听懂并转述别人交代的话"
            },
            {
              "key": "60.cm.5",
              "text": "说话发音清楚，几乎没有错音"
            },
            {
              "key": "60.cm.6",
              "text": "会用连接词把想法组织起来"
            }
          ]
        },
        {
          "key": "gm",
          "name": "粗大动作",
          "options": "main",
          "items": [
            {
              "key": "60.gm.1",
              "text": "能单脚站十秒左右"
            },
            {
              "key": "60.gm.2",
              "text": "会跳绳或做出类似的协调动作"
            },
            {
              "key": "60.gm.3",
              "text": "会单脚交替跳（skip）"
            },
            {
              "key": "60.gm.4",
              "text": "能边跑边接球或闪避"
            },
            {
              "key": "60.gm.5",
              "text": "会自己荡秋千、把身体荡起来"
            },
            {
              "key": "60.gm.6",
              "text": "能连续拍球并走动"
            }
          ]
        },
        {
          "key": "fm",
          "name": "精细动作",
          "options": "main",
          "items": [
            {
              "key": "60.fm.1",
              "text": "会写自己的名字"
            },
            {
              "key": "60.fm.2",
              "text": "会照着画菱形或较复杂的图形"
            },
            {
              "key": "60.fm.3",
              "text": "会自己绑鞋带或打结"
            },
            {
              "key": "60.fm.4",
              "text": "画的人有六个以上的部位"
            },
            {
              "key": "60.fm.5",
              "text": "能用剪刀剪出复杂的形状"
            },
            {
              "key": "60.fm.6",
              "text": "写字大小大致能控制在格子里"
            }
          ]
        },
        {
          "key": "ps",
          "name": "解决问题",
          "options": "main",
          "items": [
            {
              "key": "60.ps.1",
              "text": "会做十以内的加减"
            },
            {
              "key": "60.ps.2",
              "text": "懂得左右"
            },
            {
              "key": "60.ps.3",
              "text": "会说出事情的先后顺序与原因"
            },
            {
              "key": "60.ps.4",
              "text": "认得不少字或会拼简单的字"
            },
            {
              "key": "60.ps.5",
              "text": "会自己想办法解决遇到的问题"
            },
            {
              "key": "60.ps.6",
              "text": "能照着步骤完成一件需要计划的事"
            }
          ]
        },
        {
          "key": "so",
          "name": "个人社交",
          "options": "main",
          "items": [
            {
              "key": "60.so.1",
              "text": "能在团体中遵守规则"
            },
            {
              "key": "60.so.2",
              "text": "能主动邀请别人一起玩"
            },
            {
              "key": "60.so.3",
              "text": "有固定会一起玩的朋友"
            },
            {
              "key": "60.so.4",
              "text": "会看情况添减衣服"
            },
            {
              "key": "60.so.5",
              "text": "会自己准备简单的点心"
            },
            {
              "key": "60.so.6",
              "text": "遇到冲突会试着用说的解决"
            }
          ]
        },
        {
          "key": "OVERALL",
          "name": "整体情况",
          "options": "yesno",
          "items": [
            {
              "key": "ov.hear",
              "text": "您觉得孩子听得清楚吗？"
            },
            {
              "key": "ov.see",
              "text": "您觉得孩子看得清楚吗？"
            },
            {
              "key": "ov.move",
              "text": "孩子的手脚动作是不是两边一样灵活、一样有力？",
              "month": 3
            },
            {
              "key": "ov.walk",
              "text": "孩子走路或跑步时，脚跟有没有着地？（不是一直踮脚）",
              "month": 15
            },
            {
              "key": "ov.talk",
              "text": "您觉得孩子说的话，家里的人听得懂吗？",
              "month": 18
            },
            {
              "key": "ov.feed",
              "text": "孩子吃东西、吞咽有没有困难？"
            },
            {
              "key": "ov.regress",
              "text": "最近有没有出现原本会的能力变得不会了？"
            },
            {
              "key": "ov.family",
              "text": "家中有没有其他人有听力、语言或发育方面的问题？"
            },
            {
              "key": "ov.worry",
              "text": "您对孩子的行为或发育有没有担心的地方？"
            }
          ]
        },
        {
          "key": "RED",
          "name": "需要特别留意的情形（有就选「有」）",
          "options": "hasnot",
          "items": [
            {
              "key": "red.1.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.2",
              "text": "满 3 个月仍不会注视人脸或对人笑",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.3",
              "text": "对大的声音完全没有反应",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.4",
              "text": "身体持续过软或过硬",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.5",
              "text": "满 4 个月头仍无法自己稳住",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.6",
              "text": "吸吮无力、喂食时间异常地长",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.1.7",
              "text": "两侧手脚的动作明显不对称",
              "month": 3,
              "maxMonth": 6
            },
            {
              "key": "red.2.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.2",
              "text": "叫名字没有反应",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.3",
              "text": "不会发出连续的语音（爸爸、妈妈这类音）",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.4",
              "text": "满 9 个月仍无法自己坐稳",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.5",
              "text": "不会用手指或手势表达",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.6",
              "text": "不找被藏起来的东西、对人脸缺乏兴趣",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.2.7",
              "text": "一侧手脚明显很少使用",
              "month": 7,
              "maxMonth": 12
            },
            {
              "key": "red.3.1",
              "text": "能力倒退——原本会说的词或会做的事不见了",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.2",
              "text": "满 18 个月仍不会走",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.3",
              "text": "满 18 个月词汇量少于十个",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.4",
              "text": "不与人对视，对叫名字没有反应",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.5",
              "text": "没有任何假装游戏（喂娃娃、开车车）",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.6",
              "text": "不会用手指出想要的东西",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.3.8",
              "text": "喂食或吞咽明显困难",
              "month": 13,
              "maxMonth": 25
            },
            {
              "key": "red.4.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.2",
              "text": "不会说短句、词汇量明显偏少",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.3",
              "text": "家人也听不懂他说的大部分内容",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.4",
              "text": "不与人对视，对同伴没有兴趣",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.5",
              "text": "没有假装游戏",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.6",
              "text": "经常跌倒、动作明显笨拙，或一侧肢体很少使用",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.7",
              "text": "反复刻板动作、对变化极度抗拒",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.4.8",
              "text": "喂食或吞咽明显困难",
              "month": 26,
              "maxMonth": 44
            },
            {
              "key": "red.5.1",
              "text": "能力倒退——原本会的现在不会了",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.2",
              "text": "陌生人听不懂他说话",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.3",
              "text": "无法说出完整的句子或讲清一件事",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.4",
              "text": "不会和同伴一起玩、没有朋友",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.5",
              "text": "无法遵守简单规则、几乎无法等待",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.6",
              "text": "动作明显笨拙，跑跳与同龄孩子差距大",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.7",
              "text": "无法自己穿脱衣物或如厕",
              "month": 45,
              "maxMonth": 66
            },
            {
              "key": "red.5.8",
              "text": "注意力极短，几乎无法完成一件事",
              "month": 45,
              "maxMonth": 66
            }
          ]
        }
      ]
    }
  ],
  "scoring": {
    "levels": [
      {
        "min": 85,
        "name": "未见明显问题"
      },
      {
        "min": 70,
        "name": "轻微落后"
      },
      {
        "min": 55,
        "name": "中度落后"
      },
      {
        "min": 0,
        "name": "明显落后"
      }
    ],
    "domainDim": {
      "cm": "LANG",
      "gm": "MOT",
      "fm": "MOT",
      "ps": "COG",
      "so": "SOC"
    },
    "perItemMax": 10,
    "overallWarn": {
      "ov.hear": 0,
      "ov.see": 0,
      "ov.move": 0,
      "ov.walk": 0,
      "ov.talk": 0,
      "ov.feed": 1,
      "ov.regress": 1,
      "ov.family": 1,
      "ov.worry": 1
    },
    "referOverall": [
      "ov.hear",
      "ov.see",
      "ov.regress",
      "ov.move"
    ],
    "referBelow": 55
  }
};
