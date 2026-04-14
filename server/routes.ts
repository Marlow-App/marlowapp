import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { api } from "@shared/routes";
import type { CrosswordWord } from "@shared/schema";
import { z } from "zod";
import { authStorage } from "./replit_integrations/auth/storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripe/stripeClient";
import { generatePhraseAudio, getPhraseAudioFile } from "./elevenlabs";
import { countChineseChars, MAX_CHARS, FREE_RECORDINGS_PER_DAY, FREE_PRACTICE_LIST_MAX, SUBSCRIPTION_PLANS } from "@shared/credits";
import { sendFeedbackNotification, sendRecordingNotification, sendSupportEmail } from "./email";
import { scoreMandarin } from "./speechsuper";

const UNLIMITED_EMAIL = process.env.UNLIMITED_CREDITS_EMAIL ?? null;

function safeUser(user: any) {
  if (!user) return null;
  const {
    stripeCustomerId: _sc,
    stripeSubscriptionId: _ss,
    creditBalance: _cb,
    freeCreditsBalance: _fb,
    lastDailyRewardAt: _ld,
    ...safe
  } = user;
  return safe;
}

function isProUser(user: any, email?: string): boolean {
  if (email === UNLIMITED_EMAIL) return true;
  return user?.subscriptionTier === "pro" && (user?.subscriptionStatus === "active" || user?.subscriptionStatus === "canceling");
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  // === Consent ===

  app.get("/api/consent", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const hasConsented = await storage.hasUserConsented(userId);
      res.json({ consented: hasConsented });
    } catch (error) {
      console.error("Error checking consent:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const consentSchema = z.object({
    consentTypes: z.array(
      z.enum(["age_verification", "terms_of_service", "privacy_policy", "voice_data_processing"])
    ).length(4),
  });

  app.post("/api/consent", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const parsed = consentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "All four consent types must be provided" });
      }

      const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
      const policyVersion = "2026-02-28";

      await storage.saveConsents(userId, parsed.data.consentTypes, policyVersion, ipAddress);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving consent:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Onboarding ===

  const onboardingSchema = z.object({
    chineseLevel: z.string().min(1),
    nativeLanguage: z.string().min(1),
    focusAreas: z.array(z.string()).min(1),
  });

  app.post("/api/onboarding", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const parsed = onboardingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid onboarding data" });
      }

      const updatedUser = await authStorage.upsertUser({
        id: userId,
        chineseLevel: parsed.data.chineseLevel,
        nativeLanguage: parsed.data.nativeLanguage,
        focusAreas: parsed.data.focusAreas,
        onboardingComplete: true,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error saving onboarding:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Subscription ===

  app.get("/api/subscription/status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userEmail = (req.user as any).claims.email;

      if (userEmail === UNLIMITED_EMAIL) {
        return res.json({ tier: "pro", status: "active", periodEnd: null, isUnlimited: true });
      }

      const user = await storage.getUser(userId);
      res.json({
        tier: user?.subscriptionTier ?? "free",
        status: user?.subscriptionStatus ?? null,
        periodEnd: user?.subscriptionPeriodEnd ?? null,
        isUnlimited: false,
      });
    } catch (error) {
      console.error("Error getting subscription status:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Recordings ===

  app.get(api.recordings.list.path, isAuthenticated, async (req, res) => {
    try {
      const user = (req.user as any);
      const userId = user.claims.sub;
      const dbUser = await storage.getUser(userId);

      let recordings;
      if (dbUser?.role === 'reviewer') {
        recordings = await storage.getAllRecordings();
      } else {
        recordings = await storage.getRecordingsByUser(userId);
      }

      const recordingsEnhanced = await Promise.all(recordings.map(async (r: any) => {
        const u = await storage.getUser(r.userId);
        let feedbackList: any[] = [];
        if (r.status === 'reviewed') {
          try {
            const rawFeedback = await storage.getFeedbackForRecording(r.id);
            feedbackList = await Promise.all(rawFeedback.map(async (f: any) => {
              const reviewer = await storage.getUser(f.reviewerId);
              return { ...f, reviewer: safeUser(reviewer) };
            }));
          } catch (e) {
            console.error(`Error fetching feedback for recording ${r.id}:`, e);
          }
        }
        return { ...r, feedback: feedbackList, user: safeUser(u) };
      }));

      res.json(recordingsEnhanced);
    } catch (error) {
      console.error("Error listing recordings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.recordings.listPending.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer") {
        return res.status(403).json({ message: "Reviewers only" });
      }
      const pending = await storage.getAllPendingRecordings();
      const pendingWithUser = await Promise.all(pending.map(async (r: any) => {
        const user = await storage.getUser(r.userId);
        const isPro = user?.subscriptionTier === "pro";
        return { ...r, user: safeUser(user), isPro };
      }));
      res.json(pendingWithUser);
    } catch (error) {
      console.error("Error listing pending recordings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/all-recordings", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer") {
        return res.status(403).json({ message: "Reviewers only" });
      }
      const recordings = await storage.getAllRecordings();

      const recordingsEnhanced = await Promise.all(recordings.map(async (r: any) => {
        const user = await storage.getUser(r.userId);
        let feedbackList: any[] = [];
        try {
          const rawFeedback = await storage.getFeedbackForRecording(r.id);
          feedbackList = await Promise.all(rawFeedback.map(async (f: any) => {
            const reviewer = await storage.getUser(f.reviewerId);
            return { ...f, reviewer: safeUser(reviewer) };
          }));
        } catch (e) {
          console.error(`Error fetching feedback for recording ${r.id}:`, e);
        }
        return { ...r, feedback: feedbackList, user: safeUser(user) };
      }));
      res.json(recordingsEnhanced);
    } catch (error) {
      console.error("Error listing all recordings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get(api.recordings.get.path, isAuthenticated, async (req, res) => {
    try {
      const recording = await storage.getRecording(Number(req.params.id));
      if (!recording) return res.status(404).json({ message: "Not found" });

      const user = await storage.getUser(recording.userId);
      const rawFeedback = await storage.getFeedbackForRecording(recording.id);
      const feedbackWithReviewer = await Promise.all(rawFeedback.map(async (f: any) => {
        const reviewer = await storage.getUser(f.reviewerId);
        return { ...f, reviewer: safeUser(reviewer) };
      }));
      res.json({ ...recording, feedback: feedbackWithReviewer, user: safeUser(user) });
    } catch (error) {
      console.error("Error getting recording:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/recordings/:id/children", isAuthenticated, async (req, res) => {
    try {
      const parentId = Number(req.params.id);
      const children = await storage.getChildRecordings(parentId);
      const childrenWithFeedback = await Promise.all(children.map(async (child) => {
        const rawFeedback = await storage.getFeedbackForRecording(child.id);
        const feedbackWithReviewer = await Promise.all(rawFeedback.map(async (f: any) => {
          const reviewer = await storage.getUser(f.reviewerId);
          return { ...f, reviewer: safeUser(reviewer) };
        }));
        return { ...child, feedback: feedbackWithReviewer };
      }));
      res.json(childrenWithFeedback);
    } catch (error) {
      console.error("Error getting child recordings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/recordings/:id", isAuthenticated, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      const recording = await storage.getRecording(recordingId);

      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }

      const isOwner = recording.userId === userId;
      const isReviewer = user?.role === "reviewer";

      if (!isOwner && !isReviewer) {
        return res.status(403).json({ message: "Not authorized to delete this recording" });
      }

      const deleted = await storage.deleteRecording(recordingId);
      if (!deleted) {
        return res.status(500).json({ message: "Failed to delete recording" });
      }

      res.json({ message: "Recording deleted" });
    } catch (error) {
      console.error("Error deleting recording:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create recording
  app.post(api.recordings.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.recordings.create.input.parse(req.body);
      const { rerecordOf, ...recordingData } = input;
      const userId = (req.user as any).claims.sub;
      const userEmail = (req.user as any).claims.email;

      const dbUser = await storage.getUser(userId);
      const isPro = isProUser(dbUser, userEmail);

      const charCount = countChineseChars(recordingData.sentenceText);

      if (charCount > MAX_CHARS) {
        return res.status(400).json({
          message: `Recording text too long. Maximum ${MAX_CHARS} Chinese characters allowed.`,
          charCount,
          max: MAX_CHARS,
        });
      }

      if (charCount === 0) {
        return res.status(400).json({ message: "Please include at least one Chinese character." });
      }

      // Check daily recording limit for free users
      if (!isPro) {
        const todayCount = await storage.countTodayRecordings(userId);
        if (todayCount >= FREE_RECORDINGS_PER_DAY) {
          return res.status(429).json({
            message: `Free accounts can only make ${FREE_RECORDINGS_PER_DAY} recordings per day. Upgrade to Pro for unlimited recordings.`,
            code: "DAILY_LIMIT_REACHED",
          });
        }
      }

      // Validate re-record parent if provided
      let parentRecordingId: number | undefined;
      if (rerecordOf) {
        const parent = await storage.getRecording(rerecordOf);
        if (!parent || parent.userId !== userId) {
          return res.status(403).json({ message: "Invalid parent recording." });
        }
        parentRecordingId = parent.id;
      }

      const recording = await storage.createRecording(userId, recordingData, parentRecordingId);

      // Notify reviewers (fire-and-forget)
      Promise.resolve().then(async () => {
        try {
          const learner = await storage.getUser(userId);
          const reviewers = await storage.getReviewersWithEmailNotifications();
          await Promise.allSettled(
            reviewers.map(reviewer => sendRecordingNotification(reviewer, recording, learner ?? null))
          );
        } catch (err) {
          console.error("[email] Error sending recording notifications:", err);
        }
      });

      res.status(201).json(recording);

      // SpeechSuper auto-review (fire-and-forget)
      Promise.resolve().then(async () => {
        try {
          const iseResult = await scoreMandarin(recording.audioUrl, recording.sentenceText);
          await storage.createFeedback({
            recordingId: recording.id,
            reviewerId: "iflytek-ai",
            textFeedback: "Automatic pronunciation assessment.",
            characterRatings: iseResult.characterRatings,
            fluencyScore: iseResult.fluencyScore,
            overallScore: iseResult.overallScore,
            speechSuperScores: iseResult.speechSuperScores,
            isAiFeedback: true,
          });
          console.log(`[SpeechSuper] Auto-review complete for recording ${recording.id}, score=${iseResult.overallScore}`);
        } catch (err) {
          console.error("[SpeechSuper] Auto-review failed (silent):", err);
        }
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
        return;
      }
      console.error("Error creating recording:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Feedback ===

  app.post(api.feedback.create.path, isAuthenticated, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);
      const reviewerId = (req.user as any).claims.sub;
      const { textFeedback, corrections, audioFeedbackUrl, characterRatings, fluencyScore } = req.body;

      if (!textFeedback && !corrections && !audioFeedbackUrl) {
        return res.status(400).json({ message: "Feedback text, corrections, or audio is required" });
      }

      let overallScore: number | null = null;
      let validatedRatings: any = null;
      let validatedFluency: number | null = null;

      if (fluencyScore !== undefined && fluencyScore !== null) {
        const f = Number(fluencyScore);
        if (!Number.isInteger(f) || f < 1 || f > 5) {
          return res.status(400).json({ message: "Fluency score must be an integer from 1 to 5" });
        }
        validatedFluency = f;
      }

      if (characterRatings && Array.isArray(characterRatings) && characterRatings.length > 0) {
        const { characterRatingSchema } = await import("@shared/schema");
        for (const cr of characterRatings) {
          characterRatingSchema.parse(cr);
        }
        validatedRatings = characterRatings;
        const charTotal = characterRatings.reduce((sum: number, cr: any) => sum + cr.initial + cr.final + cr.tone, 0);
        const charScore = charTotal / (characterRatings.length * 3);
        if (validatedFluency !== null) {
          const fluencyPct = validatedFluency * 20;
          overallScore = Math.round(charScore * 0.8 + fluencyPct * 0.2);
        } else {
          overallScore = Math.round(charScore);
        }
      }

      const feedbackRecord = await storage.createFeedback({
        recordingId,
        reviewerId,
        textFeedback: textFeedback || "",
        corrections: corrections || null,
        audioFeedbackUrl: audioFeedbackUrl || null,
        rating: null,
        characterRatings: validatedRatings,
        fluencyScore: validatedFluency,
        overallScore,
        isAiFeedback: false,
      });

      // Notify learner (fire-and-forget)
      Promise.resolve().then(async () => {
        try {
          const rec = await storage.getRecording(recordingId);
          if (rec) {
            const learner = await storage.getUser(rec.userId);
            if (learner?.emailNotifications && learner.email) {
              await sendFeedbackNotification(learner, rec);
            }
          }
        } catch (err) {
          console.error("[email] Error sending feedback notification:", err);
        }
      });

      res.status(201).json(feedbackRecord);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
        return;
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Retroactive AI review
  app.post("/api/recordings/:id/ai-review", isAuthenticated, async (req, res) => {
    try {
      const recordingId = Number(req.params.id);
      const userId = (req.user as any).claims.sub;

      const recording = await storage.getRecording(recordingId);
      if (!recording) {
        return res.status(404).json({ message: "Recording not found" });
      }
      if (recording.userId !== userId) {
        return res.status(403).json({ message: "You can only request AI review for your own recordings" });
      }

      const iseResult = await scoreMandarin(recording.audioUrl, recording.sentenceText);
      const fb = await storage.createFeedback({
        recordingId: recording.id,
        reviewerId: "iflytek-ai",
        textFeedback: "Automatic pronunciation assessment.",
        characterRatings: iseResult.characterRatings,
        fluencyScore: iseResult.fluencyScore,
        overallScore: iseResult.overallScore,
        speechSuperScores: iseResult.speechSuperScores,
        isAiFeedback: true,
      });

      console.log(`[SpeechSuper] Retroactive review complete for recording ${recording.id}, score=${iseResult.overallScore}`);
      res.status(201).json(fb);
    } catch (err) {
      console.error("[SpeechSuper] Retroactive review failed:", err);
      res.status(500).json({ message: "AI review failed. Please try again." });
    }
  });

  // Update feedback
  app.patch("/api/feedback/:id", isAuthenticated, async (req, res) => {
    try {
      const feedbackId = Number(req.params.id);
      const reviewerId = (req.user as any).claims.sub;

      const existing = await storage.getFeedback(feedbackId);
      if (!existing) return res.status(404).json({ message: "Feedback not found" });
      if (existing.reviewerId !== reviewerId) return res.status(403).json({ message: "You can only edit your own feedback" });

      const { textFeedback, corrections, audioFeedbackUrl, characterRatings, fluencyScore } = req.body;

      let overallScore: number | null = existing.overallScore;
      let validatedRatings: any = undefined;
      let validatedFluency: number | null | undefined = undefined;

      if (fluencyScore !== undefined) {
        if (fluencyScore === null) {
          validatedFluency = null;
        } else {
          const f = Number(fluencyScore);
          if (!Number.isInteger(f) || f < 1 || f > 5) {
            return res.status(400).json({ message: "Fluency score must be an integer from 1 to 5" });
          }
          validatedFluency = f;
        }
      }

      if (characterRatings !== undefined) {
        if (characterRatings && Array.isArray(characterRatings) && characterRatings.length > 0) {
          const { characterRatingSchema } = await import("@shared/schema");
          for (const cr of characterRatings) {
            characterRatingSchema.parse(cr);
          }
          validatedRatings = characterRatings;
        } else {
          validatedRatings = null;
        }
      }

      const effectiveRatings = validatedRatings !== undefined ? validatedRatings : (existing.characterRatings || null);
      const effectiveFluency = validatedFluency !== undefined ? validatedFluency : (existing.fluencyScore ?? null);

      if (effectiveRatings && Array.isArray(effectiveRatings) && effectiveRatings.length > 0) {
        const charTotal = effectiveRatings.reduce((sum: number, cr: any) => sum + cr.initial + cr.final + cr.tone, 0);
        const charScore = charTotal / (effectiveRatings.length * 3);
        if (effectiveFluency !== null) {
          overallScore = Math.round(charScore * 0.8 + (effectiveFluency * 20) * 0.2);
        } else {
          overallScore = Math.round(charScore);
        }
      } else {
        overallScore = null;
      }

      const updateData: any = {};
      if (textFeedback !== undefined) updateData.textFeedback = textFeedback;
      if (corrections !== undefined) updateData.corrections = corrections || null;
      if (audioFeedbackUrl !== undefined) updateData.audioFeedbackUrl = audioFeedbackUrl;
      if (validatedRatings !== undefined) updateData.characterRatings = validatedRatings;
      if (validatedFluency !== undefined) updateData.fluencyScore = validatedFluency;
      updateData.overallScore = overallScore;

      const updated = await storage.updateFeedback(feedbackId, updateData);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      console.error("Error updating feedback:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete feedback
  app.delete("/api/feedback/:id", isAuthenticated, async (req, res) => {
    try {
      const feedbackId = Number(req.params.id);
      const reviewerId = (req.user as any).claims.sub;

      const existing = await storage.getFeedback(feedbackId);
      if (!existing) return res.status(404).json({ message: "Feedback not found" });
      if (existing.reviewerId !== reviewerId) return res.status(403).json({ message: "You can only delete your own feedback" });

      const deleted = await storage.deleteFeedback(feedbackId);
      if (!deleted) return res.status(500).json({ message: "Failed to delete feedback" });

      res.json({ message: "Feedback deleted" });
    } catch (err) {
      console.error("Error deleting feedback:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === User Profile ===

  const profileUpdateSchema = z.object({
    chineseLevel: z.string().max(100).optional(),
    nativeLanguage: z.string().max(100).optional(),
    focusAreas: z.array(z.string()).optional(),
    city: z.string().max(100).optional(),
    teachingExperience: z.number().int().min(0).max(100).optional(),
    dialects: z.array(z.string()).optional(),
    emailNotifications: z.boolean().optional(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    profileImageUrl: z.string().max(500).optional(),
  });

  app.patch("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const parsed = profileUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const updatedUser = await authStorage.upsertUser({
        id: userId,
        ...parsed.data,
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // === Stripe Subscription Routes ===

  app.get("/api/stripe/publishable-key", async (_req, res) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ message: "Payment system unavailable" });
    }
  });

  // Subscription checkout
  app.post("/api/stripe/subscribe", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const { plan } = req.body;

      const planConfig = SUBSCRIPTION_PLANS.find(p => p.id === plan);
      if (!planConfig) {
        return res.status(400).json({ message: "Invalid plan. Choose 'monthly' or 'yearly'." });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const stripe = await getUncachableStripeClient();

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          metadata: { userId: user.id },
        });
        customerId = customer.id;
        await authStorage.upsertUser({ id: userId, stripeCustomerId: customerId });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(planConfig.priceUsd * 100),
            recurring: { interval: planConfig.interval },
            product_data: {
              name: `Marlow Pro — ${planConfig.label}`,
              description: `Unlimited recordings, error insights, and practice list`,
            },
          },
          quantity: 1,
        }],
        mode: 'subscription',
        success_url: `${baseUrl}/checkout/success?plan=${plan}`,
        cancel_url: `${baseUrl}/profile?tab=subscription`,
        subscription_data: {
          metadata: { userId: user.id, plan },
        },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating subscription session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
    }
  });

  // Customer portal (manage / cancel subscription)
  app.post("/api/stripe/portal", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.stripeCustomerId) {
        return res.status(400).json({ message: "No subscription found" });
      }

      const stripe = await getUncachableStripeClient();
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const session = await stripe.billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${baseUrl}/profile?tab=subscription`,
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating portal session:", error);
      res.status(500).json({ message: "Failed to open billing portal" });
    }
  });

  // Cancel subscription at period end
  app.post("/api/stripe/cancel", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: true });
      await storage.updateUserSubscription(userId, {
        subscriptionTier: "pro",
        subscriptionStatus: "canceling",
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscriptionPeriodEnd: user.subscriptionPeriodEnd ?? null,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "Failed to cancel subscription" });
    }
  });

  // Reactivate (undo cancel_at_period_end)
  app.post("/api/stripe/reactivate", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.stripeSubscriptionId) {
        return res.status(400).json({ message: "No subscription found" });
      }
      const stripe = await getUncachableStripeClient();
      await stripe.subscriptions.update(user.stripeSubscriptionId, { cancel_at_period_end: false });
      await storage.updateUserSubscription(userId, {
        subscriptionTier: "pro",
        subscriptionStatus: "active",
        stripeSubscriptionId: user.stripeSubscriptionId,
        subscriptionPeriodEnd: user.subscriptionPeriodEnd ?? null,
      });
      res.json({ ok: true });
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "Failed to reactivate subscription" });
    }
  });

  // === Pronunciation Errors ===

  app.get("/api/errors", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      if (category && !["tone", "initial", "final"].includes(category)) {
        return res.status(400).json({ message: "Invalid category. Must be tone, initial, or final." });
      }
      const errors = await storage.getErrors(category);
      res.json(errors);
    } catch (error) {
      console.error("Error getting pronunciation errors:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/errors/:id", async (req, res) => {
    try {
      const found = await storage.getError(String(req.params.id));
      if (!found) return res.status(404).json({ message: "Error not found" });
      res.json(found);
    } catch (err) {
      console.error("Error getting pronunciation error:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  const createErrorSchema = z.object({
    category: z.enum(["tone", "initial", "final"]),
    commonError: z.string().min(1).max(200),
    simpleExplanation: z.string().max(500).optional(),
    howToFix: z.string().max(1000).optional(),
    practiceWords: z.array(z.string()).max(20).optional(),
  });

  app.post("/api/errors", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer") {
        return res.status(403).json({ message: "Reviewers only" });
      }

      const parsed = createErrorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const { category, ...rest } = parsed.data;
      const prefix = category === "tone" ? "T" : category === "initial" ? "I" : "F";

      const existing = await storage.getErrors(category);
      const customIds = existing
        .map(e => parseInt(e.id.slice(1)))
        .filter(n => !isNaN(n));
      const nextNum = customIds.length > 0 ? Math.max(...customIds) + 1 : 1;
      const newId = `${prefix}${String(nextNum).padStart(3, "0")}`;

      const created = await storage.createError({
        id: newId,
        category,
        createdBy: userId,
        ...rest,
      });

      res.status(201).json(created);
    } catch (error) {
      console.error("Error creating pronunciation error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Practice List ===

  app.get("/api/practice-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const items = await storage.getPracticeList(userId);
      res.json(items);
    } catch (err) {
      console.error("Error getting practice list:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/practice-list", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const userEmail = (req.user as any).claims.email;
      const { errorId, character, recordingId } = req.body;

      if (!errorId || typeof errorId !== "string") {
        return res.status(400).json({ message: "errorId is required" });
      }

      const dbUser = await storage.getUser(userId);
      const isPro = isProUser(dbUser, userEmail);

      if (!isPro) {
        const currentCount = await storage.getPracticeListCount(userId);
        // Allow if already in list (upsert)
        const alreadyIn = await storage.isPracticeListItem(userId, errorId);
        if (!alreadyIn && currentCount >= FREE_PRACTICE_LIST_MAX) {
          return res.status(403).json({
            message: `Free accounts can only save ${FREE_PRACTICE_LIST_MAX} errors to your Practice List. Upgrade to Pro for unlimited.`,
            code: "PRACTICE_LIST_LIMIT",
          });
        }
      }

      const item = await storage.addToPracticeList(userId, errorId, character || undefined, recordingId ? Number(recordingId) : undefined);
      res.status(201).json(item);
    } catch (err) {
      console.error("Error adding to practice list:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.delete("/api/practice-list/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const id = parseInt(req.params.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid id" });
      const ok = await storage.removeFromPracticeList(id, userId);
      if (!ok) return res.status(404).json({ message: "Item not found" });
      res.json({ message: "Removed" });
    } catch (err) {
      console.error("Error removing from practice list:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // === Phrase Audio ===

  app.post("/api/phrase-audio/generate", isAuthenticated, async (req, res) => {
    try {
      const { text, gender } = req.body;
      if (!text || typeof text !== "string" || text.length > 100) {
        return res.status(400).json({ message: "Invalid text" });
      }
      const resolvedGender: "M" | "F" = gender === "F" ? "F" : "M";
      const audioUrl = await generatePhraseAudio(text, resolvedGender);
      res.json({ audioUrl });
    } catch (error) {
      console.error("Error generating phrase audio:", error);
      res.status(500).json({ message: "Failed to generate audio" });
    }
  });

  app.get("/api/phrase-audio/:hash", async (req, res) => {
    try {
      const { hash } = req.params;
      if (!/^[a-f0-9]{12}$/.test(hash)) {
        return res.status(400).json({ message: "Invalid hash" });
      }
      const file = await getPhraseAudioFile(hash);
      if (!file) {
        return res.status(404).json({ message: "Audio not found" });
      }
      const [metadata] = await file.getMetadata();
      const size = Number(metadata.size);
      res.writeHead(200, {
        "Content-Type": "audio/mpeg",
        "Content-Length": size,
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      });
      file.createReadStream().pipe(res);
    } catch (error) {
      console.error("Error serving phrase audio:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to serve audio" });
      }
    }
  });

  // === Support Contact ===

  const supportContactSchema = z.object({
    category: z.enum(["Technical Issue", "Bug Report", "Feature Request", "Billing Question", "Other"]),
    message: z.string().min(10, "Message must be at least 10 characters").max(2000, "Message must be 2000 characters or fewer"),
  });

  app.post("/api/support/contact", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const parsed = supportContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0].message });
      }

      const sender = await storage.getUser(userId);
      if (!sender) {
        return res.status(404).json({ message: "User not found" });
      }

      // Persist ticket first — this is the source of truth
      const ticket = await storage.createSupportTicket(userId, parsed.data.category, parsed.data.message);

      // Send email notifications to reviewers (fire-and-forget; ticket is already saved)
      Promise.resolve().then(async () => {
        try {
          const reviewers = await storage.getAllReviewersWithEmail();
          await Promise.allSettled(
            reviewers.map(reviewer =>
              sendSupportEmail({
                sender: sender!,
                category: parsed.data.category,
                message: parsed.data.message,
                reviewerEmail: reviewer.email!,
              })
            )
          );
        } catch (err) {
          console.error("[support] Error sending support email notifications:", err);
        }
      });

      res.json({ success: true, ticketId: ticket.id });
    } catch (error) {
      console.error("Error creating support ticket:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/support/tickets", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer") {
        return res.status(403).json({ message: "Reviewers only" });
      }
      const tickets = await storage.listSupportTickets();
      res.json(tickets);
    } catch (error) {
      console.error("Error listing support tickets:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/support/tickets/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer") {
        return res.status(403).json({ message: "Reviewers only" });
      }
      const ticketId = Number(req.params.id);
      if (!ticketId) return res.status(400).json({ message: "Invalid ticket ID" });
      const updated = await storage.resolveSupportTicket(ticketId, userId);
      if (!updated) return res.status(404).json({ message: "Ticket not found" });
      res.json(updated);
    } catch (error) {
      console.error("Error resolving support ticket:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // ─── Crossword Routes ─────────────────────────────────────────────────────

  // Filter out stale/invalid cell values: only keep single Unicode characters
  function sanitizeCells(cells: Record<string, string> | undefined | null): Record<string, string> {
    if (!cells) return {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(cells)) {
      if (typeof v === "string" && Array.from(v).length === 1) out[k] = v;
    }
    return out;
  }

  // Get today's puzzle (strips answers + chars from response)
  app.get("/api/crossword/today", isAuthenticated, async (req, res) => {
    try {
      const puzzle = await storage.getTodayCrossword();
      if (!puzzle) return res.status(404).json({ message: "No puzzle available" });

      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const puzzleDate = new Date().toISOString().slice(0, 10);
      const status = await storage.getCrosswordStatus(userId, puzzle.id, puzzleDate);

      const words = (puzzle.words as unknown) as CrosswordWord[];
      const publicWords = words.map(({ chars: _c, answer: _a, ...rest }) => rest);
      const cleanCells = sanitizeCells(status?.cells as Record<string, string>);
      const hadStaleCells = status && Object.keys(status.cells ?? {}).length > 0 && Object.keys(cleanCells).length === 0;
      const cleanStatus = status
        ? { ...status, cells: cleanCells, isComplete: hadStaleCells ? false : status.isComplete }
        : null;
      res.json({
        id: puzzle.id,
        puzzleIndex: puzzle.puzzleIndex,
        title: puzzle.title,
        grid: puzzle.grid,
        words: publicWords,
        wordCount: words.length,
        status: cleanStatus,
      });
    } catch (err) {
      console.error("Error getting crossword:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get today's progress for the current user
  app.get("/api/crossword/today/progress", isAuthenticated, async (req, res) => {
    try {
      const puzzle = await storage.getTodayCrossword();
      if (!puzzle) return res.status(404).json({ message: "No puzzle available" });
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const puzzleDate = new Date().toISOString().slice(0, 10);
      const status = await storage.getCrosswordStatus(userId, puzzle.id, puzzleDate);
      res.json(status ?? null);
    } catch (err) {
      console.error("Error getting crossword progress:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Check answers (server-side validation)
  app.post("/api/crossword/check", isAuthenticated, async (req, res) => {
    try {
      const { puzzleId, cells } = req.body as { puzzleId: number; cells: Record<string, string> };
      if (!puzzleId || !cells) return res.status(400).json({ message: "puzzleId and cells required" });

      const all = await storage.getAllCrosswords();
      const puzzle = all.find(p => p.id === puzzleId);
      if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

      const words = (puzzle.words as unknown) as CrosswordWord[];
      // Only evaluate cells the user has actually filled in (skip empty cells).
      // Compare Chinese characters (chars[]) — answers are never sent to the client.
      // Intersection cells satisfy both constraints via AND logic.
      const results: Record<string, boolean> = {};
      for (const word of words) {
        for (let i = 0; i < word.length; i++) {
          const r = word.direction === "across" ? word.startRow : word.startRow + i;
          const c = word.direction === "across" ? word.startCol + i : word.startCol;
          const key = `${r}-${c}`;
          const typed = (cells[key] ?? "").trim();
          if (!typed) continue; // skip unfilled cells
          const expected = (word.chars[i] ?? "").trim();
          const isCorrect = typed === expected;
          results[key] = results[key] === undefined ? isCorrect : results[key] && isCorrect;
        }
      }

      res.json({ results });
    } catch (err) {
      console.error("Error checking crossword:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Hint — reveal one random unfilled or wrong cell
  app.post("/api/crossword/hint", isAuthenticated, async (req, res) => {
    try {
      const { puzzleId, cells } = req.body as { puzzleId: number; cells: Record<string, string> };
      if (!puzzleId) return res.status(400).json({ message: "puzzleId required" });

      const all = await storage.getAllCrosswords();
      const puzzle = all.find(p => p.id === puzzleId);
      if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

      const words = (puzzle.words as unknown) as CrosswordWord[];
      // Build a map of cellKey → correct char
      const correctMap: Record<string, string> = {};
      for (const word of words) {
        for (let i = 0; i < word.length; i++) {
          const r = word.direction === "across" ? word.startRow : word.startRow + i;
          const c = word.direction === "across" ? word.startCol + i : word.startCol;
          const key = `${r}-${c}`;
          correctMap[key] = (word.chars[i] ?? "").trim();
        }
      }

      // Find cells that are empty or wrong
      const needHint = Object.entries(correctMap).filter(([key, correct]) => {
        const typed = (cells?.[key] ?? "").trim();
        return typed !== correct;
      });

      if (needHint.length === 0) {
        return res.status(400).json({ message: "All cells are already correct!" });
      }

      // Pick one at random
      const [key, char] = needHint[Math.floor(Math.random() * needHint.length)];
      res.json({ key, char });
    } catch (err) {
      console.error("Error getting crossword hint:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Save progress (supports both /today/progress and legacy /progress)
  const saveProgressHandler = async (req: Request, res: Response) => {
    try {
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const { puzzleId, cells, elapsedSeconds } = req.body as { puzzleId: number; cells: Record<string, string>; elapsedSeconds: number };
      if (!puzzleId || !cells) return res.status(400).json({ message: "puzzleId and cells required" });
      const puzzleDate = new Date().toISOString().slice(0, 10);
      const record = await storage.saveCrosswordProgress(userId, puzzleId, puzzleDate, sanitizeCells(cells), elapsedSeconds ?? 0);
      res.json(record);
    } catch (err) {
      console.error("Error saving crossword progress:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  };
  app.post("/api/crossword/today/progress", isAuthenticated, saveProgressHandler);
  app.post("/api/crossword/progress", isAuthenticated, saveProgressHandler);

  // Complete puzzle — server verifies all cells correct before marking isComplete=true
  app.post("/api/crossword/complete", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const { puzzleId, cells, elapsedSeconds } = req.body as { puzzleId: number; cells: Record<string, string>; elapsedSeconds: number };
      if (!puzzleId || !cells) return res.status(400).json({ message: "puzzleId and cells required" });

      const all = await storage.getAllCrosswords();
      const puzzle = all.find(p => p.id === puzzleId);
      if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

      const words = (puzzle.words as unknown) as CrosswordWord[];
      let allCorrect = true;
      for (const word of words) {
        for (let i = 0; i < word.length; i++) {
          const r = word.direction === "across" ? word.startRow : word.startRow + i;
          const c = word.direction === "across" ? word.startCol + i : word.startCol;
          const key = `${r}-${c}`;
          const typed = (cells[key] ?? "").trim();
          const expected = (word.chars[i] ?? "").trim();
          if (typed !== expected) { allCorrect = false; break; }
        }
        if (!allCorrect) break;
      }

      if (!allCorrect) {
        return res.status(400).json({ message: "Puzzle is not fully solved correctly" });
      }

      const puzzleDate = new Date().toISOString().slice(0, 10);
      const record = await storage.completeCrossword(userId, puzzleId, puzzleDate, cells, elapsedSeconds ?? 0);
      res.json(record);
    } catch (err) {
      console.error("Error completing crossword:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get a specific puzzle by puzzleIndex (strips answers + chars); optional ?date=YYYY-MM-DD for status
  app.get("/api/crossword/puzzle/:puzzleIndex", isAuthenticated, async (req, res) => {
    try {
      const puzzleIndex = Number(req.params.puzzleIndex);
      if (isNaN(puzzleIndex)) return res.status(400).json({ message: "Invalid puzzleIndex" });
      const puzzle = await storage.getCrosswordByIndex(puzzleIndex);
      if (!puzzle) return res.status(404).json({ message: "Puzzle not found" });

      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const words = (puzzle.words as unknown) as CrosswordWord[];
      const publicWords = words.map(({ chars: _c, answer: _a, ...rest }) => rest);

      // If a specific date is provided, look up the user's status for that date
      let statusData = null;
      const dateParam = req.query.date as string | undefined;
      if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
        const completion = await storage.getCrosswordStatus(userId, puzzle.id, dateParam);
        if (completion) {
          const archiveCells = sanitizeCells(completion.cells as Record<string, string>);
          const hadStale = Object.keys(completion.cells ?? {}).length > 0 && Object.keys(archiveCells).length === 0;
          statusData = {
            id: completion.id,
            cells: archiveCells,
            elapsedSeconds: completion.elapsedSeconds,
            isComplete: hadStale ? false : completion.isComplete,
            completedAt: completion.completedAt?.toISOString() ?? null,
          };
        }
      }

      res.json({
        id: puzzle.id,
        puzzleIndex: puzzle.puzzleIndex,
        title: puzzle.title,
        grid: puzzle.grid,
        words: publicWords,
        wordCount: words.length,
        status: statusData,
      });
    } catch (err) {
      console.error("Error getting crossword by index:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get archive of past 13 days of crosswords with user completion status
  app.get("/api/crossword/archive", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const archive = await storage.getArchiveCrosswords(userId);
      const result = archive.map(({ puzzle, date, isComplete }) => {
        const words = (puzzle.words as unknown) as CrosswordWord[];
        return {
          id: puzzle.id,
          puzzleIndex: puzzle.puzzleIndex,
          title: puzzle.title,
          wordCount: words.length,
          date,
          isComplete,
        };
      });
      res.json(result);
    } catch (err) {
      console.error("Error getting crossword archive:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: get all puzzles with full data
  app.get("/api/crossword/all", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer" && dbUser?.role !== "admin") return res.status(403).json({ message: "Reviewers/admins only" });
      const puzzles = await storage.getAllCrosswords();
      res.json(puzzles);
    } catch (err) {
      console.error("Error getting all crosswords:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Admin: update a puzzle
  app.put("/api/crossword/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = (req.user as { claims: { sub: string } }).claims.sub;
      const dbUser = await storage.getUser(userId);
      if (dbUser?.role !== "reviewer" && dbUser?.role !== "admin") return res.status(403).json({ message: "Reviewers/admins only" });
      const puzzleId = Number(req.params.id);
      if (!puzzleId) return res.status(400).json({ message: "Invalid puzzle ID" });
      const { grid, words, title } = req.body as { grid?: boolean[][]; words?: CrosswordWord[]; title?: string };
      const updated = await storage.updateCrossword(puzzleId, { grid, words, title });
      if (!updated) return res.status(404).json({ message: "Puzzle not found" });
      res.json(updated);
    } catch (err) {
      console.error("Error updating crossword:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
