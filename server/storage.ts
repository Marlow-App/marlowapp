import { db } from "./db";
import {
  recordings,
  feedback,
  users,
  userConsents,
  creditTransactions,
  pronunciationErrors,
  practiceListItems,
  supportTickets,
  dailyCrosswords,
  crosswordCompletions,
  type InsertRecording,
  type InsertFeedback,
  type InsertFeedbackWithReviewer,
  type Recording,
  type Feedback,
  type User,
  type PronunciationError,
  type PracticeListItem,
  type SupportTicket,
  type DailyCrossword,
  type CrosswordCompletion,
  type CrosswordWord,
} from "@shared/schema";
import { eq, desc, and, sql, gte, count } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";
import { ObjectStorageService } from "./replit_integrations/object_storage";

export interface IStorage {
  createRecording(userId: string, recording: InsertRecording, parentRecordingId?: number): Promise<Recording>;
  getRecording(id: number): Promise<Recording | undefined>;
  getRecordingsByUser(userId: string): Promise<Recording[]>;
  getChildRecordings(parentId: number): Promise<Recording[]>;
  getAllPendingRecordings(): Promise<(Recording & { user: User | null })[]>;
  getAllRecordings(): Promise<(Recording & { user: User | null })[]>;
  deleteRecording(id: number): Promise<boolean>;
  createFeedback(feedbackData: InsertFeedbackWithReviewer): Promise<Feedback>;
  getFeedback(id: number): Promise<Feedback | undefined>;
  updateFeedback(id: number, data: Partial<InsertFeedback>): Promise<Feedback | undefined>;
  deleteFeedback(id: number): Promise<boolean>;
  getFeedbackForRecording(recordingId: number): Promise<Feedback[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByStripeCustomerId(customerId: string): Promise<User | undefined>;
  saveConsents(userId: string, consentTypes: string[], policyVersion: string, ipAddress: string): Promise<void>;
  hasUserConsented(userId: string): Promise<boolean>;
  countTodayRecordings(userId: string): Promise<number>;
  getPracticeListCount(userId: string): Promise<number>;
  updateUserSubscription(userId: string, data: {
    subscriptionTier: "free" | "pro";
    subscriptionStatus: string;
    stripeSubscriptionId?: string;
    subscriptionPeriodEnd: Date | null;
  }): Promise<void>;
  getErrors(category?: string): Promise<PronunciationError[]>;
  getError(id: string): Promise<PronunciationError | undefined>;
  createError(data: { id: string; category: "tone" | "initial" | "final"; commonError: string; simpleExplanation?: string; howToFix?: string; practiceWords?: string[]; createdBy: string }): Promise<PronunciationError>;
  getPracticeList(userId: string): Promise<(PracticeListItem & { error: PronunciationError; sentenceText?: string })[]>;
  addToPracticeList(userId: string, errorId: string, character?: string, recordingId?: number): Promise<PracticeListItem>;
  removeFromPracticeList(id: number, userId: string): Promise<boolean>;
  isPracticeListItem(userId: string, errorId: string): Promise<boolean>;
  getReviewersWithEmailNotifications(): Promise<User[]>;
  getAllReviewersWithEmail(): Promise<User[]>;
  createSupportTicket(userId: string, category: string, message: string): Promise<SupportTicket>;
  listSupportTickets(): Promise<(SupportTicket & { user: User | null; resolvedBy: User | null })[]>;
  resolveSupportTicket(id: number, resolvedById: string): Promise<SupportTicket | undefined>;

  // Crossword
  getTodayCrossword(): Promise<DailyCrossword | undefined>;
  getCrosswordByIndex(puzzleIndex: number): Promise<DailyCrossword | undefined>;
  getAllCrosswords(): Promise<DailyCrossword[]>;
  updateCrossword(id: number, data: { grid?: boolean[][]; words?: CrosswordWord[]; title?: string }): Promise<DailyCrossword | undefined>;
  getCrosswordStatus(userId: string, puzzleId: number, puzzleDate: string): Promise<CrosswordCompletion | undefined>;
  saveCrosswordProgress(userId: string, puzzleId: number, puzzleDate: string, cells: Record<string, string>, elapsedSeconds: number): Promise<CrosswordCompletion>;
  completeCrossword(userId: string, puzzleId: number, puzzleDate: string, cells: Record<string, string>, elapsedSeconds: number): Promise<CrosswordCompletion>;
  getArchiveCrosswords(userId: string): Promise<Array<{ puzzle: DailyCrossword; date: string; isComplete: boolean }>>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    return authStorage.getUser(id);
  }

