import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import pandaLogo from "@assets/chow_chow_2_1774332948261.png";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-8" data-testid="link-back-home">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <img src={pandaLogo} alt="Marlow" className="w-16 h-16 object-contain" />
          <span className="font-display font-bold text-2xl tracking-tight">Marlow</span>
        </div>

        <h1 className="text-3xl font-bold font-display mb-2" data-testid="text-page-title">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Effective Date: February 28, 2026</p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-sm leading-relaxed">
          <p>
            Marlow is operated by 말로교육 주식회사 (Marlow Education Co., Ltd.) ("Company", "we", "us", "our").
          </p>
          <p>
            If you have questions about this Privacy Policy, contact: <a href="mailto:julesyexplains@gmail.com" className="text-primary hover:underline">julesyexplains@gmail.com</a>
          </p>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">1. Eligibility</h2>
            <p>This service is intended for individuals 18 years of age or older. We do not knowingly collect data from minors.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">2. Information We Collect</h2>
            <p className="mb-2">We may collect:</p>
            <h3 className="font-semibold mt-4 mb-1">Account Information</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Email address</li>
              <li>Account credentials (stored securely)</li>
            </ul>
            <h3 className="font-semibold mt-4 mb-1">Audio Recordings</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Voice recordings submitted for pronunciation feedback</li>
              <li>Associated feedback and analysis</li>
            </ul>
            <h3 className="font-semibold mt-4 mb-1">Usage Data</h3>
            <ul className="list-disc pl-6 space-y-1">
              <li>Log data</li>
              <li>Device/browser information</li>
              <li>Interaction with the platform</li>
            </ul>
            <h3 className="font-semibold mt-4 mb-1">Payment Information</h3>
            <p>If you subscribe, payments are processed by Stripe. We do not store full credit card details.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">3. How We Use Information</h2>
            <p className="mb-2">We use collected data to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide personalized tone feedback</li>
              <li>Improve pronunciation training accuracy</li>
              <li>Maintain and secure the platform</li>
              <li>Develop and improve internal tools, including potential internal AI or machine learning systems</li>
              <li>Process subscriptions and payments</li>
            </ul>
            <p className="mt-3">We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">4. Audio Data & AI Development</h2>
            <p className="mb-2">Voice recordings may be used:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide you with feedback</li>
              <li>To improve service quality</li>
              <li>To develop internal AI systems for automated feedback</li>
            </ul>
            <p className="mt-3 mb-2">If used for AI development:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Data may be anonymized where reasonably possible</li>
              <li>It will not be sold or licensed to third parties</li>
              <li>You may request deletion of your recordings at any time (see Section 7)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">5. Data Storage</h2>
            <p>Our application is hosted using Replit infrastructure. We take reasonable steps to protect your data, including:</p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Access controls</li>
              <li>Secure storage practices</li>
              <li>Limiting internal access</li>
            </ul>
            <p className="mt-3">However, no system is completely secure.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">6. Data Retention</h2>
            <p className="mb-2">We retain:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account data while your account is active</li>
              <li>Audio recordings until deleted by you or upon request</li>
            </ul>
            <p className="mt-3">If you delete your account or request deletion, we will delete or anonymize your data within a reasonable timeframe, subject to technical limitations and legal obligations.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">7. Your Rights</h2>
            <p className="mb-2">You may:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Request access to your data</li>
              <li>Request correction</li>
              <li>Request deletion</li>
              <li>Withdraw consent for audio processing</li>
            </ul>
            <p className="mt-3">To exercise these rights, email: <a href="mailto:julesyexplains@gmail.com" className="text-primary hover:underline">julesyexplains@gmail.com</a></p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">8. International Users</h2>
            <p>By using this service, you understand that your data may be processed outside your country of residence.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold font-display mt-8 mb-3">9. Changes to This Policy</h2>
            <p>We may update this Privacy Policy. Continued use of the service constitutes acceptance of updates.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
