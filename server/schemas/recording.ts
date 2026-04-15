import { z } from "zod";

export const insertRecordingSchema = z.object({
  audioUrl: z.string(),
  sentenceText: z.string(),
  userId: z.string(),
  creditCost: z.number().optional(),
});

export const insertFeedbackSchema = z.object({
  recordingId: z.number(),
  reviewerId: z.string(),
  textFeedback: z.string(),
  corrections: z.string().optional(),
  rating: z.number().optional(),
});