  async getUserByStripeCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    return user;
  }

  async createRecording(userId: string, recording: InsertRecording, parentRecordingId?: number): Promise<Recording> {
    const [newRecording] = await db
      .insert(recordings)
      .values({ ...recording, userId, ...(parentRecordingId ? { parentRecordingId } : {}) })
      .returning();
    return newRecording;
  }

  async getRecording(id: number): Promise<Recording | undefined> {
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id));
    return recording;
  }

  async getRecordingsByUser(userId: string): Promise<Recording[]> {
    return db
      .select()
      .from(recordings)
      .where(eq(recordings.userId, userId))
      .orderBy(desc(recordings.createdAt));
  }

  async getChildRecordings(parentId: number): Promise<Recording[]> {
    return db
      .select()
      .from(recordings)
      .where(eq(recordings.parentRecordingId, parentId))
      .orderBy(desc(recordings.createdAt));
  }

  async getAllPendingRecordings(): Promise<(Recording & { user: User | null })[]> {
    const results = await db
      .select({
        recording: recordings,
        user: users,
      })
      .from(recordings)
      .leftJoin(users, eq(recordings.userId, users.id))
      .where(eq(recordings.status, "pending"))
      .orderBy(desc(recordings.createdAt));
    
    return results.map(r => ({ ...r.recording, user: r.user }));
  }

  async getAllRecordings(): Promise<(Recording & { user: User | null })[]> {
    const results = await db
      .select({
        recording: recordings,
        user: users,
      })
      .from(recordings)
      .leftJoin(users, eq(recordings.userId, users.id))
      .orderBy(desc(recordings.createdAt));
    
    return results.map(r => ({ ...r.recording, user: r.user }));
  }

  async deleteRecording(id: number): Promise<boolean> {
    const [recording] = await db
      .select()
      .from(recordings)
      .where(eq(recordings.id, id));

    if (!recording) return false;

    const feedbackRows = await db
      .select()
      .from(feedback)
      .where(eq(feedback.recordingId, id));

    await db.delete(feedback).where(eq(feedback.recordingId, id));
    await db.delete(creditTransactions).where(eq(creditTransactions.recordingId, id));
    await db.delete(recordings).where(eq(recordings.id, id));

    const objService = new ObjectStorageService();

    for (const fb of feedbackRows) {
      if (fb.audioFeedbackUrl) {
        try {
          const file = await objService.getObjectEntityFile(fb.audioFeedbackUrl);
          await file.delete();
        } catch (e) {
          console.error(`Failed to delete feedback audio file ${fb.audioFeedbackUrl}:`, e);
        }
      }
    }

    if (recording.audioUrl) {
      try {
        const file = await objService.getObjectEntityFile(recording.audioUrl);
        await file.delete();
      } catch (e) {
        console.error(`Failed to delete recording audio file ${recording.audioUrl}:`, e);
      }
    }

    return true;
  }

  async createFeedback(feedbackData: InsertFeedbackWithReviewer): Promise<Feedback> {
    const [newFeedback] = await db
      .insert(feedback)
      .values({
        recordingId: feedbackData.recordingId,
        reviewerId: feedbackData.reviewerId,
        textFeedback: feedbackData.textFeedback,
        corrections: feedbackData.corrections ?? null,
        audioFeedbackUrl: feedbackData.audioFeedbackUrl,
        rating: feedbackData.rating ?? null,
        characterRatings: feedbackData.characterRatings ?? null,
        fluencyScore: feedbackData.fluencyScore ?? null,
        overallScore: feedbackData.overallScore ?? null,
        speechSuperScores: feedbackData.speechSuperScores ?? null,
        isAiFeedback: feedbackData.isAiFeedback ?? false,
      })
      .returning();
    
    await db
      .update(recordings)
      .set({ status: "reviewed" })
      .where(eq(recordings.id, feedbackData.recordingId));

    return newFeedback;
  }

  async getFeedback(id: number): Promise<Feedback | undefined> {
    const [fb] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, id));
    return fb;
  }

  async updateFeedback(id: number, data: Partial<InsertFeedback>): Promise<Feedback | undefined> {
    const updateData: any = {};
    if (data.textFeedback !== undefined) updateData.textFeedback = data.textFeedback;
    if ((data as any).corrections !== undefined) updateData.corrections = (data as any).corrections;
    if (data.audioFeedbackUrl !== undefined) updateData.audioFeedbackUrl = data.audioFeedbackUrl;
    if ((data as any).characterRatings !== undefined) updateData.characterRatings = (data as any).characterRatings;
    if ((data as any).fluencyScore !== undefined) updateData.fluencyScore = (data as any).fluencyScore;
    if ((data as any).overallScore !== undefined) updateData.overallScore = (data as any).overallScore;

    const [updated] = await db
      .update(feedback)
      .set(updateData)
      .where(eq(feedback.id, id))
      .returning();
    return updated;
  }

  async deleteFeedback(id: number): Promise<boolean> {
    const [fb] = await db
      .select()
      .from(feedback)
      .where(eq(feedback.id, id));

    if (!fb) return false;

    if (fb.audioFeedbackUrl) {
      try {
        const objService = new ObjectStorageService();
        const file = await objService.getObjectEntityFile(fb.audioFeedbackUrl);
        await file.delete();
      } catch (e) {
        console.error(`Failed to delete feedback audio file ${fb.audioFeedbackUrl}:`, e);
      }
    }

    await db.delete(feedback).where(eq(feedback.id, id));

    const remaining = await db
      .select()
      .from(feedback)
      .where(eq(feedback.recordingId, fb.recordingId));

    if (remaining.length === 0) {
      await db
        .update(recordings)
        .set({ status: "pending" })
        .where(eq(recordings.id, fb.recordingId));
    }

    return true;
  }

  async getFeedbackForRecording(recordingId: number): Promise<Feedback[]> {
    return db
      .select()
      .from(feedback)
      .where(eq(feedback.recordingId, recordingId))
      .orderBy(desc(feedback.createdAt));
  }

  async saveConsents(userId: string, consentTypes: string[], policyVersion: string, ipAddress: string): Promise<void> {
    const values = consentTypes.map(type => ({
      userId,
      consentType: type,
      policyVersion,
      ipAddress,
    }));
    await db.insert(userConsents).values(values);
    await authStorage.upsertUser({ id: userId, consentGiven: true });
  }

  async hasUserConsented(userId: string): Promise<boolean> {
    const user = await this.getUser(userId);
    return !!user?.consentGiven;
  }

  async countTodayRecordings(userId: string): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const [result] = await db
      .select({ cnt: count() })
      .from(recordings)
      .where(and(eq(recordings.userId, userId), gte(recordings.createdAt, startOfDay)));
    return result?.cnt ?? 0;
  }

  async getPracticeListCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ cnt: count() })
      .from(practiceListItems)
      .where(eq(practiceListItems.userId, userId));
    return result?.cnt ?? 0;
  }

  async updateUserSubscription(userId: string, data: {
    subscriptionTier: "free" | "pro";
    subscriptionStatus: string;
    stripeSubscriptionId?: string;
    subscriptionPeriodEnd: Date | null;
  }): Promise<void> {
    const update: any = {
      id: userId,
      subscriptionTier: data.subscriptionTier,
      subscriptionStatus: data.subscriptionStatus,
      subscriptionPeriodEnd: data.subscriptionPeriodEnd,
    };
    if (data.stripeSubscriptionId) {
      update.stripeSubscriptionId = data.stripeSubscriptionId;
    }
    await authStorage.upsertUser(update);
  }

  // ─── Error Methods ─────────────────────────────────────────────────────────

  async getErrors(category?: string): Promise<PronunciationError[]> {
    if (category) {
      return db
        .select()
        .from(pronunciationErrors)
        .where(eq(pronunciationErrors.category, category as "tone" | "initial" | "final"))
        .orderBy(pronunciationErrors.id);
    }
    return db.select().from(pronunciationErrors).orderBy(pronunciationErrors.id);
  }

  async getError(id: string): Promise<PronunciationError | undefined> {
    const [err] = await db
      .select()
      .from(pronunciationErrors)
      .where(eq(pronunciationErrors.id, id));
    return err;
  }

  async createError(data: {
    id: string;
    category: "tone" | "initial" | "final";
    commonError: string;
    simpleExplanation?: string;
    howToFix?: string;
    practiceWords?: string[];
    createdBy: string;
  }): Promise<PronunciationError> {
    const [created] = await db
      .insert(pronunciationErrors)
      .values({
        id: data.id,
        category: data.category,
        commonError: data.commonError,
        simpleExplanation: data.simpleExplanation ?? null,
        howToFix: data.howToFix ?? null,
        practiceWords: data.practiceWords ?? [],
        isCustom: true,
        createdBy: data.createdBy,
      })
      .returning();
    return created;
  }

  // ─── Practice List ─────────────────────────────────────────────────────────

  async getPracticeList(userId: string): Promise<(PracticeListItem & { error: PronunciationError; sentenceText?: string })[]> {
    const rows = await db
      .select({ item: practiceListItems, error: pronunciationErrors, sentenceText: recordings.sentenceText })
      .from(practiceListItems)
      .innerJoin(pronunciationErrors, eq(practiceListItems.errorId, pronunciationErrors.id))
      .leftJoin(recordings, eq(practiceListItems.recordingId, recordings.id))
      .where(eq(practiceListItems.userId, userId))
      .orderBy(desc(practiceListItems.addedAt));
    return rows.map(r => ({ ...r.item, error: r.error, sentenceText: r.sentenceText ?? undefined }));
  }

  async addToPracticeList(userId: string, errorId: string, character?: string, recordingId?: number): Promise<PracticeListItem> {
    const existing = await db
      .select()
      .from(practiceListItems)
      .where(
        and(
          eq(practiceListItems.userId, userId),
          eq(practiceListItems.errorId, errorId),
          character ? eq(practiceListItems.character, character) : sql`character IS NULL`
        )
      )
      .limit(1);
    if (existing.length > 0) {
      if (recordingId && !existing[0].recordingId) {
        const [updated] = await db
          .update(practiceListItems)
          .set({ recordingId })
          .where(eq(practiceListItems.id, existing[0].id))
          .returning();
        return updated;
      }
      return existing[0];
    }

    const [item] = await db
      .insert(practiceListItems)
      .values({ userId, errorId, character: character ?? null, recordingId: recordingId ?? null })
      .returning();
    return item;
  }

  async removeFromPracticeList(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(practiceListItems)
      .where(and(eq(practiceListItems.id, id), eq(practiceListItems.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async isPracticeListItem(userId: string, errorId: string): Promise<boolean> {
    const rows = await db
      .select()
      .from(practiceListItems)
      .where(and(eq(practiceListItems.userId, userId), eq(practiceListItems.errorId, errorId)))
      .limit(1);
    return rows.length > 0;
  }

  async getReviewersWithEmailNotifications(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "reviewer"),
          eq(users.emailNotifications, true),
          sql`${users.email} IS NOT NULL`
        )
      );
  }

  async getAllReviewersWithEmail(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(
        and(
          eq(users.role, "reviewer"),
          sql`${users.email} IS NOT NULL`
        )
      );
  }

  async createSupportTicket(userId: string, category: string, message: string): Promise<SupportTicket> {
    const [ticket] = await db
      .insert(supportTickets)
      .values({ userId, category, message, status: "open" })
      .returning();
    return ticket;
  }

  async listSupportTickets(): Promise<(SupportTicket & { user: User | null; resolvedBy: User | null })[]> {
    const rows = await db
      .select()
      .from(supportTickets)
      .orderBy(desc(supportTickets.createdAt));

    return Promise.all(
      rows.map(async (ticket) => {
        const user = ticket.userId ? (await this.getUser(ticket.userId)) ?? null : null;
        const resolvedBy = ticket.resolvedById ? (await this.getUser(ticket.resolvedById)) ?? null : null;
        return { ...ticket, user, resolvedBy };
      })
    );
  }

  async resolveSupportTicket(id: number, resolvedById: string): Promise<SupportTicket | undefined> {
    const [updated] = await db
      .update(supportTickets)
      .set({ status: "completed", resolvedById, resolvedAt: new Date() })
      .where(eq(supportTickets.id, id))
      .returning();
    return updated;
  }

  // ─── Crossword ─────────────────────────────────────────────────────────────

  private getTodayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private getTodayPuzzleIndex(totalPuzzles: number): number {
    const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch % totalPuzzles;
  }

  async getTodayCrossword(): Promise<DailyCrossword | undefined> {
    const all = await db.select().from(dailyCrosswords).orderBy(dailyCrosswords.puzzleIndex);
    if (!all.length) return undefined;
    const idx = this.getTodayPuzzleIndex(all.length);
    return all.find(p => p.puzzleIndex === idx) ?? all[0];
  }

  async getCrosswordByIndex(puzzleIndex: number): Promise<DailyCrossword | undefined> {
    const [row] = await db.select().from(dailyCrosswords).where(eq(dailyCrosswords.puzzleIndex, puzzleIndex)).limit(1);
    return row;
  }

  async getAllCrosswords(): Promise<DailyCrossword[]> {
    return db.select().from(dailyCrosswords).orderBy(dailyCrosswords.puzzleIndex);
  }

  async updateCrossword(id: number, data: { grid?: boolean[][]; words?: CrosswordWord[]; title?: string }): Promise<DailyCrossword | undefined> {
    const setData: Partial<{ grid: unknown; words: unknown; title: string }> = {};
    if (data.grid !== undefined) setData.grid = data.grid;
    if (data.words !== undefined) setData.words = data.words;
    if (data.title !== undefined) setData.title = data.title;
    const [updated] = await db
      .update(dailyCrosswords)
      .set(setData)
      .where(eq(dailyCrosswords.id, id))
      .returning();
    return updated;
  }

  async getCrosswordStatus(userId: string, puzzleId: number, puzzleDate: string): Promise<CrosswordCompletion | undefined> {
    const [row] = await db
      .select()
      .from(crosswordCompletions)
      .where(and(eq(crosswordCompletions.userId, userId), eq(crosswordCompletions.puzzleId, puzzleId), eq(crosswordCompletions.puzzleDate, puzzleDate)))
      .limit(1);
    return row;
  }

  async saveCrosswordProgress(userId: string, puzzleId: number, puzzleDate: string, cells: Record<string, string>, elapsedSeconds: number): Promise<CrosswordCompletion> {
    const existing = await this.getCrosswordStatus(userId, puzzleId, puzzleDate);
    if (existing) {
      const [updated] = await db
        .update(crosswordCompletions)
        .set({ cells, elapsedSeconds })
        .where(eq(crosswordCompletions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(crosswordCompletions)
      .values({ userId, puzzleId, puzzleDate, cells, elapsedSeconds, isComplete: false })
      .returning();
    return created;
  }

  async completeCrossword(userId: string, puzzleId: number, puzzleDate: string, cells: Record<string, string>, elapsedSeconds: number): Promise<CrosswordCompletion> {
    const existing = await this.getCrosswordStatus(userId, puzzleId, puzzleDate);
    if (existing) {
      const [updated] = await db
        .update(crosswordCompletions)
        .set({ cells, elapsedSeconds, isComplete: true, completedAt: new Date() })
        .where(eq(crosswordCompletions.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(crosswordCompletions)
      .values({ userId, puzzleId, puzzleDate, cells, elapsedSeconds, isComplete: true, completedAt: new Date() })
      .returning();
    return created;
  }

  async getArchiveCrosswords(userId: string): Promise<Array<{ puzzle: DailyCrossword; date: string; isComplete: boolean }>> {
    const all = await db.select().from(dailyCrosswords).orderBy(dailyCrosswords.puzzleIndex);
    if (!all.length) return [];
    const total = all.length;
    const daysSinceEpoch = Math.floor(Date.now() / (1000 * 60 * 60 * 24));

    // April 14 2026 is the crossword feature launch date — no archive entries before this day
    const CROSSWORD_LAUNCH_DAY = Math.floor(Date.UTC(2026, 3, 14) / (1000 * 60 * 60 * 24));

    // Only show puzzles from the user's join date onward (and never before launch day)
    const [user] = await db.select({ createdAt: users.createdAt }).from(users).where(eq(users.id, userId)).limit(1);
    const joinDay = user?.createdAt ? Math.floor(user.createdAt.getTime() / (1000 * 60 * 60 * 24)) : daysSinceEpoch;
    const effectiveStartDay = Math.max(joinDay, CROSSWORD_LAUNCH_DAY);
    const maxLookback = Math.max(0, Math.min(59, daysSinceEpoch - effectiveStartDay));

    // Fetch all completions for this user in one query (select both puzzleId AND puzzleDate)
    const completions = await db
      .select({ puzzleId: crosswordCompletions.puzzleId, puzzleDate: crosswordCompletions.puzzleDate })
      .from(crosswordCompletions)
      .where(and(eq(crosswordCompletions.userId, userId), eq(crosswordCompletions.isComplete, true)));
    // Build a set of "puzzleId:puzzleDate" keys so completions are date-specific
    const completedKeys = new Set(completions.map(c => `${c.puzzleId}:${c.puzzleDate}`));

    const result: Array<{ puzzle: DailyCrossword; date: string; isComplete: boolean }> = [];
    for (let n = 1; n <= maxLookback; n++) {
      const pastDay = daysSinceEpoch - n;
      const pastIdx = ((pastDay % total) + total) % total;
      const puzzle = all.find(p => p.puzzleIndex === pastIdx);
      if (!puzzle) continue;
      const d = new Date(pastDay * 24 * 60 * 60 * 1000);
      const date = d.toISOString().slice(0, 10);
      result.push({ puzzle, date, isComplete: completedKeys.has(`${puzzle.id}:${date}`) });
    }
    return result;
  }
}

export const storage = new DatabaseStorage();
