import { PRODUCT } from './productConfig';
import type { ReportSpecialist } from './utils/specialists';

/**
 * 森心康自己的三位專家 —— **只有專案 A 用得到**。
 *
 * 專案 B 的每一家合作公司自備專家，名單改由 `/api/specialists` 依家長的歸屬
 * 供應（見 `utils/specialists.ts`）。這份常數在 B 的建置裡不會被讀到，
 * 也不會退回來當備援：那會讓合作公司的家長看到三位森心康醫師的姓名與照片。
 *
 * 【為什麼從 `AnalysisReport.tsx` 搬出來】
 * 這三段是**真人的簡歷**，裡面的「脑瘫、学习障碍、康复治疗、疾病临床诊疗」是他們
 * 實際的專長與經歷，能省略但不能改寫。而報告元件本身受《家长报告用语对照表》
 * 約束，那些字一個都不准出現（`test/parentWording.structure.test.ts`）。
 * 兩條規則在同一個檔案裡打架，只能分開住：這個檔案明確豁免，報告元件一律受檢。
 */
export const BUILTIN_SPECIALISTS: ReportSpecialist[] = [
  {
    id: 'spec-1',
    name: '王素娟',
    title: '儿童专科医院 副主任医师',
    avatarUrl: '/expert-wang.jpg',
    specialty: '儿童脑瘫的系统管理与康复、脑损伤后遗症的全面康复干预、高危新生儿的长期随访与发育监测、学习障碍、阅读障碍、书写障碍等发育障碍的康复治疗。',
    experience: '从业30年，复旦大学附属儿科医院，中国康复医学会康复评定专委会委员，中国妇幼保健协会高危儿专业委员',
    slots: ['周四上午', '周五下午', '周六上午']
  },
  {
    id: 'spec-2',
    name: '何明哲',
    title: '国家合格康复督导师',
    avatarUrl: '/expert-he.jpg',
    specialty: '儿童作业、心理、多动症、自闭症、学习障碍、言语功能等干预训练，儿童发育迟缓调整训练。',
    // 品牌職稱那一句由 PRODUCT.brand.bioClause 提供，B 為 null 即整段不出現。
    // 其餘資歷一字不動 —— 這是真人的簡歷，能省略但不能改寫。
    experience: `从业20年，中国台湾大学职能治疗学系，台北护理大学语言治疗病理学硕士，${PRODUCT.brand.bioClause ?? ''}上海星晨儿童医院（暨复旦大学附设儿科医院新虹桥分院）康复科督导`,
    slots: ['周一上午', '周二下午', '周三上午']
  },
  {
    id: 'spec-3',
    name: '张厚亮',
    title: '神经内科医学博士、院长',
    avatarUrl: '/expert-zhang.png',
    specialty: '神经内科医学、脑神经专家、神经内科疑难杂症干细胞修复治疗、功能医学辅助神经康复。',
    experience: '26 年神经系统疾病临床诊疗经验，美年大健康门诊部院长，华山医院神经内科、中心医院神经内科、上海新起点康复医院副院长',
    slots: ['周三上午', '周五上午', '周日上午']
  }
];
