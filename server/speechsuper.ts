import { createHash } from "crypto";
import { spawn } from "child_process";
import { ObjectStorageService } from "./replit_integrations/object_storage";
import type { CharacterRating, SpeechSuperScores } from "@shared/schema";

export interface ISEResult {
  characterRatings: CharacterRating[];
  fluencyScore: number;
  overallScore: number;
  speechSuperScores: SpeechSuperScores;
}

// ─── Score mapping ────────────────────────────────────────────────────────────

function mapScore(score: number): 0 | 50 | 100 {
  if (score < 40) return 0;
  if (score < 75) return 50;
  return 100;
}

function mapFluency(score: number): number {
  if (score < 20) return 1;
  if (score < 40) return 2;
  if (score < 60) return 3;
  if (score < 80) return 4;
  return 5;
}

// ─── Pronunciation error library IDs ─────────────────────────────────────────

const INITIAL_PHONE_TO_ERROR: Record<string, string> = {
  // Retroflex group
  zh: "I001", ch: "I001", sh: "I001",
  // Palatal group
  q:  "I002",
  x:  "I003",
  // Retroflex approximant
  r:  "I004",
  // Sibilants
  c:  "I005",
  z:  "I006",
  s:  "I011",
  // Palatal affricate
  j:  "I007",
  // Bilabial stops (aspiration contrast)
  b:  "I008", p: "I008",
  // Alveolar stops (aspiration contrast)
  d:  "I013", t: "I013",
  // Velar stops (aspiration contrast)
  g:  "I014", k: "I014",
  // Velar fricative
  h:  "I015",
  // Nasals / laterals
  n:  "I012", l: "I012",
};

const FINAL_PHONE_TO_ERROR: Record<string, string> = {
  // Front rounded vowel
  v:   "F001",
  // Mid-back unrounded vowel
  e:   "F002",
  // Velar nasal finals
  eng: "F003", ing: "F003", in: "F003",
  // ian glide
  ian: "F004",
  // uo diphthong
  uo:  "F005",
  // ong velar nasal
  ong: "F006",
  // ai diphthong
  ai:  "F007",
  // iao triphthong
  iao: "F008",
  // er-hua
  er:  "F009",
  // an/ang confusion
  an:  "F010", ang: "F010",
  // ao diphthong
  ao:  "F011",
  // ui (uei) glide
  ui:  "F012",
  // un (uen) glide
  un:  "F013",
  // üe (front rounded + e)
  ve:  "F014",
};

const LIKELY_TONE_ERROR: Record<number, string> = {
  1: "T006",
  2: "T002",
  3: "T010",
  4: "T003",
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

function sha1(content: string): string {
  return createHash("sha1").update(content, "utf8").digest("hex");
}

function getConnectSig(appId: string, secretKey: string) {
  const timestamp = new Date().getTime().toString();
  const sig = sha1(appId + timestamp + secretKey);
  return { sig, timestamp };
}

function getStartSig(appId: string, secretKey: string, userId: string) {
  const timestamp = new Date().getTime().toString();
  const sig = sha1(appId + timestamp + userId + secretKey);
  return { sig, timestamp, userId };
}

// ─── Audio helpers ────────────────────────────────────────────────────────────

async function fetchAudioBuffer(audioUrl: string): Promise<Buffer> {
  const objService = new ObjectStorageService();
  const file = await objService.getObjectEntityFile(audioUrl);
  const [buffer] = await file.download();
  return buffer as Buffer;
}

/**
 * Transcode any audio format to 16kHz 16-bit mono WAV via ffmpeg.
 * SpeechSuper accepts audioType:"wav" with these parameters.
 */
async function transcodeToWav(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel", "error",
      "-i", "pipe:0",
      "-acodec", "pcm_s16le",
      "-ac", "1",
      "-ar", "16000",
      "-f", "wav",
      "pipe:1",
    ]);

    const chunks: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stdout.on("end", () => {
      if (chunks.length === 0) {
        reject(new Error("ffmpeg produced no WAV output"));
        return;
      }
      resolve(Buffer.concat(chunks));
    });

    const stderrChunks: Buffer[] = [];
    proc.stderr.on("data", (d: Buffer) => stderrChunks.push(d));
    proc.on("error", (err) => reject(new Error(`ffmpeg spawn error: ${err.message}`)));
    proc.on("close", (code) => {
      if (code !== 0) {
        const stderr = Buffer.concat(stderrChunks).toString("utf8").trim();
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
      }
    });

    proc.stdin.write(input);
    proc.stdin.end();
  });
}

