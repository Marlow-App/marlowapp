import { Resend } from "resend";
import type { User } from "@shared/schema";
import type { Recording } from "@shared/schema";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = "Marlow <noreply@marlow.app>";

function getResend(): Resend | null {
  if (!RESEND_API_KEY) {
    return null;
  }
  return new Resend(RESEND_API_KEY);
}

async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log("[email] RESEND_API_KEY not set — skipping email to", to);
    return;
  }
  try {
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
  } catch (err) {
    console.error("[email] Failed to send email to", to, ":", err);
  }
}

export async function sendFeedbackNotification(
  learner: User,
  recording: Recording
): Promise<void> {
  if (!learner.email) return;
  const name = learner.firstName ? learner.firstName : "there";
  const subject = "You received feedback on your Marlow recording";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #c0392b;">New feedback on your recording</h2>
      <p>Hi ${name},</p>
      <p>A reviewer has left feedback on your recording of <strong>${recording.sentenceText}</strong>.</p>
      <p>Log in to Marlow to see the detailed breakdown and tips.</p>
      <p style="margin-top: 32px;">
        <a href="https://marlow.app" style="background: #c0392b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          View Feedback
        </a>
      </p>
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        You're receiving this because you have email notifications enabled in your Marlow Settings.
        You can turn them off at any time from your Profile page.
      </p>
    </div>
  `;
  await sendEmail({ to: learner.email, subject, html });
}

export async function sendSupportEmail({
  sender,
  category,
  message,
  reviewerEmail,
}: {
  sender: User;
  category: string;
  message: string;
  reviewerEmail: string;
}): Promise<void> {
  const resend = getResend();
  if (!resend) {
    throw new Error("RESEND_API_KEY is not configured — cannot send support email");
  }
  const senderName = [sender.firstName, sender.lastName].filter(Boolean).join(" ") || "Unknown user";
  const senderEmail = sender.email ?? "No email on file";
  const subject = `[Marlow Support] ${category} from ${senderName}`;
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #c0392b;">New support message</h2>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">From</td>
          <td style="padding: 6px 0;">${senderName} &lt;${senderEmail}&gt;</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px 6px 0; font-weight: 600; white-space: nowrap; vertical-align: top;">Category</td>
          <td style="padding: 6px 0;">${category}</td>
        </tr>
      </table>
      <div style="background: #f5f5f5; border-radius: 8px; padding: 16px 20px; white-space: pre-wrap; font-size: 15px; line-height: 1.6;">${message}</div>
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        Sent via the Marlow in-app support form. Reply directly to the user's email address above.
      </p>
    </div>
  `;
  await resend.emails.send({ from: FROM_ADDRESS, to: reviewerEmail, subject, html });
}

export async function sendRecordingNotification(
  reviewer: User,
  recording: Recording,
  learner: User | null
): Promise<void> {
  if (!reviewer.email) return;
  const name = reviewer.firstName ? reviewer.firstName : "there";
  const learnerName = learner?.firstName ?? "A learner";
  const subject = "New recording ready for review on Marlow";
  const html = `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="color: #c0392b;">New recording to review</h2>
      <p>Hi ${name},</p>
      <p>${learnerName} has submitted a new recording of <strong>${recording.sentenceText}</strong>.</p>
      <p>Log in to Marlow to listen and leave feedback.</p>
      <p style="margin-top: 32px;">
        <a href="https://marlow.app/reviewer-hub" style="background: #c0392b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Go to Reviewer Hub
        </a>
      </p>
      <p style="margin-top: 32px; font-size: 12px; color: #888;">
        You're receiving this because you have email notifications enabled in your Marlow Settings.
        You can turn them off at any time from your Profile page.
      </p>
    </div>
  `;
  await sendEmail({ to: reviewer.email, subject, html });
}
