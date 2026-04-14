export interface CrosswordWordEntry {
  number: number;
  direction: "across" | "down";
  startRow: number;
  startCol: number;
  length: number;
  clue: string;
  chars: string[];
  answer: string[];
}

export interface CrosswordPuzzleData {
  title: string;
  puzzleIndex: number;
  grid: boolean[][];
  words: CrosswordWordEntry[];
}

// 4×4 I-beam layout:
// Row 0 = full ACROSS word (4 chars, cols 0-3)
// Col 1 = full DOWN word (4 chars, rows 0-3)
// Row 3 = full ACROSS word (4 chars, cols 0-3)
// Intersections: (row 0, col 1) and (row 3, col 1)
// Constraint: across1.chars[1] === down.chars[0]  AND  across3.chars[1] === down.chars[3]
const I_BEAM_4: boolean[][] = [
  [true,  true,  true,  true],
  [false, true,  false, false],
  [false, true,  false, false],
  [true,  true,  true,  true],
];

function makePuzzle(
  puzzleIndex: number,
  title: string,
  across1: { clue: string; chars: string[]; answer: string[] },
  down:    { clue: string; chars: string[]; answer: string[] },
  across3: { clue: string; chars: string[]; answer: string[] },
): CrosswordPuzzleData {
  if (across1.chars[1] !== down.chars[0]) {
    throw new Error(
      `Puzzle ${puzzleIndex}: across1.chars[1]="${across1.chars[1]}" must equal down.chars[0]="${down.chars[0]}"`,
    );
  }
  if (across3.chars[1] !== down.chars[3]) {
    throw new Error(
      `Puzzle ${puzzleIndex}: across3.chars[1]="${across3.chars[1]}" must equal down.chars[3]="${down.chars[3]}"`,
    );
  }
  return {
    title,
    puzzleIndex,
    grid: I_BEAM_4,
    words: [
      { number: 1, direction: "across", startRow: 0, startCol: 0, length: 4, ...across1 },
      { number: 2, direction: "down",   startRow: 0, startCol: 1, length: 4, ...down    },
      { number: 3, direction: "across", startRow: 3, startCol: 0, length: 4, ...across3 },
    ],
  };
}