// ─── SpeechSuper HTTP request ─────────────────────────────────────────────────

interface SSWord {
  word: string;
  tone: string;           // "tone1" | "tone2" | "tone3" | "tone4" | "tone5"
  charType: number;       // 0 = Chinese, 1 = punctuation
  scores: {
    pronunciation: number;
    tone: number;
    overall_pron?: number;
  };
  phonemes?: {
    phone: string;
    tone_index: string;   // "0" = initial, "1"/"2" = final
    pronunciation: number;
  }[];
}

interface SSResponse {
  eof: number;
  errId?: string;
  result?: {
    overall: number;
    fluency: number;
    tone?: number;
    rear_tone?: number;
    rhythm?: number;
    speed?: number;
    pronunciation?: number;
    words: SSWord[];
  };
}

async function callSpeechSuper(
  wavBuffer: Buffer,
  appId: string,
  secretKey: string,
  refText: string
): Promise<SSResponse> {
  const userId = "marlow";
  const connectSig = getConnectSig(appId, secretKey);
  const startSig = getStartSig(appId, secretKey, userId);

  const textParam = JSON.stringify({
    connect: {
      cmd: "connect",
      param: {
        sdk: {
          version: 16777472,
          source: 9,
          protocol: 2,
        },
        app: {
          applicationId: appId,
          sig: connectSig.sig,
          timestamp: connectSig.timestamp,
        },
      },
    },
    start: {
      cmd: "start",
      param: {
        app: {
          applicationId: appId,
          sig: startSig.sig,
          userId: startSig.userId,
          timestamp: startSig.timestamp,
        },
        audio: {
          audioType: "wav",
          sampleRate: 16000,
          channel: 1,
          sampleBytes: 2,
        },
        request: {
          coreType: "sent.eval.cn",
          refText,
          phoneme_output: 1,
          tone_weight: 0.2,
        },
      },
    },
  });

  console.log("[SpeechSuper] Sending request for:", refText);

  const form = new FormData();
  form.append("text", textParam);
  form.append(
    "audio",
    new Blob([wavBuffer], { type: "audio/wav" }),
    "audio.wav"
  );

  const response = await fetch("https://api.speechsuper.com/sent.eval.cn", {
    method: "POST",
    body: form,
    headers: {
      "Request-Index": "0",
    },
    signal: AbortSignal.timeout(60_000),
  });

  const responseText = await response.text();
  console.log("[SpeechSuper] Response status:", response.status, "body:", responseText.slice(0, 500));

  if (!response.ok) {
    throw new Error(`SpeechSuper HTTP ${response.status}: ${responseText}`);
  }

  return JSON.parse(responseText) as SSResponse;
}

// ─── Response parsing ─────────────────────────────────────────────────────────

