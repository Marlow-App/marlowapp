import { createHash, createHmac } from "crypto";
import WebSocket from "ws";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

const IFLYTEK_HOST = "tts-api-sg.xf-yun.com";
const IFLYTEK_PATH = "/v2/tts";
const IFLYTEK_WSS = `ws://${IFLYTEK_HOST}${IFLYTEK_PATH}`;

const VOICE_MALE = "x4_lingfeizhe";
const VOICE_FEMALE = "aisjiuxu";

function parseObjectPath(fullPath: string) {
  const parts = fullPath.replace(/^\//, "").split("/");
  const bucketName = parts[0];
  const objectName = parts.slice(1).join("/");
  return { bucketName, objectName };
}

const TTS_CACHE_VERSION = "iflytek_v9";

function textToHash(text: string, gender: "M" | "F"): string {
  return createHash("md5").update(TTS_CACHE_VERSION + gender + text).digest("hex").slice(0, 12);
}

function getPhraseAudioPath(hash: string): string {
  const publicPaths = (process.env.PUBLIC_OBJECT_SEARCH_PATHS || "").split(",").map(p => p.trim()).filter(Boolean);
  if (publicPaths.length === 0) throw new Error("PUBLIC_OBJECT_SEARCH_PATHS not set");
  return `${publicPaths[0]}/phrase-audio/${hash}.mp3`;
}

function buildSignedUrl(appKey: string, apiSecret: string): string {
  const date = new Date().toUTCString();
  const signatureOrigin = `host: ${IFLYTEK_HOST}\ndate: ${date}\nGET ${IFLYTEK_PATH} HTTP/1.1`;
  const signature = createHmac("sha256", apiSecret)
    .update(signatureOrigin)
    .digest("base64");
  const authorizationOrigin = `api_key="${appKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authorizationOrigin).toString("base64");
  const query = `authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(IFLYTEK_HOST)}`;
  return `${IFLYTEK_WSS}?${query}`;
}

function synthesizeViaWebSocket(url: string, text: string, appId: string, voiceName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const audioChunks: Buffer[] = [];
    let settled = false;
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

    const done = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      try { ws.close(); } catch {}
      if (err) {
        reject(err);
      } else {
        resolve(Buffer.concat(audioChunks));
      }
    };

    ws.on("open", () => {
      const payload = {
        common: { app_id: appId },
        business: {
          aue: "lame",
          auf: "audio/L16;rate=16000",
          vcn: voiceName,
          tte: "UTF8",
          speed: 50,
          volume: 50,
          pitch: 50,
        },
        data: {
          status: 2,
          text: Buffer.from(text, "utf8").toString("base64"),
        },
      };
      ws.send(JSON.stringify(payload));
    });

    ws.on("message", (raw: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(raw.toString());
        console.log(`[iFLYTEK] code=${msg.code} sid=${msg.sid} status=${msg.data?.status} voice=${voiceName}`);
        if (msg.code !== 0) {
          done(new Error(`iFLYTEK TTS error ${msg.code}: ${msg.message}`));
          return;
        }
        const audio = msg.data?.audio;
        if (audio) {
          audioChunks.push(Buffer.from(audio, "base64"));
        }
        if (msg.data?.status === 2) {
          done();
        }
      } catch (err) {
        done(err instanceof Error ? err : new Error(String(err)));
      }
    });

    ws.on("error", (err) => done(err));

    ws.on("close", () => {
      if (!settled) {
        done(new Error("iFLYTEK WebSocket closed unexpectedly"));
      }
    });

    timeoutHandle = setTimeout(() => done(new Error("iFLYTEK TTS timed out after 30s")), 30_000);
  });
}

export async function generatePhraseAudio(text: string, gender: "M" | "F" = "M"): Promise<string> {
  const appId = process.env.IFLYTEK_APP_ID;
  const apiKey = process.env.IFLYTEK_API_KEY;
  const apiSecret = process.env.IFLYTEK_API_SECRET;
  if (!appId) throw new Error("IFLYTEK_APP_ID not set");
  if (!apiKey) throw new Error("IFLYTEK_API_KEY not set");
  if (!apiSecret) throw new Error("IFLYTEK_API_SECRET not set");

  const voiceName = gender === "F" ? VOICE_FEMALE : VOICE_MALE;
  const hash = textToHash(text, gender);
  const fullPath = getPhraseAudioPath(hash);
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (exists) {
    return `/api/phrase-audio/${hash}`;
  }

  const url = buildSignedUrl(apiKey, apiSecret);
  // Pad with trailing spaces so the LAME encoder flushes its final frame without
  // affecting prosody or intonation of the actual text.
  const synthesisText = text + "   ";
  const audioBuffer = await synthesizeViaWebSocket(url, synthesisText, appId, voiceName);

  if (audioBuffer.length === 0) {
    throw new Error("iFLYTEK returned empty audio");
  }

  await file.save(audioBuffer, {
    metadata: {
      contentType: "audio/mpeg",
    },
  });

  return `/api/phrase-audio/${hash}`;
}

export async function getPhraseAudioFile(hash: string) {
  const fullPath = getPhraseAudioPath(hash);
  const { bucketName, objectName } = parseObjectPath(fullPath);
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  const [exists] = await file.exists();
  if (!exists) return null;

  return file;
}
