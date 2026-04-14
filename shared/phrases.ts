export interface ToneChar {
  char: string;
  tone: 1 | 2 | 3 | 4 | 0;
  pinyin: string;
}

export interface Phrase {
  characters: ToneChar[];
  english: string;
}

export function phraseToText(phrase: Phrase): string {
  return phrase.characters.map((c) => c.char).join("");
}