function parseSpeechSuperResult(
  res: SSResponse,
  sentenceText: string
): ISEResult {
  const result = res.result!;
  const overallScore = Math.round(result.overall ?? 0);
  const fluencyScore = mapFluency(result.fluency ?? 50);

  const chineseChars = Array.from(sentenceText).filter((ch) =>
    /[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)
  );

  // Filter to Chinese-only words (charType 0), skip punctuation
  const chineseWords = result.words.filter((w) => w.charType === 0);

  const characterRatings: CharacterRating[] = chineseChars.map((char, idx) => {
    const w = chineseWords[idx];
    if (!w) {
      return { character: char, initial: 50, final: 50, tone: 50 };
    }

    const toneScoreRaw = Math.round(w.scores.tone ?? 50);
    const phoneScoreRaw = Math.round(w.scores.pronunciation ?? 50);

    // Expected tone from "tone3" → 3, skip neutral (5)
    const toneNumStr = w.tone?.replace("tone", "");
    const expectedToneNum = toneNumStr ? parseInt(toneNumStr, 10) : undefined;
    const expectedTone =
      expectedToneNum && expectedToneNum >= 1 && expectedToneNum <= 4
        ? expectedToneNum
        : undefined;

    // Phoneme breakdown
    const phonemes = w.phonemes ?? [];
    const initialPhonemes = phonemes.filter((p) => p.tone_index === "0");
    const finalPhonemes = phonemes.filter((p) => p.tone_index !== "0");

    // Initial score
    const initialAvg =
      initialPhonemes.length > 0
        ? initialPhonemes.reduce((s, p) => s + p.pronunciation, 0) / initialPhonemes.length
        : phoneScoreRaw;
    const initial = mapScore(initialAvg);

    // Final score
    const finalAvg =
      finalPhonemes.length > 0
        ? finalPhonemes.reduce((s, p) => s + p.pronunciation, 0) / finalPhonemes.length
        : phoneScoreRaw;
    const final = mapScore(finalAvg);

    // Tone score
    const tone = mapScore(toneScoreRaw);

    // Symbols for error lookup
    const initialSymbol = initialPhonemes[0]?.phone;
    const finalSymbol = finalPhonemes[0]?.phone;

    // Error IDs — only flag when score is "poor" or "ok" (< 75)
    const initialError =
      initialAvg < 75 && initialSymbol
        ? INITIAL_PHONE_TO_ERROR[initialSymbol]
        : undefined;
    const finalError =
      finalAvg < 75 && finalSymbol
        ? FINAL_PHONE_TO_ERROR[finalSymbol]
        : undefined;
    const toneError =
      toneScoreRaw < 75 && expectedTone !== undefined
        ? LIKELY_TONE_ERROR[expectedTone]
        : undefined;

    return {
      character: char,
      initial,
      final,
      tone,
      expectedTone,
      toneScoreRaw,
      phoneScoreRaw,
      initialScoreRaw: initialPhonemes.length > 0 ? Math.round(initialAvg) : undefined,
      finalScoreRaw: Math.round(finalAvg),
      hasInitial: initialPhonemes.length > 0,
      initialError,
      finalError,
      toneError,
      initialSymbol: initialPhonemes.length > 0 ? initialSymbol : undefined,
      finalSymbol,
    };
  });

  const speechSuperScores: SpeechSuperScores = {
    tone: result.tone != null ? Math.round(result.tone) : undefined,
    rearTone: result.rear_tone != null ? Math.round(result.rear_tone) : undefined,
    rhythm: result.rhythm != null ? Math.round(result.rhythm) : undefined,
    speed: result.speed != null ? Math.round(result.speed) : undefined,
    pronunciation: result.pronunciation != null ? Math.round(result.pronunciation) : undefined,
  };

  return { characterRatings, fluencyScore, overallScore, speechSuperScores };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function scoreMandarin(
  audioUrl: string,
  sentenceText: string
): Promise<ISEResult> {
  const appId = process.env.SPEECHSUPER_APP_ID;
  const secretKey = process.env.SPEECHSUPER_SECRET_KEY;

  if (!appId || !secretKey) {
    throw new Error("SPEECHSUPER_APP_ID and SPEECHSUPER_SECRET_KEY must be set");
  }

  const rawAudio = await fetchAudioBuffer(audioUrl);
  const wavAudio = await transcodeToWav(rawAudio);

  const res = await callSpeechSuper(wavAudio, appId, secretKey, sentenceText);

  if (res.errId && res.errId !== "0") {
    throw new Error(`SpeechSuper error ${res.errId}`);
  }

  if (!res.result) {
    throw new Error("SpeechSuper returned no result");
  }

  console.log("[SpeechSuper] overall:", res.result.overall, "fluency:", res.result.fluency);
  console.log("[SpeechSuper] words:", JSON.stringify(res.result.words?.map(w => ({
    word: w.word,
    tone: w.tone,
    scores: w.scores,
    phonemes: w.phonemes,
  }))));

  const result = parseSpeechSuperResult(res, sentenceText);
  console.log("[SpeechSuper] characterRatings:", JSON.stringify(result.characterRatings));
  return result;
}
