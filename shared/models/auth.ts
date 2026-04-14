import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, text, integer, boolean, serial } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role", { enum: ["learner", "reviewer", "admin"] }).default("learner").notNull(),
  chineseLevel: text("chinese_level"),
  city: text("city"),
  teachingExperience: integer("teaching_experience"),
  dialects: text("dialects").array(),
  focusAreas: text("focus_areas").array(),
  nativeLanguage: text("native_language"),
  onboardingComplete: boolean("onboarding_complete").default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionTier: text("subscription_tier", { enum: ["free", "pro"] }).default("free").notNull(),
  subscriptionStatus: text("subscription_status"),
  subscriptionPeriodEnd: timestamp("subscription_period_end"),
  consentGiven: boolean("consent_given").default(false),
  creditBalance: integer("credit_balance").default(0).notNull(),
  freeCreditsBalance: integer("free_credits_balance").default(0).notNull(),
  lastDailyRewardAt: timestamp("last_daily_reward_at"),
  emailNotifications: boolean("email_notifications").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userConsents = pgTable("user_consents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  consentType: text("consent_type").notNull(),
  policyVersion: text("policy_version").notNull(),
  ipAddress: text("ip_address"),
  consentedAt: timestamp("consented_at").defaultNow().notNull(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserConsent = typeof userConsents.$inferSelect;
