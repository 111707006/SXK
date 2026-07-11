import { DimensionConfig, Product } from './types';

// Let's configure custom questions with standard options
// Option scores: 10 (Yes / Normal), 5 (Sometimes / Borderline), 0 (No / Struggle)
const stdOptions = [
  { label: '是 / 经常做到', score: 10 },
  { label: '有时 / 部分做到', score: 5 },
  { label: '否 / 极少做到', score: 0 }
];

export const DIMENSIONS_DATA: DimensionConfig[] = [
  {
    id: 'gross_motor',
    name: '动作发展',
    iconName: 'Activity',
    color: 'bg-brand-sand text-brand-clay hover:bg-brand-beige border-brand-stone',
    textColor: 'text-brand-clay',
    borderColor: 'border-brand-clay',
    tiers: {
      T1: {
        scaleName: 'ASQ-3 粗大动作问卷',
        duration: '10-15分钟',
        questions: [
          { id: 'gm_t1_1', text: '孩子能单脚站立并保持平衡 5 秒以上吗？', options: stdOptions },
          { id: 'gm_t1_2', text: '孩子能够双脚交替连续跳跃前进 5-6 步吗？', options: stdOptions },
          { id: 'gm_t1_3', text: '孩子在奔跑或转身时，是否极少跌倒或失去平衡？', options: stdOptions },
          { id: 'gm_t1_4', text: '孩子能双脚并拢，从最后一级台阶跳下来并站稳吗？', options: stdOptions },
          { id: 'gm_t1_5', text: '孩子在接住一个从 2 米外抛过来的大球时，是否能用双手接住（而不是仅仅用身体抱住）？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'PedsQL 运动机能状态自评',
        duration: '20-40分钟',
        questions: [
          { id: 'gm_t2_1', text: '孩子在户外跟同龄儿童进行快跑游戏时能保持一样的速度吗？', options: stdOptions },
          { id: 'gm_t2_2', text: '孩子在进行约半小时连续运动后，是否不会表现出过度疲劳或气喘？', options: stdOptions },
          { id: 'gm_t2_3', text: '孩子是否能不扶扶手，双脚交替上下台阶？', options: stdOptions },
          { id: 'gm_t2_4', text: '孩子是否可以手持装有半杯水的杯子平稳行走 3 米而水不洒出来？', options: stdOptions },
          { id: 'gm_t2_5', text: '孩子在立定跳远时，是否能跳过大约相当于自己身高的距离且落地站稳？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'GMFM-66 粗大运动功能评估',
        duration: '45-90分钟',
        questions: [
          { id: 'gm_t3_1', text: '【表现观察】孩子能以标准步态自如地在平衡木上行走 3 米以上（无偏斜及颤抖）？', options: stdOptions },
          { id: 'gm_t3_2', text: '【力量测试】孩子能在一只脚站立的状态下，自如抛接皮球且身体轴线稳定？', options: stdOptions },
          { id: 'gm_t3_3', text: '【肌张力与平衡】孩子从蹲位起立到直立位，无异常肌张力反射，动作平滑流利？', options: stdOptions },
          { id: 'gm_t3_4', text: '【协调性测试】孩子能在一只脚向前迈步的同时，对侧手臂自然协调向前摆动（交叉协调步态）？', options: stdOptions },
          { id: 'gm_t3_5', text: '【柔韧性与爆发力】孩子能连续双脚离地跳起，并用双手触碰悬挂在头顶上方 15 厘米处的吊球？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'fine_motor',
    name: '感觉处理',
    iconName: 'Sparkles',
    color: 'bg-brand-sage text-brand-moss hover:bg-emerald-50 border-brand-stone',
    textColor: 'text-brand-moss',
    borderColor: 'border-brand-moss',
    tiers: {
      T1: {
        scaleName: 'ASQ-3 精细动作筛查',
        duration: '10-15分钟',
        questions: [
          { id: 'fm_t1_1', text: '孩子是否能够用小勺或筷子稳当地将食物送入口脑？', options: stdOptions },
          { id: 'fm_t1_2', text: '孩子是否可以用大拇指、食指和中指类似拿笔的方式捏起小米粒或细针？', options: stdOptions },
          { id: 'fm_t1_3', text: '孩子能按照成人的样子模仿画出一个长方形或是圆圈吗？', options: stdOptions },
          { id: 'fm_t1_4', text: '孩子能够用剪刀将一张正方形纸剪成大致均匀的两半吗？', options: stdOptions },
          { id: 'fm_t1_5', text: '孩子能用小手拧开矿泉水瓶盖并重新拧紧吗？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'WeeFIM 精细操作指数',
        duration: '20-40分钟',
        questions: [
          { id: 'fm_t2_1', text: '孩子能够自主独立扣上外套的大粒扣子或拉上拉链吗？', options: stdOptions },
          { id: 'fm_t2_2', text: '孩子是否可以独立对齐纸张折叠（比如对折一张彩纸）？', options: stdOptions },
          { id: 'fm_t2_3', text: '孩子是否能熟练使用儿童剪刀剪断一条直线？', options: stdOptions },
          { id: 'fm_t2_4', text: '孩子能熟练地在纸上穿引鞋带或穿珠子（连续穿过 3 个以上）吗？', options: stdOptions },
          { id: 'fm_t2_5', text: '孩子可以用橡皮泥捏出一个比较规整的圆形或长条形状吗？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'Bayley-4 婴儿与幼儿精细发育量表',
        duration: '45-90分钟',
        questions: [
          { id: 'fm_t3_1', text: '【实操观察】孩子能独自用小木块叠起 8-10 层的垂直高塔不倒塌？', options: stdOptions },
          { id: 'fm_t3_2', text: '【双手协同】孩子能够用双手协同在限定 10 秒内拉开塑料珠链？', options: stdOptions },
          { id: 'fm_t3_3', text: '【精细调控】孩子能够将细线精准穿过直径 2mm 的小穿孔板？', options: stdOptions },
          { id: 'fm_t3_4', text: '【力量控制】孩子能用指腹力量捏紧滴管，并精准滴出 3 滴水到指定小孔中吗？', options: stdOptions },
          { id: 'fm_t3_5', text: '【手眼跟踪】孩子可以用儿童镊子夹起 5 颗绿豆并快速放入直径 2cm 的小盒中不掉落吗？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'sensory',
    name: '情绪与行为',
    iconName: 'Brain',
    color: 'bg-brand-sage text-brand-forest hover:bg-brand-sage/80 border-brand-stone',
    textColor: 'text-brand-forest',
    borderColor: 'border-brand-forest',
    tiers: {
      T1: {
        scaleName: 'SPM-2 短版感觉处理评估',
        duration: '10-15分钟',
        questions: [
          { id: 'se_t1_1', text: '对日常声音（如吹风机、吸尘器、汽笛声）是否表现出过度的痛苦、捂耳朵？', options: stdOptions },
          { id: 'se_t1_2', text: '是否特别抗拒被洗脸、洗头、理发，或者对衣服领标表现出极度烦躁（触觉异常敏感）？', options: stdOptions },
          { id: 'se_t1_3', text: '孩子是否会有无故频繁撞头、身体猛烈摇晃或者过度喜欢旋转而不头晕的现象？', options: stdOptions },
          { id: 'se_t1_4', text: '孩子在强光下（如出门暴晒或日光灯下）是否经常眨眼、流泪或情绪极其烦躁？', options: stdOptions },
          { id: 'se_t1_5', text: '孩子是否特别害怕双脚离地的游乐设施（如秋千、滑梯），甚至表现出强烈的恐慌？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'WeeFIM-Sensory 感觉独立指数',
        duration: '20-40分钟',
        questions: [
          { id: 'se_t2_1', text: '在嘈杂或人多密集的场所，孩子是否能维持情绪平稳，不出现烦躁失控？', options: stdOptions },
          { id: 'se_t2_2', text: '孩子在面对不熟悉的、轻微黏糊的材质（如黏土、沙子、口水）时，能正常触摸玩耍吗？', options: stdOptions },
          { id: 'se_t2_3', text: '孩子坐姿坐相良好，不会频繁从椅子或台阶上摔下，空间高度知觉正常吗？', options: stdOptions },
          { id: 'se_t2_4', text: '孩子在运动或奔跑中是否容易碰撞家具或人，似乎对自己身体所处位置感知不准（本体觉偏弱）？', options: stdOptions },
          { id: 'se_t2_5', text: '孩子是否在衣服弄脏、脸上沾水、或手上有泥时立刻要求换衣服或擦洗，无法容忍一丁点污物？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'SIPT 感觉统合和实用功能测验',
        duration: '45-90分钟',
        questions: [
          { id: 'se_t3_1', text: '【前庭觉观察】进行连续 10 圈旋转（平稳速度）后，眼震消退时间及躯体平衡反应在正常区间？', options: stdOptions },
          { id: 'se_t3_2', text: '【双侧协调性】孩子能手脚并用、保持动作节律、协调地完成大风车运动（Jumping Jacks）？', options: stdOptions },
          { id: 'se_t3_3', text: '【动觉触控】不通过眼看，仅凭捏摸动作，孩子能否识别出左右手上几何形状木块的异同？', options: stdOptions },
          { id: 'se_t3_4', text: '【本体空间感】闭上双眼，孩子是否能根据口令，用食指精准触摸到自己的鼻尖（指鼻试验合格）？', options: stdOptions },
          { id: 'se_t3_5', text: '【重力不安全感】站在 30cm 高的台阶边缘向下看时，孩子是否能保持躯干平衡，无明显的过度紧张或抗拒蜷缩？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'language',
    name: '语言沟通',
    iconName: 'MessageSquare',
    color: 'bg-brand-sand text-brand-clay hover:bg-brand-beige border-brand-stone',
    textColor: 'text-brand-clay',
    borderColor: 'border-brand-clay',
    tiers: {
      T1: {
        scaleName: 'ASQ-3 沟通发展问卷',
        duration: '10-15分钟',
        questions: [
          { id: 'la_t1_1', text: '孩子能说出 4-5 个字的短句（如“我想吃苹果”）吗？', options: stdOptions },
          { id: 'la_t1_2', text: '孩子能按指令连续完成“去厨房把杯子拿过来，然后放在这儿”两连贯动作吗？', options: stdOptions },
          { id: 'la_t1_3', text: '孩子能够用语言表达自己的生理需求而非拉着父母去指点？', options: stdOptions },
          { id: 'la_t1_4', text: '孩子能正确区分和使用“你、我、他”等人称代词吗？', options: stdOptions },
          { id: 'la_t1_5', text: '孩子可以准确叫出日常生活中 5 种以上常见物体的名称（如桌子、床、书、鞋、水杯）吗？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: '森心康 语言理解(指令理解)检测量表',
        duration: '15-25分钟',
        questions: [
          { id: 'la_t2_1', text: '【2岁·简单指令】孩子能听懂并指认/反应单一物件或动作（如：拍拍手、指鼻子）吗？', options: stdOptions },
          { id: 'la_t2_2', text: '【2岁·简单指令】孩子能听懂单一名词指令（如：把球给我）吗？', options: stdOptions },
          { id: 'la_t2_3', text: '【2–3岁·多物件】孩子能听懂含两个物件的指令（如：拿苹果和香蕉）吗？', options: stdOptions },
          { id: 'la_t2_4', text: '【2–3岁】孩子能听懂「要+动作」的需求句（如：要喝水、要吃东西）吗？', options: stdOptions },
          { id: 'la_t2_5', text: '【3岁·概念】孩子能听懂含修饰语的指令（如：拿红色的车子）吗？', options: stdOptions },
          { id: 'la_t2_6', text: '【3–4岁·组合】孩子能听懂含颜色/数量等多概念指令（如：给我两个红色的积木）吗？', options: stdOptions },
          { id: 'la_t2_7', text: '【4岁·时态】孩子能听懂含时态的句子（如：我们已经去买水果了）吗？', options: stdOptions },
          { id: 'la_t2_8', text: '【4岁】孩子能听懂两个并列描述句（如：红苹果和黄香蕉）吗？', options: stdOptions },
          { id: 'la_t2_9', text: '【4–5岁·步骤】孩子能听懂含多对象的组合指令（如：把大家的书收到书包里）吗？', options: stdOptions },
          { id: 'la_t2_10', text: '【5岁·多步骤】孩子能听懂三步骤顺序指令（如：先刷牙、再洗脸、然后吃早餐）吗？', options: stdOptions },
          { id: 'la_t2_11', text: '【5–6岁·多步骤】孩子能听懂含「先/接下来/最后」的多步骤句（如：先洗手、再吃点心、最后写功课）吗？', options: stdOptions },
          { id: 'la_t2_12', text: '【6岁·故事理解】孩子能听懂并理解一段故事性叙述的内容（如：理解整段铅笔盒故事的来龙去脉）吗？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'CELF-5 表达能力仿说(语音上传)评估量表',
        duration: '20-40分钟',
        questions: [
          { id: 'la_t3_1', text: '【单音练习】请孩子跟你一起说一遍：“啊、一、呜”', options: stdOptions },
          { id: 'la_t3_2', text: '【单字】请孩子跟你一起说一遍：“妈、地、哥”', options: stdOptions },
          { id: 'la_t3_3', text: '【叠词/双字】请孩子跟你一起说一遍：“妈妈、弟弟、哥哥”', options: stdOptions },
          { id: 'la_t3_4', text: '【双词短语】请孩子跟你一起说一遍：“要饼干、吃东西”', options: stdOptions },
          { id: 'la_t3_5', text: '【简单句】请孩子跟你一起说一遍：“我想要玩玩具、给我苹果”', options: stdOptions },
          { id: 'la_t3_6', text: '【含修饰语】请孩子跟你一起说一遍：“这里有一颗球、想要红色的车子”', options: stdOptions },
          { id: 'la_t3_7', text: '【时态句】请孩子跟你一起说一遍：“我们已经去买水果了”', options: stdOptions },
          { id: 'la_t3_8', text: '【并列描述句】请孩子跟你一起说一遍：“这个是红色的苹果、这个是黄色的香蕉”', options: stdOptions },
          { id: 'la_t3_9', text: '【复杂指令】请孩子跟你一起说一遍：“老师要我们大家把书收到书包里面”', options: stdOptions },
          { id: 'la_t3_10', text: '【顺序性长句】请孩子跟你一起说一遍：“我早上起来的时候，先去厕所刷牙洗脸，接下来才去客厅吃早餐”', options: stdOptions },
          { id: 'la_t3_11', text: '【多步骤顺序】请孩子跟你一起说一遍：“回到家后，妈妈请我先去洗手，接下来可以吃点心，最后才去写功课”', options: stdOptions },
          { id: 'la_t3_12', text: '【故事性叙述】请孩子跟你一起说一遍：“今天是我最开心的一天，早上我到学校的时候，我发现我同学的铅笔盒跟我的一模一样，他跟我说是昨天看到我的铅笔盒后很喜欢，然后跟妈妈一起去买的”', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'social_emotional',
    name: '社交互动',
    iconName: 'Smile',
    color: 'bg-brand-sand text-brand-clay hover:bg-brand-beige border-brand-stone',
    textColor: 'text-brand-clay',
    borderColor: 'border-brand-clay',
    tiers: {
      T1: {
        scaleName: 'M-CHAT-R 婴幼儿自闭症行为筛查',
        duration: '10-15分钟',
        questions: [
          { id: 'so_t1_1', text: '呼唤孩子的名字时，他/她是否能够转头看着您，并对您报以微笑？', options: stdOptions },
          { id: 'so_t1_2', text: '当您指出房间里的一样感兴趣东西（如“快看，有一只猫！”），孩子会顺着您手指方向看吗？', options: stdOptions },
          { id: 'so_t1_3', text: '孩子有跟其他小朋友分享玩具、共同嬉戏的意愿和互动吗？', options: stdOptions },
          { id: 'so_t1_4', text: '当孩子在玩耍遇到困难时，会主动抬头看父母的眼神或表情，以寻求确认或鼓励（共同关注）吗？', options: stdOptions },
          { id: 'so_t1_5', text: '孩子在日常生活中是否喜欢模仿成人的行为（如拖地、打电话、做饭等假装游戏）？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'CBCL 社交和情绪异常量表',
        duration: '20-40分钟',
        questions: [
          { id: 'so_t2_1', text: '孩子在遇到挫折或心意不遂时，能否在 10 分钟内主动平复情绪不进行撕咬哭闹？', options: stdOptions },
          { id: 'so_t2_2', text: '孩子离开熟悉的抚养人（如妈妈上班）时，能正常告别并在短时间内适应新环境？', options: stdOptions },
          { id: 'so_t2_3', text: '孩子是否能察觉到身边家庭成员情绪低落或哭泣并予以安慰（具备初步同理心）？', options: stdOptions },
          { id: 'so_t2_4', text: '孩子是否经常有无理取闹、打人、咬人、毁坏玩具等攻击性或冲动性行为？', options: stdOptions },
          { id: 'so_t2_5', text: '孩子是否能主动和同伴商量分配玩具或排队玩游戏，而不总是强占玩具或大声抢夺？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'CAPA 儿童情绪障碍专业评估量表',
        duration: '45-90分钟',
        questions: [
          { id: 'so_t3_1', text: '【情境应对】引导孩子进入一个聚集了 3 个陌生小孩并且有玩具的社交情意，孩子能友好破冰融洽同玩？', options: stdOptions },
          { id: 'so_t3_2', text: '【抗压测试】在玩具被不经意拿走等设置的轻度挫折中，孩子无冲动抓咬，无情绪狂躁？', options: stdOptions },
          { id: 'so_t3_3', text: '【身份认知】孩子能合理叙述自己跟父母、朋友相处时的感受，对自我价值有正向概念？', options: stdOptions },
          { id: 'so_t3_4', text: '【眼神交流】面谈过程中，孩子能维持适度且自然、长达 3 秒以上的对视眼神接触吗？', options: stdOptions },
          { id: 'so_t3_5', text: '【非言语解码】在观察一组包含喜、怒、哀、乐情绪的儿童面部卡片时，孩子能精准叫出每张卡片对应的情绪名称吗？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'cognitive',
    name: '认知',
    iconName: 'BookOpen',
    color: 'bg-brand-sage text-brand-forest hover:bg-brand-sage/80 border-brand-stone',
    textColor: 'text-brand-forest',
    borderColor: 'border-brand-forest',
    tiers: {
      T1: {
        scaleName: 'ASQ-3 认知发展筛查',
        duration: '10-15分钟',
        questions: [
          { id: 'co_t1_1', text: '孩子能否辨别并指出红、绿、黄、蓝四种以上的基本色？', options: stdOptions },
          { id: 'co_t1_2', text: '孩子能分清理顺大小、多少等逻辑概念（如能够正确指出哪一盘糖果更多）？', options: stdOptions },
          { id: 'co_t1_3', text: '孩子是否了解自如区分动物（如小猫、小狗）与常生活用品（如桌椅、电视）的区别？', options: stdOptions },
          { id: 'co_t1_4', text: '孩子能按长短或大小顺序，排列 3 个以上同类玩具（如从小熊公仔小到大排列）吗？', options: stdOptions },
          { id: 'co_t1_5', text: '孩子能认出镜子里的像是自己，并在您指着他的镜中像时指着自己鼻子吗？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'PedsQL 认知与注意力表现自评',
        duration: '20-40分钟',
        questions: [
          { id: 'co_t2_1', text: '孩子能手口一致地数出 10 个及以上的物理小实物（如扣子或圆点）吗？', options: stdOptions },
          { id: 'co_t2_2', text: '孩子能否在画纸上完成由“1-2-3-4-5-6”等顺序连点成图的小游戏？', options: stdOptions },
          { id: 'co_t2_3', text: '孩子是否能听懂并记住 3 句以上的儿歌词汇或是古诗词？', options: stdOptions },
          { id: 'co_t2_4', text: '孩子能在脑海里理清“今天、昨天、明天”的概念，并在描述事情时正确提及吗？', options: stdOptions },
          { id: 'co_t2_5', text: '在您展示 3 种不同动物卡片并拿走其中一张后，孩子能准确说出缺失的是哪一张吗？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'Bayley-4 婴儿与儿童期认知测量',
        duration: '45-90分钟',
        questions: [
          { id: 'co_t3_1', text: '【分类匹配】孩子对于立体形状（正方、圆柱、三角）能在限时 30 秒内精准进行形状配孔？', options: stdOptions },
          { id: 'co_t3_2', text: '【推理测试】将一个亮玩具扣在一只小杯子下，并在三只同样色杯子中当面移位交换后，孩子能立即选对藏有玩偶的杯子吗？', options: stdOptions },
          { id: 'co_t3_3', text: '【瞬时记忆】通过短暂 3秒的卡片展示，孩子能在九宫格卡片中准确反指出有熊图案的定位？', options: stdOptions },
          { id: 'co_t3_4', text: '【类比逻辑】面谈中向孩子提问“太阳在白天，月亮在___？”，孩子能在 5 秒内给出正确回答吗？', options: stdOptions },
          { id: 'co_t3_5', text: '【概念分类】孩子能把 10 张混合的水果和交通工具卡片，在 30 秒内正确分为两类吗？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'attention',
    name: '注意力与执行',
    iconName: 'Target',
    color: 'bg-brand-sage text-brand-forest hover:bg-brand-sage/80 border-brand-stone',
    textColor: 'text-brand-forest',
    borderColor: 'border-brand-forest',
    tiers: {
      T1: {
        scaleName: 'ADHD简易筛查量表',
        duration: '10-15分钟',
        questions: [
          { id: 'at_t1_1', text: '孩子在进行感兴趣的活动（如看绘本、玩积木）时，是否能保持 10 分钟以上的专心？', options: stdOptions },
          { id: 'at_t1_2', text: '在日常生活中，当您面对面跟孩子说话时，他/她是否经常听不进去或者游离走神？', options: stdOptions },
          { id: 'at_t1_3', text: '孩子做事是否有条有理，玩完玩具后会在建议下将玩具自觉归位？', options: stdOptions },
          { id: 'at_t1_4', text: '孩子在需要静坐的场合（如吃饭、听故事）是否经常坐立不安，动个不停？', options: stdOptions },
          { id: 'at_t1_5', text: '孩子是否极易被外界细微的声音或事物吸引而中断正在做的事情？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'CBCL 注意力缺陷指数',
        duration: '20-40分钟',
        questions: [
          { id: 'at_t2_1', text: '在桌前画画或吃饭时，孩子是否无法平稳安坐过 10 分钟，总是东张西望、频频起立或摇来晃去？', options: stdOptions },
          { id: 'at_t2_2', text: '要求其完成有规章步骤的事情时，孩子会因为嫌烦而中途放弃、极容易丢三落四吗？', options: stdOptions },
          { id: 'at_t2_3', text: '由于马虎和分心，孩子在日常跟玩游戏、连线或堆拼图时常见不应有的拼错或搞混？', options: stdOptions },
          { id: 'at_t2_4', text: '孩子是否经常在听完简短指令后，扭头就忘记了刚才被要求做的事情？', options: stdOptions },
          { id: 'at_t2_5', text: '在需要深度用脑或耐心的活动中，孩子是否表现出极度抗拒、烦躁或拖延？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: '多感官持续注意力评估测试',
        duration: '45-90分钟',
        questions: [
          { id: 'at_t3_1', text: '【CPT测试】在大屏幕进行连续的 3 分钟跳出特定红气球反应测试中，孩子的遗漏反应和失误次数符合同龄正常平均线？', options: stdOptions },
          { id: 'at_t3_2', text: '【防干扰能力】在一旁响起轻柔音乐的抗干扰测试中，孩子仍可以专注心无旁骛进行多块拼图拼接？', options: stdOptions },
          { id: 'at_t3_3', text: '【多工位心眼换位】在听到一声钟响按键、两声钟响保持按两键的双模交替指令中，错误概率维持低位？', options: stdOptions },
          { id: 'at_t3_4', text: '【视觉追踪测试】孩子双眼能否跟随移动的红点进行持续 1 分钟的连贯平滑追踪，无频繁视线脱离？', options: stdOptions },
          { id: 'at_t3_5', text: '【听觉辨别测试】孩子在听到一连串动物叫声中混入鸟叫声时，能准确在每次听到鸟叫时按下反馈按钮吗？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'self_care',
    name: '生活自理与适应',
    iconName: 'Home',
    color: 'bg-brand-sage text-brand-forest hover:bg-brand-sage/80 border-brand-stone',
    textColor: 'text-brand-forest',
    borderColor: 'border-brand-forest',
    tiers: {
      T1: {
        scaleName: 'ASQ-3 个人与社会自理问卷',
        duration: '10-15分钟',
        questions: [
          { id: 'sc_t1_1', text: '孩子能够自主或在少量口头言语提醒下，使用洗手液将手掌心、指缝洗净揉搓后冲水剥干？', options: stdOptions },
          { id: 'sc_t1_2', text: '在如厕完毕后，孩子是否掌握了脱裤子、拉下松紧裤腰、以及冲马桶的规范全套流程？', options: stdOptions },
          { id: 'sc_t1_3', text: '孩子吃饭基本上能完全自主，不把汤水淋得到处都是，不需要大人极长地追着喂饭吗？', options: stdOptions },
          { id: 'sc_t1_4', text: '孩子能在没有大人帮助的情况下，自己穿上非系带的运动鞋或拖鞋，并且很少穿反吗？', options: stdOptions },
          { id: 'sc_t1_5', text: '孩子在口渴时，能自己用轻便的水杯在低矮台面上平稳倒水（少量）并喝完吗？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'WeeFIM 儿童日常生活独立指数',
        duration: '20-40分钟',
        questions: [
          { id: 'sc_t2_1', text: '孩子能主动对过马路有初步戒备警惕性（比如拉着爸妈的手不乱跑、避让骑车人）吗？', options: stdOptions },
          { id: 'sc_t2_2', text: '在指导和示范后，孩子是否有早晚独立刷牙，且不故意吞咽牙膏的能力？', options: stdOptions },
          { id: 'sc_t2_3', text: '换鞋脱袜时，孩子能独立脱袜子并能够分辨出自己左右鞋子的区分不穿反鞋吗？', options: stdOptions },
          { id: 'sc_t2_4', text: '孩子脱下衣服后，能按照教导的方法将衣服大至叠整齐或挂在低矮的挂衣架上吗？', options: stdOptions },
          { id: 'sc_t2_5', text: '在脸上或手上有脏污、汗水时，孩子能主动拿取湿纸巾或手帕自己擦拭干净吗？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'ADL评估量表与操作实测',
        duration: '45-90分钟',
        questions: [
          { id: 'sc_t3_1', text: '【扣扣实操】要求孩子解开或扣合一套儿童假外衣上的 5 个树脂纽扣，所需时间在 60 秒内？', options: stdOptions },
          { id: 'sc_t3_2', text: '【梳洗效率】完全无口头催促，孩子能快速完成穿上防风大衣、拉合顺滑金属拉链并洗手全套规范步骤吗？', options: stdOptions },
          { id: 'sc_t3_3', text: '【餐食礼序】使用儿童长手勺，将一颗生花生米匀速转移进一米外的空杯子，无滑落掉出发生？', options: stdOptions },
          { id: 'sc_t3_4', text: '【穿刺精量】在限时 45 秒内，孩子能将两条鞋带交叉穿过模型鞋板上的 4 个孔洞并打上第一个死结吗？', options: stdOptions },
          { id: 'sc_t3_5', text: '【利手协同】双手配合，一手握瓶身一手旋拧果酱瓶密封盖，顺畅拧开并将一小勺果酱平整涂抹在吐司片中心区域？', options: stdOptions }
        ]
      }
    }
  },
  {
    id: 'family_env',
    name: '学习能力',
    iconName: 'Heart',
    color: 'bg-brand-sand text-brand-clay hover:bg-brand-beige border-brand-stone',
    textColor: 'text-brand-clay',
    borderColor: 'border-brand-clay',
    tiers: {
      T1: {
        scaleName: '家庭成长环境赋能简明问卷',
        duration: '10-15分钟',
        questions: [
          { id: 'fe_t1_1', text: '家庭内部成员在对待孩子的日常发育、惩戒纠错上有较为一致良好的教育习惯及和气度吗？', options: stdOptions },
          { id: 'fe_t1_2', text: '家庭中是否能坚持保证每天有固定半小时以上的高质量不看手机的亲子伴谈、共读图书陪伴？', options: stdOptions },
          { id: 'fe_t1_3', text: '家庭中能够为孩子提供宽裕、明亮、安静的活动或者涂画阅读专区吗？', options: stdOptions },
          { id: 'fe_t1_4', text: '家庭中是否给孩子准备了合适高度、可自主取放玩具的开放式玩具架或图书角？', options: stdOptions },
          { id: 'fe_t1_5', text: '家长是否会主动学习少儿身心发育及感统训练等科普知识，并尝试融入日常养育中？', options: stdOptions }
        ]
      },
      T2: {
        scaleName: 'PedsQL 家庭社会发展因子调查',
        duration: '20-40分钟',
        questions: [
          { id: 'fe_t2_1', text: '在面对孩子的哭闹纠缠，家长是否通常可以压制并疏导焦虑情绪不进行无由怒吼或拍打？', options: stdOptions },
          { id: 'fe_t2_2', text: '家庭日常生活中，孩子是否有经常参与家庭清洁（如捡垃圾、擦小桌子）并得到表扬赞美？', options: stdOptions },
          { id: 'fe_t2_3', text: '家庭中对电子设备（iPad, 电视, 手机）有具体的定时机制，不放任孩子任意时刻暴看吗？', options: stdOptions },
          { id: 'fe_t2_4', text: '家长是否能定期（每周至少一次）带孩子去户外公园、草地或公共游乐场所进行 2 小时以上的户外活动？', options: stdOptions },
          { id: 'fe_t2_5', text: '家庭中是否在遇到育儿分歧时，能避开孩子，进行温和理性的沟通，而不是当着孩子的面大声争吵？', options: stdOptions }
        ]
      },
      T3: {
        scaleName: 'HOME家庭环境评估专业观测标准',
        duration: '45-90分钟',
        questions: [
          { id: 'fe_t3_1', text: '【家庭访视】家里摆放的低龄段书籍、启智彩块教具数量多样，摆放位置高度适合孩子自主摘取？', options: stdOptions },
          { id: 'fe_t3_2', text: '【关系评测】孩子与直接抚养人（如妈妈或奶奶）处于积极、温和、呼应自如的信任型依恋关系吗？', options: stdOptions },
          { id: 'fe_t3_3', text: '【环境健康度】室内采光无死角、噪音低、各处边角有妥善的安全软包配置？', options: stdOptions },
          { id: 'fe_t3_4', text: '【情绪氛围观察】在 30 分钟的家庭活动访视中，抚养人对孩子发出的探究行为，能给予 5 次以上的积极正向口头鼓励或肢体铺磨/拥抱回应吗？', options: stdOptions },
          { id: 'fe_t3_5', text: '【规训适切度】当孩子不小心碰倒积木堆或洒出水时，抚养人能在不使用恐吓、羞辱词汇的前提下，进行现场引导及协助清理吗？', options: stdOptions }
        ]
      }
    }
  }
];

export const PRODUCTS_DATA: Product[] = [
  {
    id: 'eeg_headband',
    name: '森心康·智能脑电生物反馈头带',
    price: 2980,
    originalPrice: 3500,
    desc: '专为儿童注意力协同、多动及深睡管理研制的智能专业级生物反馈脑机设备，提供全维脑波采集与舒缓训练。',
    details: '本脑电反馈头带深度集成了高精度干电极检测触点，能实时采样前额叶区的EEG（脑电波）讯号。在专属森心康康复软件配合下，能够将α波、β波、θ波动态数据解析输出。通过小游戏音频等即时生物信息反馈，有效促进大脑皮层自控神经环路的建立，已被多项成长应用测试证实对ADHD（注意缺陷多动障碍）以及部分感觉统和障碍儿童有极佳的成长促进功效。',
    image: 'https://picsum.photos/seed/headband/600/600',
    specs: ['重：42g 极轻不压前额', '适用年龄：3-14岁儿童', '触电触高：医用级亲肤柔性硅胶材质', '充电续航：单次充满可连续提供脑波监测训练 15 小时'],
    features: ['高解析度 EEG 采样频率高达 500Hz', '实时情绪与专注水平三元指标算法反馈', '亲子互绑对抗性脑控抗分心小训练游戏包'],
    dimensionsTargeted: ['attention', 'sensory', 'cognitive']
  },
  {
    id: 'smart_gloves',
    name: '森心康·儿童精细动作智能训练手套',
    price: 1860,
    originalPrice: 2200,
    desc: '基于弯曲传感器与微气囊阻尼阻抗感应的智能手部康复追踪硬件，让五指精细协调练习充满趣味。',
    details: '此精细阻尼练习手套专为在精细动作发育有边缘迟缓或精细肌肉力量、抓握、定位失调度偏低的儿童研制。内嵌 10 焦耳/毫米微弯拉伸电极传感器，可敏锐感知小手每个关节 1 毫米级别的抓握角度与按偏力量。结合动画端对端的小动物捏橡皮、折纸飞拉、弹钢琴等任务挑战，提供定量化的作业治疗（OT）。',
    image: 'https://picsum.photos/seed/gloves/600/600',
    specs: ['重：35g（分左右手及尺码）', '材质：高弹性透气蕾丝气垫棉面', '阻尼级：3极微重无损关节康复抗力', '无线：低功耗 BLE 5.3蓝牙连接'],
    features: ['手指独立肌力、对捏准度定量分析', '微动微颤运动捕捉滤波滤除算法', '自动生成关节训练灵活性报告卡'],
    dimensionsTargeted: ['fine_motor', 'self_care']
  },
  {
    id: 'posture_belt',
    name: '森心康·重力姿态感应平衡追踪腰带',
    price: 1280,
    originalPrice: 1580,
    desc: '实时步态、空间平衡姿态及下肢力线分析传感器。用于脑瘫及粗大运动迟滞康复评测。',
    details: '粗大运动是少儿发育的重要基轴。重力姿态腰带内置 6 轴 IMU（微型惯性测量单元）及陀螺仪。能佩戴在脊椎中下端或髋部，实时记录步行中的双侧髋骨平移幅度、单脚触地腾空相（Gait analysis）、高抬腿高度。通过声波韵律（Auditory pacing）诱导孩子进行正确的摆臂、前冲与深脚，让跳、跑、独立平衡等ASQ/GMFM指标能获得更平滑正规的训练轨迹。',
    image: 'https://picsum.photos/seed/belt/600/600',
    specs: ['重：55g（搭口高度可自由调节）', '适用腰围：40-75cm 儿童大网扣制', '精度：0.01 度三轴倾斜角监测', '系统连接：手机、电脑、PAD、大显示屏多投屏互连'],
    features: ['三维实时动画人物投影轨迹骨骼力线', '对跨越爬跑、坐立挺背全景多要素感知量化', '步幅异偏即刻音乐韵律警报校正'],
    dimensionsTargeted: ['gross_motor', 'self_care']
  },
  {
    id: 'social_wristband',
    name: '森心康·智能社交减压陪伴心电手环',
    price: 980,
    originalPrice: 1200,
    desc: '结合皮电生理指标（GSR）、心率变异率（HRV）进行儿童社交焦虑与情绪极差即刻缓解的高端手环。',
    details: '情绪失控与自闭倾向、社交抗拒有深度生化反馈作用。智温社交皮电心搏监测手环不仅可以实现常规手环的心率计数，还特别提供了极微电流下的皮电敏感测量（皮肤毛孔细电变化），能在孩子愤怒、极端沮丧、烦躁前 1-2 分钟捕捉到自主神经系统的激活度。它将轻柔振动并播放由音乐康复专家调调的节拍旋律，帮助特儿或多动高敏儿在进入新社交群前安抚降压。',
    image: 'https://picsum.photos/seed/wristband/600/600',
    specs: ['材质：液态亲肤纳米多孔氟橡胶', '重量：21g 紧扣式安全双锁针设计', '心率测量：高灵敏三通道PPG红外透射芯', '皮电阻探头：纯金抗腐蚀抗敏涂层电接触'],
    features: ['情绪激动度智能震动预警缓和反馈', '防走失一键紧急定位追踪功能', '家庭亲子情分能量磁吸配对对碰计分'],
    dimensionsTargeted: ['social_emotional', 'sensory', 'family_env']
  }
];
