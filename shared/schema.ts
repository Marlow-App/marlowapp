console.log("SCHEMA VERSION 123");

// shared/schema.ts

import {
  pgTable,
  text,
  serial,
  timestamp,
  boolean,
  integer,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";

// =========================
// DATABASE TABLES
// =========================

export const pronunciationErrors = pgTable("pronunciation_errors", {
  id: text("id").primaryKey(),
  category: text("category", { enum: ["tone", "initial", "final"] }).notNull(),
  commonError: text("common_error").notNull(),
  example: text("example"),
  scientificExplanation: text("scientific_explanation"),
  simpleExplanation: text("simple_explanation"),
  howToFix: text("how_to_fix"),
  minimalPairs: text("minimal_pairs"),
  practiceWords: text("practice_words").array(),
  isCustom: boolean("is_custom").default(false).notNull(),
  createdBy: varchar("created_by"), // ❌ removed FK for now
});

export const recordings = pgTable("recordings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(), // ❌ removed FK
  audioUrl: text("audio_url").notNull(),
  sentenceText: text("sentence_text").notNull(),
  status: text("status", { enum: ["pending", "reviewed"] })
    .default("pending")
    .notNull(),
  creditCost: integer("credit_cost").default(0).notNull(),
  creditsRefunded: boolean("credits_refunded").default(false).notNull(),
  parentRecordingId: integer("parent_recording_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  recordingId: integer("recording_id").notNull(),
  reviewerId: varchar("reviewer_id").notNull(),
  textFeedback: text("text_feedback").notNull(),
  corrections: text("corrections"),
  audioFeedbackUrl: text("audio_feedback_url"),
  rating: integer("rating"),
  characterRatings: jsonb("character_ratings"),
  fluencyScore: integer("fluency_score"),
  overallScore: integer("overall_score"),
  speechSuperScores: jsonb("speech_super_scores"),
  isAiFeedback: boolean("is_ai_feedback").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const practiceListItems = pgTable("practice_list_items", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  errorId: text("error_id").notNull(),
  character: text("character"),
  recordingId: integer("recording_id"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  type: text("type", {
    enum: ["signup_bonus", "daily_reward", "purchase", "spend", "refund"],
  }).notNull(),
  amount: integer("amount").notNull(),
  recordingId: integer("recording_id"),
  stripeSessionId: text("stripe_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const supportTickets = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  category: text("category").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["open", "completed"] })
    .default("open")
    .notNull(),
  resolvedById: varchar("resolved_by_id"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dailyCrosswords = pgTable("daily_crosswords", {
  id: serial("id").primaryKey(),
  puzzleIndex: integer("puzzle_index").notNull().unique(),
  title: text("title").notNull(),
  grid: jsonb("grid").notNull(),
  words: jsonb("words").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const crosswordCompletions = pgTable("crossword_completions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  puzzleId: integer("puzzle_id").notNull(),
  puzzleDate: text("puzzle_date").notNull(),
  cells: jsonb("cells").notNull().default({}),
  elapsedSeconds: integer("elapsed_seconds"),
  completedAt: timestamp("completed_at"),
  isComplete: boolean("is_complete").default(false).notNull(),
});

// =========================
// RELATIONS (optional for now)
// =========================

export const recordingsRelations = relations(recordings, () => ({}));
export const feedbackRelations = relations(feedback, () => ({}));
export const creditTransactionsRelations = relations(creditTransactions, () => ({}));

// =========================
// TYPES
// =========================

export type Recording = typeof recordings.$inferSelect;
export type Feedback = typeof feedback.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type SupportTicket = typeof supportTickets.$inferSelect;