export const SEED_PUZZLES: CrosswordPuzzleData[] = [

  // 0 — 第一印象 · 一路顺风 · 乘风破浪
  // A1[1]=一=D[0] ✓  A3[1]=风=D[3] ✓
  makePuzzle(0, "First Impressions",
    { clue: "first impression",
      chars: ["第","一","印","象"], answer: ["di","yi","yin","xiang"] },
    { clue: "bon voyage",
      chars: ["一","路","顺","风"], answer: ["yi","lu","shun","feng"] },
    { clue: "brave all difficulties",
      chars: ["乘","风","破","浪"], answer: ["cheng","feng","po","lang"] },
  ),

  // 1 — 澳大利亚 · 大吃一惊 · 大惊失色
  // A1[1]=大=D[0] ✓  A3[1]=惊=D[3] ✓
  makePuzzle(1, "Shock & Surprise",
    { clue: "Australia",
      chars: ["澳","大","利","亚"], answer: ["ao","da","li","ya"] },
    { clue: "be shocked / startled",
      chars: ["大","吃","一","惊"], answer: ["da","chi","yi","jing"] },
    { clue: "turn pale with fright",
      chars: ["大","惊","失","色"], answer: ["da","jing","shi","se"] },
  ),

  // 2 — 全心全意 · 心想事成 · 功成名就
  // A1[1]=心=D[0] ✓  A3[1]=成=D[3] ✓
  makePuzzle(2, "Heart & Success",
    { clue: "wholeheartedly",
      chars: ["全","心","全","意"], answer: ["quan","xin","quan","yi"] },
    { clue: "may your wishes come true",
      chars: ["心","想","事","成"], answer: ["xin","xiang","shi","cheng"] },
    { clue: "achieve fame and success",
      chars: ["功","成","名","就"], answer: ["gong","cheng","ming","jiu"] },
  ),

  // 3 — 顶天立地 · 天长地久 · 悠久历史
  // A1[1]=天=D[0] ✓  A3[1]=久=D[3] ✓
  makePuzzle(3, "Heaven & Earth",
    { clue: "stand between heaven and earth",
      chars: ["顶","天","立","地"], answer: ["ding","tian","li","di"] },
    { clue: "eternal",
      chars: ["天","长","地","久"], answer: ["tian","chang","di","jiu"] },
    { clue: "long history",
      chars: ["悠","久","历","史"], answer: ["you","jiu","li","shi"] },
  ),

  // 4 — 最新消息 · 新年快乐 · 欢乐时光
  // A1[1]=新=D[0] ✓  A3[1]=乐=D[3] ✓
  makePuzzle(4, "New Year Joy",
    { clue: "latest news",
      chars: ["最","新","消","息"], answer: ["zui","xin","xiao","xi"] },
    { clue: "Happy New Year",
      chars: ["新","年","快","乐"], answer: ["xin","nian","kuai","le"] },
    { clue: "happy times",
      chars: ["欢","乐","时","光"], answer: ["huan","le","shi","guang"] },
  ),

  // 5 — 万马奔腾 · 马到成功 · 建功立业
  // A1[1]=马=D[0] ✓  A3[1]=功=D[3] ✓
  makePuzzle(5, "Horses & Achievement",
    { clue: "ten thousand horses galloping",
      chars: ["万","马","奔","腾"], answer: ["wan","ma","ben","teng"] },
    { clue: "instant success",
      chars: ["马","到","成","功"], answer: ["ma","dao","cheng","gong"] },
    { clue: "build a career and achievements",
      chars: ["建","功","立","业"], answer: ["jian","gong","li","ye"] },
  ),

  // 6 — 青春活力 · 春暖花开 · 公开比赛
  // A1[1]=春=D[0] ✓  A3[1]=开=D[3] ✓
  makePuzzle(6, "Spring & Vitality",
    { clue: "youthful vitality",
      chars: ["青","春","活","力"], answer: ["qing","chun","huo","li"] },
    { clue: "spring is warm, flowers bloom",
      chars: ["春","暖","花","开"], answer: ["chun","nuan","hua","kai"] },
    { clue: "open competition",
      chars: ["公","开","比","赛"], answer: ["gong","kai","bi","sai"] },
  ),

  // 7 — 清风明月 · 风和日丽 · 美丽风景
  // A1[1]=风=D[0] ✓  A3[1]=丽=D[3] ✓
  makePuzzle(7, "Wind & Beauty",
    { clue: "clear breeze and bright moon",
      chars: ["清","风","明","月"], answer: ["qing","feng","ming","yue"] },
    { clue: "beautiful sunny day",
      chars: ["风","和","日","丽"], answer: ["feng","he","ri","li"] },
    { clue: "beautiful scenery",
      chars: ["美","丽","风","景"], answer: ["mei","li","feng","jing"] },
  ),

  // 8 — 小吃文化 · 吃喝玩乐 · 娱乐活动
  // A1[1]=吃=D[0] ✓  A3[1]=乐=D[3] ✓
  makePuzzle(8, "Food & Fun",
    { clue: "street food culture",
      chars: ["小","吃","文","化"], answer: ["xiao","chi","wen","hua"] },
    { clue: "eat, drink and be merry",
      chars: ["吃","喝","玩","乐"], answer: ["chi","he","wan","le"] },
    { clue: "entertainment activities",
      chars: ["娱","乐","活","动"], answer: ["yu","le","huo","dong"] },
  ),

  // 9 — 少年时代 · 年年有余 · 业余爱好
  // A1[1]=年=D[0] ✓  A3[1]=余=D[3] ✓
  makePuzzle(9, "Youth & Hobbies",
    { clue: "youth / childhood years",
      chars: ["少","年","时","代"], answer: ["shao","nian","shi","dai"] },
    { clue: "may every year be prosperous",
      chars: ["年","年","有","余"], answer: ["nian","nian","you","yu"] },
    { clue: "hobby / leisure interest",
      chars: ["业","余","爱","好"], answer: ["ye","yu","ai","hao"] },
  ),

  // 10 — 春节习俗 · 节日快乐 · 音乐老师
  // A1[1]=节=D[0] ✓  A3[1]=乐=D[3] ✓
  makePuzzle(10, "Festivals & Music",
    { clue: "Spring Festival customs",
      chars: ["春","节","习","俗"], answer: ["chun","jie","xi","su"] },
    { clue: "Happy Holidays",
      chars: ["节","日","快","乐"], answer: ["jie","ri","kuai","le"] },
    { clue: "music teacher",
      chars: ["音","乐","老","师"], answer: ["yin","yue","lao","shi"] },
  ),

  // 11 — 自学成才 · 学无止境 · 环境污染
  // A1[1]=学=D[0] ✓  A3[1]=境=D[3] ✓
  makePuzzle(11, "Learning & Environment",
    { clue: "become talented through self-study",
      chars: ["自","学","成","才"], answer: ["zi","xue","cheng","cai"] },
    { clue: "learning has no end",
      chars: ["学","无","止","境"], answer: ["xue","wu","zhi","jing"] },
    { clue: "environmental pollution",
      chars: ["环","境","污","染"], answer: ["huan","jing","wu","ran"] },
  ),

  // 12 — 踏青春游 · 青山绿水 · 饮水思源
  // A1[1]=青=D[0] ✓  A3[1]=水=D[3] ✓
  makePuzzle(12, "Nature & Gratitude",
    { clue: "spring outing",
      chars: ["踏","青","春","游"], answer: ["ta","qing","chun","you"] },
    { clue: "green mountains and clear waters",
      chars: ["青","山","绿","水"], answer: ["qing","shan","lv","shui"] },
    { clue: "don't forget your roots",
      chars: ["饮","水","思","源"], answer: ["yin","shui","si","yuan"] },
  ),

  // 13 — 黄金时代 · 金榜题名 · 著名人物
  // A1[1]=金=D[0] ✓  A3[1]=名=D[3] ✓
  makePuzzle(13, "Gold & Fame",
    { clue: "the golden age",
      chars: ["黄","金","时","代"], answer: ["huang","jin","shi","dai"] },
    { clue: "top of the exam list",
      chars: ["金","榜","题","名"], answer: ["jin","bang","ti","ming"] },
    { clue: "famous person",
      chars: ["著","名","人","物"], answer: ["zhu","ming","ren","wu"] },
  ),

  // 14 — 爱好广泛 · 好大喜功 · 立功立业
  // A1[1]=好=D[0] ✓  A3[1]=功=D[3] ✓
  makePuzzle(14, "Passion & Achievement",
    { clue: "wide-ranging interests",
      chars: ["爱","好","广","泛"], answer: ["ai","hao","guang","fan"] },
    { clue: "vainglorious",
      chars: ["好","大","喜","功"], answer: ["hao","da","xi","gong"] },
    { clue: "establish a career",
      chars: ["立","功","立","业"], answer: ["li","gong","li","ye"] },
  ),

  // 15 — 一心一意 · 心花怒放 · 大放异彩
  // A1[1]=心=D[0] ✓  A3[1]=放=D[3] ✓
  makePuzzle(15, "Heart & Joy",
    { clue: "with all one's heart",
      chars: ["一","心","一","意"], answer: ["yi","xin","yi","yi"] },
    { clue: "overjoyed; elated",
      chars: ["心","花","怒","放"], answer: ["xin","hua","nu","fang"] },
    { clue: "shine brilliantly",
      chars: ["大","放","异","彩"], answer: ["da","fang","yi","cai"] },
  ),

  // 16 — 聪明伶俐 · 明白事理 · 无理取闹
  // A1[1]=明=D[0] ✓  A3[1]=理=D[3] ✓
  makePuzzle(16, "Wisdom & Reason",
    { clue: "clever and quick-witted",
      chars: ["聪","明","伶","俐"], answer: ["cong","ming","ling","li"] },
    { clue: "understand reason and principle",
      chars: ["明","白","事","理"], answer: ["ming","bai","shi","li"] },
    { clue: "make trouble without reason",
      chars: ["无","理","取","闹"], answer: ["wu","li","qu","nao"] },
  ),

  // 17 — 大吉大利 · 吉祥如意 · 得意忘形
  // A1[1]=吉=D[0] ✓  A3[1]=意=D[3] ✓
  makePuzzle(17, "Fortune & Blessings",
    { clue: "great fortune and profit",
      chars: ["大","吉","大","利"], answer: ["da","ji","da","li"] },
    { clue: "auspicious and as you wish",
      chars: ["吉","祥","如","意"], answer: ["ji","xiang","ru","yi"] },
    { clue: "get carried away with success",
      chars: ["得","意","忘","形"], answer: ["de","yi","wang","xing"] },
  ),

  // 18 — 人生如梦 · 生龙活虎 · 如虎添翼
  // A1[1]=生=D[0] ✓  A3[1]=虎=D[3] ✓
  makePuzzle(18, "Dragon & Tiger",
    { clue: "life is like a dream",
      chars: ["人","生","如","梦"], answer: ["ren","sheng","ru","meng"] },
    { clue: "full of energy",
      chars: ["生","龙","活","虎"], answer: ["sheng","long","huo","hu"] },
    { clue: "even more powerful",
      chars: ["如","虎","添","翼"], answer: ["ru","hu","tian","yi"] },
  ),

  // 19 — 深情厚意 · 情深义重 · 举重若轻
  // A1[1]=情=D[0] ✓  A3[1]=重=D[3] ✓
  makePuzzle(19, "Deep Feeling",
    { clue: "deep and genuine feelings",
      chars: ["深","情","厚","意"], answer: ["shen","qing","hou","yi"] },
    { clue: "deep feelings and loyalty",
      chars: ["情","深","义","重"], answer: ["qing","shen","yi","zhong"] },
    { clue: "handle heavy matters with ease",
      chars: ["举","重","若","轻"], answer: ["ju","zhong","ruo","qing"] },
  ),

  // 20 — 心安理得 · 安居乐业 · 创业维艰
  // A1[1]=安=D[0] ✓  A3[1]=业=D[3] ✓
  makePuzzle(20, "Peace & Industry",
    { clue: "have peace of mind",
      chars: ["心","安","理","得"], answer: ["xin","an","li","de"] },
    { clue: "live and work in peace",
      chars: ["安","居","乐","业"], answer: ["an","ju","le","ye"] },
    { clue: "starting a business is difficult",
      chars: ["创","业","维","艰"], answer: ["chuang","ye","wei","jian"] },
  ),

  // 21 — 大道至简 · 道听途说 · 胡说八道
  // A1[1]=道=D[0] ✓  A3[1]=说=D[3] ✓
  makePuzzle(21, "Words & Rumour",
    { clue: "the great way is simple",
      chars: ["大","道","至","简"], answer: ["da","dao","zhi","jian"] },
    { clue: "spread rumours",
      chars: ["道","听","途","说"], answer: ["dao","ting","tu","shuo"] },
    { clue: "talk nonsense",
      chars: ["胡","说","八","道"], answer: ["hu","shuo","ba","dao"] },
  ),

  // 22 — 人山人海 · 山穷水尽 · 竭尽全力
  // A1[1]=山=D[0] ✓  A3[1]=尽=D[3] ✓
  makePuzzle(22, "Crowds & Effort",
    { clue: "huge crowds of people",
      chars: ["人","山","人","海"], answer: ["ren","shan","ren","hai"] },
    { clue: "at the end of one's rope",
      chars: ["山","穷","水","尽"], answer: ["shan","qiong","shui","jin"] },
    { clue: "do one's utmost",
      chars: ["竭","尽","全","力"], answer: ["jie","jin","quan","li"] },
  ),

  // 23 — 不时之需 · 时来运转 · 急转直下
  // A1[1]=时=D[0] ✓  A3[1]=转=D[3] ✓
  makePuzzle(23, "Time & Turns",
    { clue: "for future need, just in case",
      chars: ["不","时","之","需"], answer: ["bu","shi","zhi","xu"] },
    { clue: "luck turns in one's favour",
      chars: ["时","来","运","转"], answer: ["shi","lai","yun","zhuan"] },
    { clue: "a sudden turn for the worse",
      chars: ["急","转","直","下"], answer: ["ji","zhuan","zhi","xia"] },
  ),

  // 24 — 朝思暮想 · 思贤若渴 · 饥渴难耐
  // A1[1]=思=D[0] ✓  A3[1]=渴=D[3] ✓
  makePuzzle(24, "Longing & Thirst",
    { clue: "think about day and night",
      chars: ["朝","思","暮","想"], answer: ["zhao","si","mu","xiang"] },
    { clue: "thirst for talented people",
      chars: ["思","贤","若","渴"], answer: ["si","xian","ruo","ke"] },
    { clue: "desperately thirsty",
      chars: ["饥","渴","难","耐"], answer: ["ji","ke","nan","nai"] },
  ),

  // 25 — 阳春三月 · 春华秋实 · 落实政策
  // A1[1]=春=D[0] ✓  A3[1]=实=D[3] ✓
  makePuzzle(25, "Spring & Results",
    { clue: "spring season",
      chars: ["阳","春","三","月"], answer: ["yang","chun","san","yue"] },
    { clue: "spring blossoms, autumn harvest",
      chars: ["春","华","秋","实"], answer: ["chun","hua","qiu","shi"] },
    { clue: "implement policies",
      chars: ["落","实","政","策"], answer: ["luo","shi","zheng","ce"] },
  ),

  // 26 — 眼花缭乱 · 花样年华 · 才华横溢
  // A1[1]=花=D[0] ✓  A3[1]=华=D[3] ✓
  makePuzzle(26, "Flowers & Talent",
    { clue: "dazzled; overwhelmed",
      chars: ["眼","花","缭","乱"], answer: ["yan","hua","liao","luan"] },
    { clue: "the flower of youth",
      chars: ["花","样","年","华"], answer: ["hua","yang","nian","hua"] },
    { clue: "overflowing with talent",
      chars: ["才","华","横","溢"], answer: ["cai","hua","heng","yi"] },
  ),

  // 27 — 至高无上 · 高山仰止 · 举止文雅
  // A1[1]=高=D[0] ✓  A3[1]=止=D[3] ✓
  makePuzzle(27, "Height & Manners",
    { clue: "supreme; highest of all",
      chars: ["至","高","无","上"], answer: ["zhi","gao","wu","shang"] },
    { clue: "look up to with admiration",
      chars: ["高","山","仰","止"], answer: ["gao","shan","yang","zhi"] },
    { clue: "well-mannered and refined",
      chars: ["举","止","文","雅"], answer: ["ju","zhi","wen","ya"] },
  ),

  // 28 — 一无所有 · 无所不知 · 求知若渴
  // A1[1]=无=D[0] ✓  A3[1]=知=D[3] ✓
  makePuzzle(28, "Knowledge & Nothing",
    { clue: "have nothing; penniless",
      chars: ["一","无","所","有"], answer: ["yi","wu","suo","you"] },
    { clue: "all-knowing",
      chars: ["无","所","不","知"], answer: ["wu","suo","bu","zhi"] },
    { clue: "thirst for knowledge",
      chars: ["求","知","若","渴"], answer: ["qiu","zhi","ruo","ke"] },
  ),

  // 29 — 行远自迩 · 远见卓识 · 博识多闻
  // A1[1]=远=D[0] ✓  A3[1]=识=D[3] ✓
  makePuzzle(29, "Vision & Knowledge",
    { clue: "a long journey begins nearby",
      chars: ["行","远","自","迩"], answer: ["xing","yuan","zi","er"] },
    { clue: "farsighted and insightful",
      chars: ["远","见","卓","识"], answer: ["yuan","jian","zhuo","shi"] },
    { clue: "erudite and well-informed",
      chars: ["博","识","多","闻"], answer: ["bo","shi","duo","wen"] },
  ),

  // 30 — 成长之路 · 长治久安 · 居安思危
  // A1[1]=长=D[0] ✓  A3[1]=安=D[3] ✓
  makePuzzle(30, "Growth & Stability",
    { clue: "path of growth",
      chars: ["成","长","之","路"], answer: ["cheng","zhang","zhi","lu"] },
    { clue: "long-term stability and peace",
      chars: ["长","治","久","安"], answer: ["chang","zhi","jiu","an"] },
    { clue: "be prepared in times of peace",
      chars: ["居","安","思","危"], answer: ["ju","an","si","wei"] },
  ),

  // 31 — 厚德载物 · 德才兼备 · 有备无患
  // A1[1]=德=D[0] ✓  A3[1]=备=D[3] ✓
  makePuzzle(31, "Virtue & Readiness",
    { clue: "great virtue supports all things",
      chars: ["厚","德","载","物"], answer: ["hou","de","zai","wu"] },
    { clue: "have both ability and virtue",
      chars: ["德","才","兼","备"], answer: ["de","cai","jian","bei"] },
    { clue: "be prepared for any contingency",
      chars: ["有","备","无","患"], answer: ["you","bei","wu","huan"] },
  ),

  // 32 — 春日暖阳 · 日积月累 · 积累经验
  // A1[1]=日=D[0] ✓  A3[1]=累=D[3] ✓
  makePuzzle(32, "Sunshine & Progress",
    { clue: "warm spring sun",
      chars: ["春","日","暖","阳"], answer: ["chun","ri","nuan","yang"] },
    { clue: "accumulate over time",
      chars: ["日","积","月","累"], answer: ["ri","ji","yue","lei"] },
    { clue: "accumulate experience",
      chars: ["积","累","经","验"], answer: ["ji","lei","jing","yan"] },
  ),

  // 33 — 真情实意 · 情投意合 · 配合默契
  // A1[1]=情=D[0] ✓  A3[1]=合=D[3] ✓
  makePuzzle(33, "Sincere & Congenial",
    { clue: "sincere feelings and intentions",
      chars: ["真","情","实","意"], answer: ["zhen","qing","shi","yi"] },
    { clue: "congenial; in perfect agreement",
      chars: ["情","投","意","合"], answer: ["qing","tou","yi","he"] },
    { clue: "work together seamlessly",
      chars: ["配","合","默","契"], answer: ["pei","he","mo","qi"] },
  ),

  // 34 — 时光飞逝 · 光明正大 · 宽大为怀
  // A1[1]=光=D[0] ✓  A3[1]=大=D[3] ✓
  makePuzzle(34, "Time & Generosity",
    { clue: "time flies",
      chars: ["时","光","飞","逝"], answer: ["shi","guang","fei","shi"] },
    { clue: "open and aboveboard",
      chars: ["光","明","正","大"], answer: ["guang","ming","zheng","da"] },
    { clue: "be magnanimous",
      chars: ["宽","大","为","怀"], answer: ["kuan","da","wei","huai"] },
  ),

  // 35 — 士气高昂 · 气象万千 · 成千上万
  // A1[1]=气=D[0] ✓  A3[1]=千=D[3] ✓
  makePuzzle(35, "Morale & Multitude",
    { clue: "high morale",
      chars: ["士","气","高","昂"], answer: ["shi","qi","gao","ang"] },
    { clue: "magnificent variety",
      chars: ["气","象","万","千"], answer: ["qi","xiang","wan","qian"] },
    { clue: "thousands and thousands",
      chars: ["成","千","上","万"], answer: ["cheng","qian","shang","wan"] },
  ),

  // 36 — 爱国主义 · 国泰民安 · 平安是福
  // A1[1]=国=D[0] ✓  A3[1]=安=D[3] ✓
  makePuzzle(36, "Patriotism & Peace",
    { clue: "patriotism",
      chars: ["爱","国","主","义"], answer: ["ai","guo","zhu","yi"] },
    { clue: "prosperous and peaceful country",
      chars: ["国","泰","民","安"], answer: ["guo","tai","min","an"] },
    { clue: "safety is the greatest blessing",
      chars: ["平","安","是","福"], answer: ["ping","an","shi","fu"] },
  ),

  // 37 — 全力以赴 · 力争上游 · 遨游太空
  // A1[1]=力=D[0] ✓  A3[1]=游=D[3] ✓
  makePuzzle(37, "Effort & Exploration",
    { clue: "go all out; spare no effort",
      chars: ["全","力","以","赴"], answer: ["quan","li","yi","fu"] },
    { clue: "strive to be at the top",
      chars: ["力","争","上","游"], answer: ["li","zheng","shang","you"] },
    { clue: "roam through outer space",
      chars: ["遨","游","太","空"], answer: ["ao","you","tai","kong"] },
  ),

  // 38 — 大步向前 · 步步为营 · 经营有道
  // A1[1]=步=D[0] ✓  A3[1]=营=D[3] ✓
  makePuzzle(38, "Steady Progress",
    { clue: "stride forward",
      chars: ["大","步","向","前"], answer: ["da","bu","xiang","qian"] },
    { clue: "be cautious; consolidate at every step",
      chars: ["步","步","为","营"], answer: ["bu","bu","wei","ying"] },
    { clue: "skilled at managing / business",
      chars: ["经","营","有","道"], answer: ["jing","ying","you","dao"] },
  ),

  // 39 — 发奋图强 · 奋发向上 · 锦上添花
  // A1[1]=奋=D[0] ✓  A3[1]=上=D[3] ✓
  makePuzzle(39, "Drive & Flourish",
    { clue: "strive to make oneself stronger",
      chars: ["发","奋","图","强"], answer: ["fa","fen","tu","qiang"] },
    { clue: "strive upward; motivated",
      chars: ["奋","发","向","上"], answer: ["fen","fa","xiang","shang"] },
    { clue: "add splendour to what's already beautiful",
      chars: ["锦","上","添","花"], answer: ["jin","shang","tian","hua"] },
  ),

  // 40 — 一言为定 · 言出必行 · 言行一致
  // A1[1]=言=D[0] ✓  A3[1]=行=D[3] ✓
  makePuzzle(40, "Keeping One's Word",
    { clue: "it's a deal; your word is your bond",
      chars: ["一","言","为","定"], answer: ["yi","yan","wei","ding"] },
    { clue: "keep one's word",
      chars: ["言","出","必","行"], answer: ["yan","chu","bi","xing"] },
    { clue: "word and deed are consistent",
      chars: ["言","行","一","致"], answer: ["yan","xing","yi","zhi"] },
  ),

  // 41 — 忠诚可靠 · 诚信待人 · 爱人如己
  // A1[1]=诚=D[0] ✓  A3[1]=人=D[3] ✓
  makePuzzle(41, "Honesty & Kindness",
    { clue: "loyal and reliable",
      chars: ["忠","诚","可","靠"], answer: ["zhong","cheng","ke","kao"] },
    { clue: "treat people with sincerity",
      chars: ["诚","信","待","人"], answer: ["cheng","xin","dai","ren"] },
    { clue: "love others as yourself",
      chars: ["爱","人","如","己"], answer: ["ai","ren","ru","ji"] },
  ),

  // 42 — 如梦如幻 · 梦想成真 · 认真负责
  // A1[1]=梦=D[0] ✓  A3[1]=真=D[3] ✓
  makePuzzle(42, "Dreams & Responsibility",
    { clue: "like a dream; ethereal",
      chars: ["如","梦","如","幻"], answer: ["ru","meng","ru","huan"] },
    { clue: "dream comes true",
      chars: ["梦","想","成","真"], answer: ["meng","xiang","cheng","zhen"] },
    { clue: "conscientious and responsible",
      chars: ["认","真","负","责"], answer: ["ren","zhen","fu","ze"] },
  ),

  // 43 — 爱书如命 · 书生意气 · 朝气蓬勃
  // A1[1]=书=D[0] ✓  A3[1]=气=D[3] ✓
  makePuzzle(43, "Books & Energy",
    { clue: "love books passionately",
      chars: ["爱","书","如","命"], answer: ["ai","shu","ru","ming"] },
    { clue: "scholarly idealism",
      chars: ["书","生","意","气"], answer: ["shu","sheng","yi","qi"] },
    { clue: "full of youthful energy",
      chars: ["朝","气","蓬","勃"], answer: ["zhao","qi","peng","bo"] },
  ),

  // 44 — 大快人心 · 快人快语 · 妙语连珠
  // A1[1]=快=D[0] ✓  A3[1]=语=D[3] ✓
  makePuzzle(44, "Candid & Witty",
    { clue: "greatly satisfying",
      chars: ["大","快","人","心"], answer: ["da","kuai","ren","xin"] },
    { clue: "frank and outspoken",
      chars: ["快","人","快","语"], answer: ["kuai","ren","kuai","yu"] },
    { clue: "witty remarks in rapid succession",
      chars: ["妙","语","连","珠"], answer: ["miao","yu","lian","zhu"] },
  ),

  // 45 — 众望所归 · 望子成龙 · 来龙去脉
  // A1[1]=望=D[0] ✓  A3[1]=龙=D[3] ✓
  makePuzzle(45, "Hopes & Dragons",
    { clue: "what everyone hopes for",
      chars: ["众","望","所","归"], answer: ["zhong","wang","suo","gui"] },
    { clue: "hope one's child will be successful",
      chars: ["望","子","成","龙"], answer: ["wang","zi","cheng","long"] },
    { clue: "the ins and outs; the whole story",
      chars: ["来","龙","去","脉"], answer: ["lai","long","qu","mai"] },
  ),

  // 46 — 欢喜若狂 · 喜出望外 · 内外兼修
  // A1[1]=喜=D[0] ✓  A3[1]=外=D[3] ✓
  makePuzzle(46, "Surprise & Balance",
    { clue: "overjoyed; wild with joy",
      chars: ["欢","喜","若","狂"], answer: ["huan","xi","ruo","kuang"] },
    { clue: "pleasantly surprised",
      chars: ["喜","出","望","外"], answer: ["xi","chu","wang","wai"] },
    { clue: "cultivate both inside and outside",
      chars: ["内","外","兼","修"], answer: ["nei","wai","jian","xiu"] },
  ),

  // 47 — 有感而发 · 感恩戴德 · 以德服人
  // A1[1]=感=D[0] ✓  A3[1]=德=D[3] ✓
  makePuzzle(47, "Gratitude & Virtue",
    { clue: "speak from the heart",
      chars: ["有","感","而","发"], answer: ["you","gan","er","fa"] },
    { clue: "feel grateful and indebted",
      chars: ["感","恩","戴","德"], answer: ["gan","en","dai","de"] },
    { clue: "win people over with virtue",
      chars: ["以","德","服","人"], answer: ["yi","de","fu","ren"] },
  ),

  // 48 — 宁静致远 · 静水流深 · 根深蒂固
  // A1[1]=静=D[0] ✓  A3[1]=深=D[3] ✓
  makePuzzle(48, "Stillness & Roots",
    { clue: "peace leads to great accomplishments",
      chars: ["宁","静","致","远"], answer: ["ning","jing","zhi","yuan"] },
    { clue: "still waters run deep",
      chars: ["静","水","流","深"], answer: ["jing","shui","liu","shen"] },
    { clue: "deep-rooted; ingrained",
      chars: ["根","深","蒂","固"], answer: ["gen","shen","di","gu"] },
  ),

  // 49 — 攻坚克难 · 坚定不移 · 潜移默化
  // A1[1]=坚=D[0] ✓  A3[1]=移=D[3] ✓
  makePuzzle(49, "Perseverance",
    { clue: "tackle difficult problems",
      chars: ["攻","坚","克","难"], answer: ["gong","jian","ke","nan"] },
    { clue: "firm and unwavering",
      chars: ["坚","定","不","移"], answer: ["jian","ding","bu","yi"] },
    { clue: "imperceptible influence",
      chars: ["潜","移","默","化"], answer: ["qian","yi","mo","hua"] },
  ),

  // 50 — 行万里路 · 万紫千红 · 大红大紫
  // A1[1]=万=D[0] ✓  A3[1]=红=D[3] ✓
  makePuzzle(50, "Colour & Fame",
    { clue: "travel ten thousand miles",
      chars: ["行","万","里","路"], answer: ["xing","wan","li","lu"] },
    { clue: "riot of colours; spring in full bloom",
      chars: ["万","紫","千","红"], answer: ["wan","zi","qian","hong"] },
    { clue: "extremely popular; a big hit",
      chars: ["大","红","大","紫"], answer: ["da","hong","da","zi"] },
  ),

  // 51 — 四海为家 · 海阔天空 · 凌空飞翔
  // A1[1]=海=D[0] ✓  A3[1]=空=D[3] ✓
  makePuzzle(51, "Oceans & Sky",
    { clue: "make one's home everywhere",
      chars: ["四","海","为","家"], answer: ["si","hai","wei","jia"] },
    { clue: "vast and boundless; free",
      chars: ["海","阔","天","空"], answer: ["hai","kuo","tian","kong"] },
    { clue: "soar high in the sky",
      chars: ["凌","空","飞","翔"], answer: ["ling","kong","fei","xiang"] },
  ),

  // 52 — 尊师重教 · 师恩难忘 · 不忘初心
  // A1[1]=师=D[0] ✓  A3[1]=忘=D[3] ✓
  makePuzzle(52, "Teachers & Memory",
    { clue: "respect teachers and value education",
      chars: ["尊","师","重","教"], answer: ["zun","shi","zhong","jiao"] },
    { clue: "unforgettable teacher's kindness",
      chars: ["师","恩","难","忘"], answer: ["shi","en","nan","wang"] },
    { clue: "never forget one's original aspiration",
      chars: ["不","忘","初","心"], answer: ["bu","wang","chu","xin"] },
  ),

  // 53 — 一路同行 · 路见不平 · 公平正义
  // A1[1]=路=D[0] ✓  A3[1]=平=D[3] ✓
  makePuzzle(53, "Justice & Companionship",
    { clue: "travel together; walk the same path",
      chars: ["一","路","同","行"], answer: ["yi","lu","tong","xing"] },
    { clue: "see injustice and take action",
      chars: ["路","见","不","平"], answer: ["lu","jian","bu","ping"] },
    { clue: "justice and fairness",
      chars: ["公","平","正","义"], answer: ["gong","ping","zheng","yi"] },
  ),

  // 54 — 大名鼎鼎 · 名副其实 · 求实精神
  // A1[1]=名=D[0] ✓  A3[1]=实=D[3] ✓
  makePuzzle(54, "Reputation",
    { clue: "very famous; celebrated",
      chars: ["大","名","鼎","鼎"], answer: ["da","ming","ding","ding"] },
    { clue: "live up to one's reputation",
      chars: ["名","副","其","实"], answer: ["ming","fu","qi","shi"] },
    { clue: "pragmatic spirit; seeking truth",
      chars: ["求","实","精","神"], answer: ["qiu","shi","jing","shen"] },
  ),

  // 55 — 心灵手巧 · 灵机一动 · 感动人心
  // A1[1]=灵=D[0] ✓  A3[1]=动=D[3] ✓
  makePuzzle(55, "Inspiration",
    { clue: "clever and nimble-fingered",
      chars: ["心","灵","手","巧"], answer: ["xin","ling","shou","qiao"] },
    { clue: "a sudden flash of inspiration",
      chars: ["灵","机","一","动"], answer: ["ling","ji","yi","dong"] },
    { clue: "touch people's hearts",
      chars: ["感","动","人","心"], answer: ["gan","dong","ren","xin"] },
  ),

  // 56 — 告别过去 · 别具一格 · 人格魅力
  // A1[1]=别=D[0] ✓  A3[1]=格=D[3] ✓
  makePuzzle(56, "Style & Character",
    { clue: "bid farewell to the past",
      chars: ["告","别","过","去"], answer: ["gao","bie","guo","qu"] },
    { clue: "having a unique and distinctive style",
      chars: ["别","具","一","格"], answer: ["bie","ju","yi","ge"] },
    { clue: "personal charm; charisma",
      chars: ["人","格","魅","力"], answer: ["ren","ge","mei","li"] },
  ),

  // 57 — 诚信做人 · 信守承诺 · 一诺千金
  // A1[1]=信=D[0] ✓  A3[1]=诺=D[3] ✓
  makePuzzle(57, "Trust & Promises",
    { clue: "be honest and sincere in life",
      chars: ["诚","信","做","人"], answer: ["cheng","xin","zuo","ren"] },
    { clue: "keep one's promises",
      chars: ["信","守","承","诺"], answer: ["xin","shou","cheng","nuo"] },
    { clue: "a promise worth a thousand gold",
      chars: ["一","诺","千","金"], answer: ["yi","nuo","qian","jin"] },
  ),

  // 58 — 立志向上 · 志同道合 · 联合行动
  // A1[1]=志=D[0] ✓  A3[1]=合=D[3] ✓
  makePuzzle(58, "Ambition & Teamwork",
    { clue: "set high aspirations",
      chars: ["立","志","向","上"], answer: ["li","zhi","xiang","shang"] },
    { clue: "like-minded; share common goals",
      chars: ["志","同","道","合"], answer: ["zhi","tong","dao","he"] },
    { clue: "joint action; act together",
      chars: ["联","合","行","动"], answer: ["lian","he","xing","dong"] },
  ),

  // 59 — 英才辈出 · 才华出众 · 大众文化
  // A1[1]=才=D[0] ✓  A3[1]=众=D[3] ✓
  makePuzzle(59, "Talent & Culture",
    { clue: "talented people emerge in great numbers",
      chars: ["英","才","辈","出"], answer: ["ying","cai","bei","chu"] },
    { clue: "outstandingly talented",
      chars: ["才","华","出","众"], answer: ["cai","hua","chu","zhong"] },
    { clue: "mass culture; popular culture",
      chars: ["大","众","文","化"], answer: ["da","zhong","wen","hua"] },
  ),

];

export async function seedCrosswords(): Promise<void> {
  const { db } = await import("./db");
  const { dailyCrosswords } = await import("@shared/schema");

  let upserted = 0;
  for (const puzzle of SEED_PUZZLES) {
    await db
      .insert(dailyCrosswords)
      .values({
        puzzleIndex: puzzle.puzzleIndex,
        title: puzzle.title,
        grid: puzzle.grid as unknown as Record<string, unknown>,
        words: puzzle.words as unknown as Record<string, unknown>[],
      })
      .onConflictDoUpdate({
        target: dailyCrosswords.puzzleIndex,
        set: {
          title: puzzle.title,
          grid: puzzle.grid as unknown as Record<string, unknown>,
          words: puzzle.words as unknown as Record<string, unknown>[],
        },
      });
    upserted++;
  }

  console.log(`[Crossword] Seed done — ${upserted} puzzles upserted.`);
}
