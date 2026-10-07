/**
 * 客戶《T2 量表推荐规则规格书 v1.0》附錄 A 的規則設定，原樣（T2 v3 推薦規格 §3）。
 *
 * 由 `scripts/t2-extract-recommend-config.ts` 從下面這份 docx 產生，**請勿手改** —— `test/t2RecommendConfig.test.ts`
 * 會重跑比對。客戶改了規格書就換檔重抽。
 *   docs/reference/client-mockups/森心康_T2量表推荐规则规格书_v1.0-2026-10-06.docx（sha256 d3cd51a54c61…）
 */

import type { RecommendConfig } from './types';

export const RECOMMEND_CONFIG: RecommendConfig = {
  "tools": {
    "SXK-ASQ3": {
      "name": "分龄发育综合评估",
      "rater": [
        "P"
      ],
      "minM": 1,
      "maxM": 66,
      "minutes": 20,
      "primary": [
        "MOT",
        "LANG",
        "COG",
        "SOC"
      ],
      "secondary": [
        "ADL"
      ],
      "group": "BROAD",
      "layer": "T2"
    },
    "SXK-ADP": {
      "name": "适应能力发展量表",
      "rater": [
        "P",
        "C"
      ],
      "minM": 0,
      "maxM": 84,
      "minutes": 25,
      "primary": [
        "COG"
      ],
      "secondary": [
        "LEARN",
        "ADL"
      ],
      "group": "BROAD",
      "layer": "T2"
    },
    "M-CHAT-R/F": {
      "name": "改良版婴幼儿自闭症筛查",
      "rater": [
        "P"
      ],
      "minM": 16,
      "maxM": 30,
      "minutes": 10,
      "primary": [
        "SOC"
      ],
      "secondary": [
        "LANG"
      ],
      "group": "SOCG",
      "layer": "T2"
    },
    "ITQ/TTS/BSQ": {
      "name": "婴幼儿气质评估",
      "rater": [
        "P"
      ],
      "minM": 4,
      "maxM": 84,
      "minutes": 20,
      "primary": [],
      "secondary": [
        "EMO",
        "SEN"
      ],
      "group": "TEMP",
      "layer": "T2"
    },
    "SXK-QOL": {
      "name": "儿童生活质量量表",
      "rater": [
        "P",
        "S"
      ],
      "minM": 24,
      "maxM": 216,
      "minutes": 10,
      "primary": [],
      "secondary": [],
      "group": "QOL",
      "layer": "T2"
    },
    "SXK-PLC": {
      "name": "语言前能力发展量表",
      "rater": [
        "P",
        "C"
      ],
      "minM": 0,
      "maxM": 42,
      "minutes": 25,
      "primary": [
        "LANG"
      ],
      "secondary": [
        "SOC"
      ],
      "group": "LANGG",
      "layer": "T2"
    },
    "SXK-VOC": {
      "name": "0–3 词汇量检核表",
      "rater": [
        "P"
      ],
      "minM": 8,
      "maxM": 42,
      "minutes": 20,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "LANGG",
      "layer": "T2"
    },
    "SXK-LQ": {
      "name": "儿童语言发展家长问卷",
      "rater": [
        "P"
      ],
      "minM": 12,
      "maxM": 72,
      "minutes": 15,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "LANGG",
      "layer": "T2"
    },
    "SXK-LANG": {
      "name": "语言能力发展量表",
      "rater": [
        "P",
        "C"
      ],
      "minM": 0,
      "maxM": 144,
      "minutes": 35,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "LANGG",
      "layer": "T2"
    },
    "SXK-ASR": {
      "name": "社交沟通行为量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 24,
      "maxM": 180,
      "minutes": 15,
      "primary": [
        "SOC"
      ],
      "secondary": [
        "LANG"
      ],
      "group": "SOCG",
      "layer": "T2"
    },
    "SXK-SOC": {
      "name": "社会能力发展量表",
      "rater": [
        "P",
        "T",
        "C"
      ],
      "minM": 0,
      "maxM": 84,
      "minutes": 25,
      "primary": [
        "SOC"
      ],
      "secondary": [
        "EMO"
      ],
      "group": "SOCG",
      "layer": "T2"
    },
    "SXK-ASB": {
      "name": "自闭行为量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 18,
      "maxM": 180,
      "minutes": 20,
      "primary": [
        "SOC"
      ],
      "secondary": [
        "SEN"
      ],
      "group": "SOCG",
      "layer": "T2"
    },
    "SXK-GM": {
      "name": "粗大动作发展量表",
      "rater": [
        "P",
        "C"
      ],
      "minM": 0,
      "maxM": 84,
      "minutes": 25,
      "primary": [
        "MOT"
      ],
      "secondary": [],
      "group": "MOTG",
      "layer": "T2"
    },
    "SXK-SP": {
      "name": "感觉处理记录量表",
      "rater": [
        "P"
      ],
      "minM": 24,
      "maxM": 59,
      "minutes": 20,
      "primary": [
        "SEN"
      ],
      "secondary": [
        "EMO"
      ],
      "group": "SENG",
      "layer": "T2"
    },
    "SXK-SPb": {
      "name": "感觉处理记录量表（学龄版）",
      "rater": [
        "P",
        "T"
      ],
      "minM": 60,
      "maxM": 180,
      "minutes": 20,
      "primary": [
        "SEN"
      ],
      "secondary": [
        "ATT"
      ],
      "group": "SENG",
      "layer": "T2"
    },
    "SXK-ADL": {
      "name": "生活自理功能量表",
      "rater": [
        "P",
        "C"
      ],
      "minM": 18,
      "maxM": 180,
      "minutes": 20,
      "primary": [
        "ADL"
      ],
      "secondary": [
        "MOT"
      ],
      "group": "ADLG",
      "layer": "T2"
    },
    "SXK-AB": {
      "name": "注意力及行为观察量表",
      "rater": [
        "P",
        "T",
        "S"
      ],
      "minM": 36,
      "maxM": 192,
      "minutes": 15,
      "primary": [
        "ATT"
      ],
      "secondary": [
        "EMO"
      ],
      "group": "ATTG",
      "layer": "T2"
    },
    "SXK-ATT": {
      "name": "注意力及多动量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 48,
      "maxM": 180,
      "minutes": 15,
      "primary": [
        "ATT"
      ],
      "secondary": [],
      "group": "ATTG",
      "layer": "T2"
    },
    "SNAP-IV": {
      "name": "SNAP-IV 评量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 72,
      "maxM": 216,
      "minutes": 10,
      "primary": [
        "ATT"
      ],
      "secondary": [
        "EMO"
      ],
      "group": "ATTG",
      "layer": "T2"
    },
    "CHEXI": {
      "name": "儿童执行功能量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 48,
      "maxM": 156,
      "minutes": 10,
      "primary": [
        "ATT"
      ],
      "secondary": [
        "LEARN"
      ],
      "group": "ATTG",
      "layer": "T2"
    },
    "SXK-LDP": {
      "name": "学习障碍量表（小学版）",
      "rater": [
        "P",
        "T"
      ],
      "minM": 72,
      "maxM": 215,
      "minutes": 25,
      "primary": [
        "LEARN"
      ],
      "secondary": [
        "COG"
      ],
      "group": "LRNG",
      "layer": "T2"
    },
    "SXK-LDS": {
      "name": "学习障碍量表（中学版）",
      "rater": [
        "S",
        "P",
        "T"
      ],
      "minM": 144,
      "maxM": 215,
      "minutes": 30,
      "primary": [
        "LEARN"
      ],
      "secondary": [
        "COG"
      ],
      "group": "LRNG",
      "layer": "T2"
    },
    "SXK-EMO": {
      "name": "儿童情绪与焦虑筛查量表",
      "rater": [
        "P",
        "T"
      ],
      "minM": 36,
      "maxM": 155,
      "minutes": 15,
      "primary": [
        "EMO"
      ],
      "secondary": [],
      "group": "EMOG",
      "layer": "T2"
    },
    "SXK-TIC": {
      "name": "抽动严重程度评估量表",
      "rater": [
        "C",
        "P",
        "S"
      ],
      "minM": 48,
      "maxM": 215,
      "minutes": 20,
      "primary": [
        "EMO"
      ],
      "secondary": [],
      "group": "TICG",
      "layer": "T2"
    },
    "SXK-PLE": {
      "name": "学前儿童语言评估量表",
      "rater": [
        "C"
      ],
      "minM": 36,
      "maxM": 84,
      "minutes": 45,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "",
      "layer": "T3"
    },
    "SXK-SEN": {
      "name": "句子理解与表达评估量表",
      "rater": [
        "C"
      ],
      "minM": 24,
      "maxM": 107,
      "minutes": 35,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "",
      "layer": "T3"
    },
    "SXK-ART": {
      "name": "构音与音韵评估量表",
      "rater": [
        "C"
      ],
      "minM": 30,
      "maxM": 107,
      "minutes": 40,
      "primary": [
        "LANG"
      ],
      "secondary": [],
      "group": "",
      "layer": "T3"
    },
    "SXK-NAR": {
      "name": "儿童叙事能力评估量表",
      "rater": [
        "C"
      ],
      "minM": 30,
      "maxM": 155,
      "minutes": 40,
      "primary": [
        "LANG"
      ],
      "secondary": [
        "LEARN"
      ],
      "group": "",
      "layer": "T3"
    },
    "SXK-SMA": {
      "name": "儿童动作表现评估量表",
      "rater": [
        "C"
      ],
      "minM": 24,
      "maxM": 95,
      "minutes": 45,
      "primary": [
        "MOT"
      ],
      "secondary": [
        "SEN"
      ],
      "group": "",
      "layer": "T3"
    },
    "SXK-WISC": {
      "name": "韦氏智力测验结果分析工具",
      "rater": [
        "C"
      ],
      "minM": 30,
      "maxM": 203,
      "minutes": 30,
      "primary": [
        "COG"
      ],
      "secondary": [
        "LEARN"
      ],
      "group": "",
      "layer": "T3"
    },
    "SXK-ROCF": {
      "name": "Rey 复杂图形测验",
      "rater": [
        "C"
      ],
      "minM": 72,
      "maxM": 203,
      "minutes": 35,
      "primary": [
        "COG"
      ],
      "secondary": [
        "ATT"
      ],
      "group": "",
      "layer": "T3"
    }
  },
  "groupMax": {
    "SOCG": 2,
    "LANGG": 2,
    "ATTG": 2,
    "SENG": 1,
    "LRNG": 1,
    "BROAD": 1,
    "MOTG": 1,
    "ADLG": 1,
    "EMOG": 1,
    "TICG": 1,
    "QOL": 1,
    "TEMP": 1
  },
  "dx": {
    "NONE": {
      "name": "无诊断（仅依 T1）",
      "core": [],
      "rel": [],
      "diff": [],
      "must": []
    },
    "LDADHD": {
      "name": "学习障碍与多动症",
      "core": [
        "ATT",
        "LEARN"
      ],
      "rel": [
        "COG",
        "EMO"
      ],
      "diff": [
        "SEN",
        "LANG"
      ],
      "must": []
    },
    "ASD": {
      "name": "自闭症（孤独症谱系）",
      "core": [
        "SOC",
        "LANG"
      ],
      "rel": [
        "SEN",
        "EMO",
        "ADL"
      ],
      "diff": [
        "COG"
      ],
      "must": [
        "M-CHAT-R/F",
        "SXK-ASB"
      ]
    },
    "GDD": {
      "name": "发展迟缓与智力发展迟缓",
      "core": [
        "COG",
        "ADL",
        "LANG",
        "MOT"
      ],
      "rel": [
        "SOC"
      ],
      "diff": [
        "SEN"
      ],
      "must": [
        "SXK-ASQ3"
      ]
    },
    "CP": {
      "name": "脑性瘫痪",
      "core": [
        "MOT",
        "ADL"
      ],
      "rel": [
        "LANG",
        "SEN"
      ],
      "diff": [
        "COG"
      ],
      "must": [
        "SXK-GM",
        "SXK-ADL",
        "SXK-QOL"
      ]
    },
    "EMO": {
      "name": "情绪障碍与心理障碍",
      "core": [
        "EMO"
      ],
      "rel": [
        "ATT",
        "SOC"
      ],
      "diff": [
        "SEN",
        "LEARN"
      ],
      "must": [
        "SXK-EMO",
        "SXK-QOL"
      ]
    },
    "LANG": {
      "name": "语言发展障碍",
      "core": [
        "LANG"
      ],
      "rel": [
        "SOC"
      ],
      "diff": [
        "COG"
      ],
      "must": []
    }
  },
  "dxMinAge": {
    "LDADHD": 36,
    "EMO": 36
  },
  "keyItems": [
    {
      "band": "A",
      "dim": "ATT",
      "idx": 0,
      "tag": "ASD_SIG",
      "cond": ">=1"
    },
    {
      "band": "A",
      "dim": "ATT",
      "idx": 2,
      "tag": "ASD_SIG",
      "cond": ">=1"
    },
    {
      "band": "A",
      "dim": "LANG",
      "idx": 3,
      "tag": "ASD_SIG",
      "cond": ">=1"
    },
    {
      "band": "A",
      "dim": "SOC",
      "idx": 3,
      "tag": "ASD_SIG",
      "cond": ">=1"
    },
    {
      "band": "B",
      "dim": "SOC",
      "idx": 0,
      "tag": "ASD_SIG",
      "cond": ">=1"
    },
    {
      "band": "A",
      "dim": "LANG",
      "idx": 1,
      "tag": "NONVERBAL",
      "cond": "==2"
    },
    {
      "band": "B",
      "dim": "LANG",
      "idx": 0,
      "tag": "NONVERBAL",
      "cond": "==2"
    },
    {
      "band": "B",
      "dim": "LANG",
      "idx": 1,
      "tag": "ARTIC",
      "cond": ">=1"
    },
    {
      "band": "C",
      "dim": "LANG",
      "idx": 1,
      "tag": "ARTIC",
      "cond": ">=1"
    },
    {
      "band": "C",
      "dim": "LANG",
      "idx": 3,
      "tag": "NARR",
      "cond": ">=1"
    },
    {
      "band": "D",
      "dim": "LANG",
      "idx": 0,
      "tag": "NARR",
      "cond": ">=1"
    },
    {
      "band": "D",
      "dim": "LANG",
      "idx": 3,
      "tag": "READ",
      "cond": ">=1"
    },
    {
      "band": "D",
      "dim": "LEARN",
      "idx": 0,
      "tag": "LD_SIG",
      "cond": "==2"
    },
    {
      "band": "E",
      "dim": "LEARN",
      "idx": 0,
      "tag": "LD_SIG",
      "cond": "==2"
    },
    {
      "band": "D",
      "dim": "MOT",
      "idx": 2,
      "tag": "WRITE",
      "cond": ">=1"
    },
    {
      "band": "E",
      "dim": "MOT",
      "idx": 1,
      "tag": "WRITE",
      "cond": ">=1"
    },
    {
      "band": "D",
      "dim": "SOC",
      "idx": 2,
      "tag": "PRAG",
      "cond": ">=1"
    },
    {
      "band": "E",
      "dim": "LANG",
      "idx": 1,
      "tag": "PRAG",
      "cond": ">=1"
    },
    {
      "band": "E",
      "dim": "LANG",
      "idx": 3,
      "tag": "PRAG",
      "cond": ">=1"
    },
    {
      "band": "E",
      "dim": "EMO",
      "idx": 3,
      "tag": "SAFETY",
      "cond": "==2"
    },
    {
      "band": "A",
      "dim": "MOT",
      "idx": 0,
      "tag": "MED_MOT",
      "cond": "==2"
    },
    {
      "band": "B",
      "dim": "MOT",
      "idx": 0,
      "tag": "MED_MOT",
      "cond": "==2"
    }
  ]
};
