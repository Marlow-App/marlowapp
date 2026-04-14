import { useState } from "react";
import pandaLogoImg from "@assets/chow_chow_2_1774332948261.png";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function ConsentGate() {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [ageVerified, setAgeVerified] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [privacyAgreed, setPrivacyAgreed] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);

  const allChecked = ageVerified && termsAgreed && privacyAgreed && voiceConsent;

  const handleSubmit = async () => {
    if (!allChecked) return;
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/consent", {
        consentTypes: ["age_verification", "terms_of_service", "privacy_policy", "voice_data_processing"],
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch (err) {
      toast({ title: "Error", description: "Failed to save consent. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="max-w-lg w-full" data-testid="consent-gate-card">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img src={pandaLogoImg} alt="Marlow" className="w-24 h-24 object-contain" />
          </div>
          <CardTitle className="text-2xl font-display">Welcome to Marlow</CardTitle>
          <CardDescription className="mt-2">
            Before you get started, please review and agree to the following:
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="age"
              checked={ageVerified}
              onCheckedChange={(checked) => setAgeVerified(checked === true)}
              data-testid="checkbox-age"
            />
            <label htmlFor="age" className="text-sm leading-relaxed cursor-pointer">
              I am 18 years or older
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="terms"
              checked={termsAgreed}
              onCheckedChange={(checked) => setTermsAgreed(checked === true)}
              data-testid="checkbox-terms"
            />
            <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline" target="_blank" data-testid="link-terms">
                Terms of Service
              </Link>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy"
              checked={privacyAgreed}
              onCheckedChange={(checked) => setPrivacyAgreed(checked === true)}
              data-testid="checkbox-privacy"
            />
            <label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
              I agree to the{" "}
              <Link href="/privacy-policy" className="text-primary hover:underline" target="_blank" data-testid="link-privacy">
                Privacy Policy
              </Link>
            </label>
          </div>

          <div className="flex items-start gap-3">
            <Checkbox
              id="voice"
              checked={voiceConsent}
              onCheckedChange={(checked) => setVoiceConsent(checked === true)}
              data-testid="checkbox-voice"
            />
            <label htmlFor="voice" className="text-sm leading-relaxed cursor-pointer">
              I consent to my voice recordings being stored and processed to provide feedback and improve the service, including development of internal AI systems
            </label>
          </div>

          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={!allChecked || submitting}
            data-testid="button-continue"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              "Continue"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
