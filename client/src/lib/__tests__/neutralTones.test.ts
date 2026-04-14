import { getNeutralPatches, applyNeutralToneOverrides, NEUTRAL_TONE_WORDS } from "../neutralTones";

describe("getNeutralPatches", () => {
  it("patches 白 in 明白 (explicit compound)", () => {
    const patches = getNeutralPatches("明白");
    expect(patches.get(1)).toBe("bai");
    expect(patches.has(0)).toBe(false);
  });

  it("patches 道 in 知道 embedded in longer text", () => {
    // "我不知道" — 知道 starts at index 2
    const patches = getNeutralPatches("我不知道");
    expect(patches.get(3)).toBe("dao"); // 道 is at index 3
    expect(patches.has(2)).toBe(false);  // 知 has no override (null)
  });

  it("patches second syllable of kinship reduplications", () => {
    const mamaPatch = getNeutralPatches("妈妈");
    expect(mamaPatch.get(1)).toBe("ma");
    const babaPatch = getNeutralPatches("爸爸");
    expect(babaPatch.get(1)).toBe("ba");
  });

  it("patches second syllable of verb reduplications", () => {
    const kankPatch = getNeutralPatches("看看");
    expect(kankPatch.get(1)).toBe("kan");
  });

  it("patches multiple words in a sentence", () => {
    const patches = getNeutralPatches("他眼睛很大耳朵很小");
    expect(patches.get(1)).toBe("jing"); // 睛 in 眼睛 at idx 1
    expect(patches.get(4)).toBe("duo");  // 朵 in 耳朵 at idx 4
  });

  it("returns empty map for text with no neutral-tone words", () => {
    const patches = getNeutralPatches("中国");
    expect(patches.size).toBe(0);
  });
});

describe("applyNeutralToneOverrides", () => {
  it("replaces marked pinyin with neutral for exact token", () => {
    const result = applyNeutralToneOverrides("明白", ["míng", "bái"]);
    expect(result[0]).toBe("míng");
    expect(result[1]).toBe("bai");
  });

  it("handles embedded neutral word within longer token", () => {
    const result = applyNeutralToneOverrides("我不知道", ["wǒ", "bù", "zhī", "dào"]);
    expect(result[2]).toBe("zhī"); // 知 — no override
    expect(result[3]).toBe("dao"); // 道 — neutralised
  });

  it("returns original array unchanged when no neutral words found", () => {
    const input = ["zhōng", "guó"];
    const result = applyNeutralToneOverrides("中国", input);
    expect(result).toEqual(input);
  });

  it("does not mutate the original pinyin array", () => {
    const input = ["míng", "bái"];
    applyNeutralToneOverrides("明白", input);
    expect(input[1]).toBe("bái");
  });
});

describe("NEUTRAL_TONE_WORDS dictionary", () => {
  it("does not contain 阿姨 (standard Mandarin āyí has no neutral syllable)", () => {
    expect(NEUTRAL_TONE_WORDS["阿姨"]).toBeUndefined();
  });

  it("contains all task-specified disyllabic compounds", () => {
    const required = ["明白", "知道", "告诉", "意思", "消息", "眼睛", "耳朵",
      "客气", "舒服", "清楚", "葡萄", "玻璃", "豆腐", "钥匙", "麻烦", "暖和", "窗户"];
    for (const word of required) {
      expect(NEUTRAL_TONE_WORDS[word]).toBeDefined();
    }
  });

  it("contains kinship reduplications", () => {
    const kinship = ["妈妈", "爸爸", "哥哥", "弟弟", "姐姐", "妹妹", "爷爷", "奶奶"];
    for (const word of kinship) {
      expect(NEUTRAL_TONE_WORDS[word]).toBeDefined();
    }
  });
});
