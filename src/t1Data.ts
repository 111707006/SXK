import { Question } from './types';

export interface T1Question {
  id: string;
  dimensionId: string;
  dimensionName: string;
  text: string;
  options: { label: string; score: number }[];
  isRedFlag?: boolean;
}

export interface T1AgeBand {
  id: string;
  name: string;
  minAge: number;
  maxAge: number;
  questions: T1Question[];
}

const stdOptions = [
  { label: '可以做到', score: 2 },
  { label: '有时・部分', score: 1 },
  { label: '还不能', score: 0 }
];

export const T1_AGE_BANDS: T1AgeBand[] = [
  {
    id: 'A',
    name: 'A 段 1-2 岁 (幼儿早期)',
    minAge: 12,
    maxAge: 23,
    questions: [
      // 1. gross_motor -> 动作发展
      { id: 't1_a_01', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能不需扶持，自己走得很稳', options: stdOptions, isRedFlag: true },
      { id: 't1_a_02', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '会跑，很少跌倒', options: stdOptions },
      { id: 't1_a_03', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能弯腰捡起东西后自己站好', options: stdOptions },
      { id: 't1_a_04', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能扶着栏杆上楼梯，或把球往前踢', options: stdOptions },

      // 2. fine_motor -> 感觉处理
      { id: 't1_a_05', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '接受多种质地的食物，不严重抗拒', options: stdOptions },
      { id: 't1_a_06', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '对日常声音（吸尘器、吹风机）不过度惊恐', options: stdOptions },
      { id: 't1_a_07', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '喜欢拥抱抚触，不明显排斥被碰', options: stdOptions },
      { id: 't1_a_08', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '玩摇晃、举高游戏时反应适度（不过度害怕或不停索求）', options: stdOptions },

      // 3. cognitive -> 认知
      { id: 't1_a_09', dimensionId: 'cognitive', dimensionName: '认知', text: '会模仿大人的动作（擦桌子、打电话）', options: stdOptions },
      { id: 't1_a_10', dimensionId: 'cognitive', dimensionName: '认知', text: '能找到当面藏起来的玩具', options: stdOptions },
      { id: 't1_a_11', dimensionId: 'cognitive', dimensionName: '认知', text: '知道常见物品的用途（杯子喝水、梳子梳头）', options: stdOptions },
      { id: 't1_a_12', dimensionId: 'cognitive', dimensionName: '认知', text: '能把积木放进杯子，或完成简单形状配对', options: stdOptions },

      // 4. attention -> 注意力与执行
      { id: 't1_a_13', dimensionId: 'attention', dimensionName: '注意力与执行', text: '叫名字会回头或有反应', options: stdOptions, isRedFlag: true },
      { id: 't1_a_14', dimensionId: 'attention', dimensionName: '注意力与执行', text: '能专注玩同一个玩具几分钟', options: stdOptions },
      { id: 't1_a_15', dimensionId: 'attention', dimensionName: '注意力与执行', text: '会顺着大人手指的方向看向同一个东西', options: stdOptions },
      { id: 't1_a_16', dimensionId: 'attention', dimensionName: '注意力与执行', text: '递食物或玩具时能短暂等一下', options: stdOptions },

      // 5. family_env -> 学习能力
      { id: 't1_a_17', dimensionId: 'family_env', dimensionName: '学习能力', text: '对绘本有兴趣，会自己翻页看图', options: stdOptions },
      { id: 't1_a_18', dimensionId: 'family_env', dimensionName: '学习能力', text: '拿到笔会涂鸦乱画', options: stdOptions },
      { id: 't1_a_19', dimensionId: 'family_env', dimensionName: '学习能力', text: '能堆叠 2–4 块积木', options: stdOptions },
      { id: 't1_a_20', dimensionId: 'family_env', dimensionName: '学习能力', text: '示范后会尝试模仿新的玩法', options: stdOptions },

      // 6. language -> 语言沟通
      { id: 't1_a_21', dimensionId: 'language', dimensionName: '语言沟通', text: '会有意义地叫「爸爸／妈妈」', options: stdOptions },
      { id: 't1_a_22', dimensionId: 'language', dimensionName: '语言沟通', text: '除爸妈外，还会说出几个单词', options: stdOptions, isRedFlag: true },
      { id: 't1_a_23', dimensionId: 'language', dimensionName: '语言沟通', text: '听得懂简单指令（如「把鞋鞋拿来」）', options: stdOptions },
      { id: 't1_a_24', dimensionId: 'language', dimensionName: '语言沟通', text: '会用手指指出想要的东西', options: stdOptions },

      // 7. social_emotional -> 社交互动
      { id: 't1_a_25', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '会玩互拍手等来回互动的游戏', options: stdOptions },
      { id: 't1_a_26', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '会挥手掰掰', options: stdOptions },
      { id: 't1_a_27', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '对其他小朋友感兴趣（看、靠近）', options: stdOptions },
      { id: 't1_a_28', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '会把玩具拿给大人看或分享', options: stdOptions },

      // 8. sensory -> 情绪与行为
      { id: 't1_a_29', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '情绪爆发时能被安抚，可以转移注意', options: stdOptions },
      { id: 't1_a_30', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '与主要照顾者分开时的不安在合理范围', options: stdOptions },
      { id: 't1_a_31', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '见到熟悉的人会有开心的反应', options: stdOptions },
      { id: 't1_a_32', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '吃饭睡觉作息大致规律', options: stdOptions },

      // 9. self_care -> 生活自理与适应
      { id: 't1_a_33', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '会自己用杯子喝水', options: stdOptions },
      { id: 't1_a_34', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '会用勺子舀东西吃（允许洒出来）', options: stdOptions },
      { id: 't1_a_35', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '穿脱衣物时会配合伸手伸脚', options: stdOptions },
      { id: 't1_a_36', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '会用哭以外的方式表达需求（拉手、指物）', options: stdOptions }
    ]
  },
  {
    id: 'B',
    name: 'B 段 2-4 岁 (幼儿期)',
    minAge: 24,
    maxAge: 47,
    questions: [
      // 1. gross_motor -> 动作发展
      { id: 't1_b_01', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '会跑且很少跌倒', options: stdOptions, isRedFlag: true },
      { id: 't1_b_02', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '会双脚同时离地往上跳', options: stdOptions },
      { id: 't1_b_03', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能扶栏杆自己上下楼梯', options: stdOptions },
      { id: 't1_b_04', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能单脚站 1–2 秒，会踢球丢球', options: stdOptions },

      // 2. fine_motor -> 感觉处理
      { id: 't1_b_05', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '理发、洗头、剪指甲不引起强烈抗拒', options: stdOptions },
      { id: 't1_b_06', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '衣服标签、材质不引起强烈拒穿', options: stdOptions },
      { id: 't1_b_07', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '敢玩滑梯秋千等设施，反应适度', options: stdOptions },
      { id: 't1_b_08', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '对疼痛的反应正常（不过度迟钝或过度敏感）', options: stdOptions },

      // 3. cognitive -> 认知
      { id: 't1_b_09', dimensionId: 'cognitive', dimensionName: '认知', text: '认得一些颜色或大小', options: stdOptions },
      { id: 't1_b_10', dimensionId: 'cognitive', dimensionName: '认知', text: '会玩假装游戏（喂娃娃、开车车）', options: stdOptions },
      { id: 't1_b_11', dimensionId: 'cognitive', dimensionName: '认知', text: '能完成简单的形状配对或拼图', options: stdOptions },
      { id: 't1_b_12', dimensionId: 'cognitive', dimensionName: '认知', text: '会点数 1–3 个东西', options: stdOptions },

      // 4. attention -> 注意力与执行
      { id: 't1_b_13', dimensionId: 'attention', dimensionName: '注意力与执行', text: '能安坐听故事或玩桌面游戏 5 分钟以上', options: stdOptions },
      { id: 't1_b_14', dimensionId: 'attention', dimensionName: '注意力与执行', text: '做一件事能做完，不总是中途走开', options: stdOptions },
      { id: 't1_b_15', dimensionId: 'attention', dimensionName: '注意力与执行', text: '日常流程不需要一直反复提醒', options: stdOptions },
      { id: 't1_b_16', dimensionId: 'attention', dimensionName: '注意力与执行', text: '活动量停得下来（不是整天动个不停）', options: stdOptions },

      // 5. family_env -> 学习能力
      { id: 't1_b_17', dimensionId: 'family_env', dimensionName: '学习能力', text: '能听完一个简短的绘本故事', options: stdOptions },
      { id: 't1_b_18', dimensionId: 'family_env', dimensionName: '学习能力', text: '会模仿画直线或圆圈', options: stdOptions },
      { id: 't1_b_19', dimensionId: 'family_env', dimensionName: '学习能力', text: '记得日常常规的顺序（回家先洗手等）', options: stdOptions },
      { id: 't1_b_20', dimensionId: 'family_env', dimensionName: '学习能力', text: '能学会新的儿歌或手势动作', options: stdOptions },

      // 6. language -> 语言沟通
      { id: 't1_b_21', dimensionId: 'language', dimensionName: '语言沟通', text: '能把两三个词组成短句', options: stdOptions, isRedFlag: true },
      { id: 't1_b_22', dimensionId: 'language', dimensionName: '语言沟通', text: '讲话家人以外的人能听懂一半以上', options: stdOptions },
      { id: 't1_b_23', dimensionId: 'language', dimensionName: '语言沟通', text: '听得懂两步骤指令（「拿杯子给妈妈」）', options: stdOptions },
      { id: 't1_b_24', dimensionId: 'language', dimensionName: '语言沟通', text: '会回答简单问题（「这是什么？」「要不要？」）', options: stdOptions },

      // 7. social_emotional -> 社交互动
      { id: 't1_b_25', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '叫名字有反应、眼神接触自然', options: stdOptions, isRedFlag: true },
      { id: 't1_b_26', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '对同伴有兴趣，会一起玩或在旁边玩', options: stdOptions },
      { id: 't1_b_27', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '能简单地轮流、等待', options: stdOptions },
      { id: 't1_b_28', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '会注意到别人难过或受伤', options: stdOptions },

      // 8. sensory -> 情绪与行为
      { id: 't1_b_29', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '发脾气能在合理时间内平复', options: stdOptions },
      { id: 't1_b_30', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '会用语言表达「要／不要」', options: stdOptions },
      { id: 't1_b_31', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '遇到挫折会找大人帮忙，而不是只有崩溃', options: stdOptions },
      { id: 't1_b_32', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '转换活动（收玩具、出门）多数时候能配合', options: stdOptions },

      // 9. self_care -> 生活自理与适应
      { id: 't1_b_33', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '能自己用勺子吃完饭，洒得不多', options: stdOptions },
      { id: 't1_b_34', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '会自己脱简单的衣物鞋袜', options: stdOptions },
      { id: 't1_b_35', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '白天如厕训练顺利或已完成（3 岁后）', options: stdOptions },
      { id: 't1_b_36', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '配合洗手、刷牙', options: stdOptions }
    ]
  },
  {
    id: 'C',
    name: 'C 段 4-6 岁 (学龄前期)',
    minAge: 48,
    maxAge: 71,
    questions: [
      // 1. gross_motor -> 动作发展
      { id: 't1_c_01', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能单脚站 5 秒左右，会单脚跳', options: stdOptions },
      { id: 't1_c_02', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能接住反弹的球', options: stdOptions },
      { id: 't1_c_03', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '跑跳攀爬灵活，不常摔倒碰撞', options: stdOptions },
      { id: 't1_c_04', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '会骑三轮车或滑板车', options: stdOptions },

      // 2. fine_motor -> 感觉处理
      { id: 't1_c_05', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '在热闹嘈杂的环境不容易失控', options: stdOptions },
      { id: 't1_c_06', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '不抗拒手弄脏（颜料、沙子、黏土）', options: stdOptions },
      { id: 't1_c_07', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '坐姿能维持，不总是软趴趴靠着', options: stdOptions },
      { id: 't1_c_08', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '不过度寻求碰撞、挤压、旋转', options: stdOptions },

      // 3. cognitive -> 认知
      { id: 't1_c_09', dimensionId: 'cognitive', dimensionName: '认知', text: '能点数 10 以内的数量', options: stdOptions },
      { id: 't1_c_10', dimensionId: 'cognitive', dimensionName: '认知', text: '能按颜色、形状、大小分类', options: stdOptions },
      { id: 't1_c_11', dimensionId: 'cognitive', dimensionName: '认知', text: '理解上下、前后、里外等位置概念', options: stdOptions },
      { id: 't1_c_12', dimensionId: 'cognitive', dimensionName: '认知', text: '遇到小问题会想办法（绕开障碍、求助）', options: stdOptions },

      // 4. attention -> 注意力与执行
      { id: 't1_c_13', dimensionId: 'attention', dimensionName: '注意力与执行', text: '能专注完成 10–15 分钟的活动', options: stdOptions },
      { id: 't1_c_14', dimensionId: 'attention', dimensionName: '注意力与执行', text: '团体课堂能坐得住', options: stdOptions },
      { id: 't1_c_15', dimensionId: 'attention', dimensionName: '注意力与执行', text: '自己的物品不总是丢三落四', options: stdOptions },
      { id: 't1_c_16', dimensionId: 'attention', dimensionName: '注意力与执行', text: '能等轮到自己（排队、轮流）', options: stdOptions },

      // 5. family_env -> 学习能力
      { id: 't1_c_17', dimensionId: 'family_env', dimensionName: '学习能力', text: '能照样画出圆形、十字、方形', options: stdOptions },
      { id: 't1_c_18', dimensionId: 'family_env', dimensionName: '学习能力', text: '认得自己的名字或一些常见字', options: stdOptions },
      { id: 't1_c_19', dimensionId: 'family_env', dimensionName: '学习能力', text: '会用剪刀沿线剪', options: stdOptions },
      { id: 't1_c_20', dimensionId: 'family_env', dimensionName: '学习能力', text: '记得并遵守日常规则', options: stdOptions },

      // 6. language -> 语言沟通
      { id: 't1_c_21', dimensionId: 'language', dimensionName: '语言沟通', text: '能用完整句子清楚说一件事', options: stdOptions },
      { id: 't1_c_22', dimensionId: 'language', dimensionName: '语言沟通', text: '发音清楚，陌生人几乎都听得懂', options: stdOptions, isRedFlag: true },
      { id: 't1_c_23', dimensionId: 'language', dimensionName: '语言沟通', text: '听得懂三步骤指令', options: stdOptions },
      { id: 't1_c_24', dimensionId: 'language', dimensionName: '语言沟通', text: '能看图说话或复述简短故事', options: stdOptions },

      // 7. social_emotional -> 社交互动
      { id: 't1_c_25', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '有固定玩伴，会合作游戏', options: stdOptions },
      { id: 't1_c_26', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '懂得轮流、分享的规则', options: stdOptions },
      { id: 't1_c_27', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '会玩角色扮演类的假装游戏', options: stdOptions },
      { id: 't1_c_28', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '能看出别人表情代表的情绪', options: stdOptions },

      // 8. sensory -> 情绪与行为
      { id: 't1_c_29', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '游戏输了能接受，不长时间崩溃', options: stdOptions },
      { id: 't1_c_30', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '会用语言表达生气、难过等情绪', options: stdOptions },
      { id: 't1_c_31', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '害怕或担心不至于影响上学、睡眠', options: stdOptions },
      { id: 't1_c_32', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '情绪转换较快，不长时间闹别扭', options: stdOptions },

      // 9. self_care -> 生活自理与适应
      { id: 't1_c_33', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '能独立吃饭、穿脱衣物（扣子鞋带除外）', options: stdOptions },
      { id: 't1_c_34', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '能独立如厕', options: stdOptions },
      { id: 't1_c_35', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '会帮忙简单家务（收碗、拿东西）', options: stdOptions },
      { id: 't1_c_36', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '懂得基本安全规则（过马路、热水）', options: stdOptions }
    ]
  },
  {
    id: 'D',
    name: 'D 段 6-10 岁 (学龄期)',
    minAge: 72,
    maxAge: 119,
    questions: [
      // 1. gross_motor -> 动作发展
      { id: 't1_d_01', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '跑跳投接与同龄孩子相当', options: stdOptions },
      { id: 't1_d_02', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能学会跳绳或骑两轮自行车', options: stdOptions },
      { id: 't1_d_03', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '写字不至于特别费力、歪扭', options: stdOptions },
      { id: 't1_d_04', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '体育课上不明显笨拙、落后', options: stdOptions },

      // 2. fine_motor -> 感觉处理
      { id: 't1_d_05', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '对声音、光线、嘈杂环境耐受正常', options: stdOptions },
      { id: 't1_d_06', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '衣物、食物的质地没有严格受限', options: stdOptions },
      { id: 't1_d_07', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '课堂上不因动来动去、咬东西影响学习', options: stdOptions },
      { id: 't1_d_08', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '扣扣子、拉拉链等精细操作顺畅', options: stdOptions },

      // 3. cognitive -> 认知
      { id: 't1_d_09', dimensionId: 'cognitive', dimensionName: '认知', text: '数学基本概念跟得上年级', options: stdOptions },
      { id: 't1_d_10', dimensionId: 'cognitive', dimensionName: '认知', text: '有基本的生活常识与推理判断', options: stdOptions },
      { id: 't1_d_11', dimensionId: 'cognitive', dimensionName: '认知', text: '能记住多步骤任务并完成', options: stdOptions },
      { id: 't1_d_12', dimensionId: 'cognitive', dimensionName: '认知', text: '有时间概念（今天／明天、初步看钟表）', options: stdOptions },

      // 4. attention -> 注意力与执行
      { id: 't1_d_13', dimensionId: 'attention', dimensionName: '注意力与执行', text: '课堂能专注听讲，不易分心', options: stdOptions },
      { id: 't1_d_14', dimensionId: 'attention', dimensionName: '注意力与执行', text: '写作业能坐得住，不严重拖拉', options: stdOptions },
      { id: 't1_d_15', dimensionId: 'attention', dimensionName: '注意力与执行', text: '不常忘带、丢失物品', options: stdOptions },
      { id: 't1_d_16', dimensionId: 'attention', dimensionName: '注意力与执行', text: '安静场合能控制小动作和插话', options: stdOptions },

      // 5. family_env -> 学习能力
      { id: 't1_d_17', dimensionId: 'family_env', dimensionName: '学习能力', text: '识字、书写水平与年级大致相当', options: stdOptions, isRedFlag: true },
      { id: 't1_d_18', dimensionId: 'family_env', dimensionName: '学习能力', text: '抄写不特别吃力，错漏不多', options: stdOptions },
      { id: 't1_d_19', dimensionId: 'family_env', dimensionName: '学习能力', text: '作业大部分能独立完成', options: stdOptions },
      { id: 't1_d_20', dimensionId: 'family_env', dimensionName: '学习能力', text: '学新内容不需要比同学多很多遍', options: stdOptions },

      // 6. language -> 语言沟通
      { id: 't1_d_21', dimensionId: 'language', dimensionName: '语言沟通', text: '能有条理地讲一件事（开头—经过—结果）', options: stdOptions },
      { id: 't1_d_22', dimensionId: 'language', dimensionName: '语言沟通', text: '听得懂课堂上较长的指令与说明', options: stdOptions },
      { id: 't1_d_23', dimensionId: 'language', dimensionName: '语言沟通', text: '词汇丰富，能说明自己的理由', options: stdOptions },
      { id: 't1_d_24', dimensionId: 'language', dimensionName: '语言沟通', text: '朗读流畅，理解跟得上年级', options: stdOptions },

      // 7. social_emotional -> 社交互动
      { id: 't1_d_25', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '有比较稳定的朋友', options: stdOptions },
      { id: 't1_d_26', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '团体游戏能遵守规则', options: stdOptions },
      { id: 't1_d_27', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '听得懂玩笑，能理解别人的想法', options: stdOptions },
      { id: 't1_d_28', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '有冲突时会协商，而不是动手或躲开', options: stdOptions },

      // 8. sensory -> 情绪与行为
      { id: 't1_d_29', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '遇到挫折失败能自我调节', options: stdOptions },
      { id: 't1_d_30', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '担心紧张不影响上学和睡眠', options: stdOptions },
      { id: 't1_d_31', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '能恰当表达情绪并与人沟通', options: stdOptions },
      { id: 't1_d_32', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '能适应变化（换座位、改计划）', options: stdOptions },

      // 9. self_care -> 生活自理与适应
      { id: 't1_d_33', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '洗漱、穿着完全自理', options: stdOptions },
      { id: 't1_d_34', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '书包物品整理有条理', options: stdOptions },
      { id: 't1_d_35', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '能按时起床、准备上学', options: stdOptions },
      { id: 't1_d_36', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '承担简单的家务责任', options: stdOptions }
    ]
  },
  {
    id: 'E',
    name: 'E 段 10-15 岁 (青少年期)',
    minAge: 120,
    maxAge: 180,
    questions: [
      // 1. gross_motor -> 动作发展
      { id: 't1_e_01', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '体育运动的协调性与同龄相当', options: stdOptions },
      { id: 't1_e_02', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '书写速度能应付课堂笔记', options: stdOptions },
      { id: 't1_e_03', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '能学会较复杂的运动动作（球类、舞蹈）', options: stdOptions },
      { id: 't1_e_04', dimensionId: 'gross_motor', dimensionName: '动作发展', text: '坐姿耐力正常，不总是瘫软趴桌', options: stdOptions },

      // 2. fine_motor -> 感觉处理
      { id: 't1_e_05', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '对嘈杂拥挤的环境耐受正常', options: stdOptions },
      { id: 't1_e_06', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '衣着、饮食没有明显的感觉受限', options: stdOptions },
      { id: 't1_e_07', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '困倦或烦躁时能自我调节状态', options: stdOptions },
      { id: 't1_e_08', dimensionId: 'fine_motor', dimensionName: '感觉处理', text: '长时间用眼用脑后能自行放松恢复', options: stdOptions },

      // 3. cognitive -> 认知
      { id: 't1_e_09', dimensionId: 'cognitive', dimensionName: '认知', text: '抽象推理（应用题、因果分析）跟得上', options: stdOptions },
      { id: 't1_e_10', dimensionId: 'cognitive', dimensionName: '认知', text: '能计划、安排多步骤的任务', options: stdOptions },
      { id: 't1_e_11', dimensionId: 'cognitive', dimensionName: '认知', text: '记忆和学习效率正常', options: stdOptions },
      { id: 't1_e_12', dimensionId: 'cognitive', dimensionName: '认知', text: '能举一反三，理解规则背后的道理', options: stdOptions },

      // 4. attention -> 注意力与执行
      { id: 't1_e_13', dimensionId: 'attention', dimensionName: '注意力与执行', text: '较长的课堂或自习能保持专注', options: stdOptions },
      { id: 't1_e_14', dimensionId: 'attention', dimensionName: '注意力与执行', text: '能自己启动任务，不严重拖延', options: stdOptions },
      { id: 't1_e_15', dimensionId: 'attention', dimensionName: '注意力与执行', text: '会安排作业优先顺序和作息', options: stdOptions },
      { id: 't1_e_16', dimensionId: 'attention', dimensionName: '注意力与执行', text: '说话做事能先想后行，冲动可控', options: stdOptions },

      // 5. family_env -> 学习能力
      { id: 't1_e_17', dimensionId: 'family_env', dimensionName: '学习能力', text: '成绩与付出的努力大致相称', options: stdOptions, isRedFlag: true },
      { id: 't1_e_18', dimensionId: 'family_env', dimensionName: '学习能力', text: '阅读速度和理解能应付课业', options: stdOptions },
      { id: 't1_e_19', dimensionId: 'family_env', dimensionName: '学习能力', text: '考试、作业能组织清楚地表达', options: stdOptions },
      { id: 't1_e_20', dimensionId: 'family_env', dimensionName: '学习能力', text: '会自己调整学习方法', options: stdOptions },

      // 6. language -> 语言沟通
      { id: 't1_e_21', dimensionId: 'language', dimensionName: '语言沟通', text: '表达观点有逻辑，能完整论述', options: stdOptions },
      { id: 't1_e_22', dimensionId: 'language', dimensionName: '语言沟通', text: '听得懂比喻、笑话、言外之意', options: stdOptions },
      { id: 't1_e_23', dimensionId: 'language', dimensionName: '语言沟通', text: '作文等书面表达达到年级水平', options: stdOptions },
      { id: 't1_e_24', dimensionId: 'language', dimensionName: '语言沟通', text: '与人交谈能维持话题、有来有往', options: stdOptions },

      // 7. social_emotional -> 社交互动
      { id: 't1_e_25', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '有让自己有归属感的朋友圈', options: stdOptions },
      { id: 't1_e_26', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '懂得社交分寸和场合规则', options: stdOptions },
      { id: 't1_e_27', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '网络与现实中的社交大致平衡', options: stdOptions },
      { id: 't1_e_28', dimensionId: 'social_emotional', dimensionName: '社交互动', text: '与家人、老师沟通不总是冲突', options: stdOptions },

      // 8. sensory -> 情绪与行为
      { id: 't1_e_29', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '情绪波动能自我调节', options: stdOptions },
      { id: 't1_e_30', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '压力焦虑不至于失眠或不想上学', options: stdOptions },
      { id: 't1_e_31', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '愿意谈论自己的情绪感受', options: stdOptions },
      { id: 't1_e_32', dimensionId: 'sensory', dimensionName: '情绪与行为', text: '近两周没有持续的明显低落、自我否定', options: stdOptions, isRedFlag: true },

      // 9. self_care -> 生活自理与适应
      { id: 't1_e_33', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '个人卫生、物品、作业能自主管理', options: stdOptions },
      { id: 't1_e_34', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '有初步的时间和零花钱管理', options: stdOptions },
      { id: 't1_e_35', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '能安全地独自完成合乎年龄的出行', options: stdOptions },
      { id: 't1_e_36', dimensionId: 'self_care', dimensionName: '生活自理与适应', text: '在家或班级承担固定责任', options: stdOptions }
    ]
  }
];

export function getT1QuestionsForAge(ageMonth: number): T1Question[] {
  const matched = T1_AGE_BANDS.find(b => ageMonth >= b.minAge && ageMonth <= b.maxAge);
  if (matched) return matched.questions;
  // Fallback to closest band
  if (ageMonth < 12) return T1_AGE_BANDS[0].questions;
  return T1_AGE_BANDS[T1_AGE_BANDS.length - 1].questions;
}

export function getT1AgeBandName(ageMonth: number): string {
  const matched = T1_AGE_BANDS.find(b => ageMonth >= b.minAge && ageMonth <= b.maxAge);
  if (matched) return matched.name;
  if (ageMonth < 12) return '1岁以下量表';
  return '15岁以上青少年量表';
}
