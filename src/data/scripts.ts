export interface ScriptRole {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'any';
  age: string;
  occupation: string;
  background: string;
  secret: string;
  isMurderer: boolean;
}

export interface Script {
  id: string;
  title: string;
  cover: string;
  playerCount: string;
  difficulty: '简单' | '中等' | '困难';
  duration: string;
  background: string;
  story: string;
  clues: string[];
  roles: ScriptRole[];
}

export const SCRIPTS: Script[] = [
  {
    id: 'mansion-mystery',
    title: '古宅迷案',
    cover: '🏚️',
    playerCount: '4-6人',
    difficulty: '简单',
    duration: '约30分钟',
    background: '1935年的上海，一座神秘的古宅中，富商陈老爷在书房被发现死亡。所有在场的人都有嫌疑...',
    story: '陈老爷是上海滩有名的富商，今晚在家中举办家宴。然而，就在晚宴进行到一半时，管家发现陈老爷倒在书房中，已经断气。门窗紧锁，凶器是一把精致的匕首。警察封锁了宅邸，所有人都是嫌疑人。',
    clues: [
      '书房门是从里面反锁的',
      '陈老爷的遗嘱将在明天公布',
      '匕首上没有指纹',
      '有人听到争吵声',
      '陈老爷最近与人有财务纠纷',
    ],
    roles: [
      {
        id: 'chen-wife',
        name: '陈夫人',
        gender: 'female',
        age: '45岁',
        occupation: '陈老爷的妻子',
        background: '出身名门，嫁给陈老爷二十年。表面温婉贤淑，实则掌控着家中大小事务。',
        secret: '我发现丈夫在外面有了别的女人，一直忍着没说。今晚我去书房质问他，他却说要和我离婚。',
        isMurderer: false,
      },
      {
        id: 'chen-son',
        name: '陈少爷',
        gender: 'male',
        age: '22岁',
        occupation: '陈老爷的独子',
        background: '从小被溺爱，纨绔子弟。最近沉迷赌博，欠下巨额赌债。',
        secret: '我欠了赌债，父亲拒绝帮我还债，还威胁要断绝父子关系。',
        isMurderer: false,
      },
      {
        id: 'secretary',
        name: '王秘书',
        gender: 'male',
        age: '35岁',
        occupation: '陈老爷的私人秘书',
        background: '跟随陈老爷十年，忠心耿耿，深得信任。掌握着公司许多机密。',
        secret: '我一直暗中挪用公司资金，陈老爷今晚发现了账目问题。我用匕首杀了他。',
        isMurderer: true,
      },
      {
        id: 'maid',
        name: '李管家',
        gender: 'male',
        age: '55岁',
        occupation: '陈家老管家',
        background: '在陈家服务三十年，看着少爷长大。对陈家忠心不二。',
        secret: '我看到王秘书从书房出来时神色慌张，衣服上似乎有血迹。',
        isMurderer: false,
      },
      {
        id: 'guest',
        name: '张小姐',
        gender: 'female',
        age: '28岁',
        occupation: '陈老爷的生意伙伴',
        background: '新兴商人，与陈老爷有一笔大生意正在谈判。',
        secret: '陈老爷答应让我参与一个大项目，但今晚突然反悔。我很愤怒。',
        isMurderer: false,
      },
      {
        id: 'doctor',
        name: '刘医生',
        gender: 'male',
        age: '40岁',
        occupation: '陈家私人医生',
        background: '医术高明，是陈老爷的老朋友。定期来给陈老爷检查身体。',
        secret: '陈老爷其实已经病入膏肓，我一直帮他隐瞒病情。',
        isMurderer: false,
      },
    ],
  },
  {
    id: 'campus-case',
    title: '校园疑云',
    cover: '🎓',
    playerCount: '4-5人',
    difficulty: '中等',
    duration: '约40分钟',
    background: '名校的实验室里，明星教授被发现死在实验台前。学术圈的明争暗斗浮出水面...',
    story: '周教授是国内顶尖的生物学家，他的实验室刚刚取得了重大突破。然而就在论文即将发表前夕，他被发现死在实验室中，死因是氰化物中毒。所有助手和学生都有动机...',
    clues: [
      '实验室的监控在案发时间段"恰好"故障',
      '周教授的电脑被人动过',
      '有人在论文作者名单上与教授发生争执',
      '实验室的试剂柜少了一瓶化学药品',
      '周教授最近拒绝了一个大公司的高薪邀请',
    ],
    roles: [
      {
        id: 'assistant-a',
        name: '林博士',
        gender: 'female',
        age: '30岁',
        occupation: '周教授的博士后',
        background: '海归博士，学术能力出众，是周教授最器重的助手。',
        secret: '这个项目的核心想法其实是我的，但周教授把所有功劳都据为己有。我恨他。',
        isMurderer: false,
      },
      {
        id: 'student',
        name: '小张',
        gender: 'male',
        age: '25岁',
        occupation: '博士研究生',
        background: '周教授的学生，即将毕业。成绩优秀但家境贫寒。',
        secret: '我在论文数据上造了假，周教授发现了，威胁要开除我。我在他的咖啡里下了毒。',
        isMurderer: true,
      },
      {
        id: 'rival',
        name: '吴教授',
        gender: 'male',
        age: '50岁',
        occupation: '同系教授',
        background: '与周教授是学术对手，两人一直在争夺科研资源。',
        secret: '周教授的研究成果一旦发表，我的项目就会被砍掉。我曾想过破坏他的实验。',
        isMurderer: false,
      },
      {
        id: 'tech',
        name: '赵工',
        gender: 'male',
        age: '35岁',
        occupation: '实验室技术员',
        background: '负责实验室的设备维护和安全管理。',
        secret: '我看到小张当天进出实验室多次，而且神色异常。',
        isMurderer: false,
      },
      {
        id: 'dean',
        name: '陈院长',
        gender: 'female',
        age: '55岁',
        occupation: '学院院长',
        background: '学术权威，正在考虑周教授的升职申请。',
        secret: '我和周教授曾有过一段不光彩的过去，他一直用这件事威胁我。',
        isMurderer: false,
      },
    ],
  },
  {
    id: 'train-mystery',
    title: '午夜列车',
    cover: '🚂',
    playerCount: '4-6人',
    difficulty: '困难',
    duration: '约45分钟',
    background: '一列开往远方的午夜列车上，包厢里传来尖叫声。当乘务员打开门时，发现一具尸体...',
    story: '1947年冬天，一列从北平开往上海的特快列车上，头等包厢的乘客方先生被发现死于包厢中。车窗紧闭，门从里面锁着。所有同车厢的乘客都成了嫌疑人。列车还有6小时才能到站，凶手就在这些人中间...',
    clues: [
      '方先生是有名的律师，经手过很多大案子',
      '有人声称晚餐后看到方先生与人激烈争吵',
      '包厢里发现了一封未寄出的信',
      '死者手中紧握着一颗纽扣',
      '列车在案发时间段曾短暂停车',
    ],
    roles: [
      {
        id: 'widow',
        name: '方太太',
        gender: 'female',
        age: '38岁',
        occupation: '死者妻子',
        background: '美丽优雅，与方先生结婚十年。这次是陪丈夫出差。',
        secret: '我知道丈夫有外遇，我这次来就是想拿到证据然后离婚争取财产。',
        isMurderer: false,
      },
      {
        id: 'businessman',
        name: '钱老板',
        gender: 'male',
        age: '50岁',
        occupation: '商人',
        background: '做进出口生意的富商，满身铜臭味但出手大方。',
        secret: '方律师帮我的竞争对手打赢了官司，让我损失惨重。我用领带勒死了他。',
        isMurderer: true,
      },
      {
        id: 'actress',
        name: '苏小姐',
        gender: 'female',
        age: '25岁',
        occupation: '电影明星',
        background: '当红女演员，正要去上海拍新戏。',
        secret: '方律师手里有我的把柄，他一直在勒索我。',
        isMurderer: false,
      },
      {
        id: 'officer',
        name: '马少校',
        gender: 'male',
        age: '40岁',
        occupation: '军官',
        background: '刚从战场回来的军官，沉默寡言。',
        secret: '我认出方律师就是当年害死我父亲的人，但我没有杀他。',
        isMurderer: false,
      },
      {
        id: 'priest',
        name: '李神父',
        gender: 'male',
        age: '60岁',
        occupation: '神父',
        background: '慈祥的老神父，正要去上海的教堂。',
        secret: '方先生在被杀前来找我忏悔，说有人要杀他，但他没说是谁。',
        isMurderer: false,
      },
      {
        id: 'servant',
        name: '阿福',
        gender: 'male',
        age: '28岁',
        occupation: '钱老板的随从',
        background: '钱老板的贴身仆人，忠心耿耿。',
        secret: '我看到老板深夜从方先生的包厢出来，衣服凌乱。',
        isMurderer: false,
      },
    ],
  },
];
