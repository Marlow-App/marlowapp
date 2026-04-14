import { useState } from "react";
import pandaLogo from "@assets/chow_chow_2_1774332948261.png";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronRight, ChevronLeft, GraduationCap, Globe, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const STEPS = ["level", "focus", "language"] as const;
type Step = typeof STEPS[number];

const CHINESE_LEVELS = [
  { value: "Absolute Beginner", label: "Absolute Beginner", description: "No prior experience with Chinese" },
  { value: "Beginner", label: "Beginner", description: "Know some basic words and phrases" },
  { value: "Intermediate", label: "Intermediate", description: "Can hold simple conversations" },
  { value: "Advanced", label: "Advanced", description: "Comfortable with most daily interactions" },
];

export const NATIVE_LANGUAGES = [
  "Arabic", "Bengali", "Chinese (Cantonese)", "Chinese (Other dialect)",
  "Dutch", "English", "French", "German", "Greek",
  "Gujarati", "Hindi", "Indonesian", "Italian", "Japanese",
  "Javanese", "Kannada", "Korean", "Malay", "Marathi",
  "Polish", "Portuguese", "Punjabi", "Romanian",
  "Russian", "Spanish", "Tamil", "Telugu", "Thai",
  "Turkish", "Ukrainian", "Urdu", "Vietnamese",
  "OTHER",
];

export const FOCUS_AREA_OPTIONS = [
  { value: "tones", label: "Tones", description: "Master the four tones of Mandarin" },
  { value: "initials", label: "Initials (starting consonants)", description: "Nail tricky consonants like zh, ch, sh, r" },
  { value: "finals", label: "Finals (vowels and nasal endings)", description: "Perfect vowel sounds and nasal endings" },
  { value: "overall_flow", label: "Overall Flow", description: "Sound more natural and fluid when speaking" },
];

export default function Onboarding() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("level");
  const [submitting, setSubmitting] = useState(false);

  const [chineseLevel, setChineseLevel] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [focusAreas, setFocusAreas] = useState<string[]>([]);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const stepIndex = STEPS.indexOf(step);
  const canNext =
    (step === "level" && chineseLevel) ||
    (step === "focus" && focusAreas.length > 0) ||
    (step === "language" && nativeLanguage);

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setHoveredCard(null);
      setStep(STEPS[stepIndex + 1]);
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setHoveredCard(null);
      setStep(STEPS[stepIndex - 1]);
    }
  };

  const toggleFocus = (value: string) => {
    setFocusAreas(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await apiRequest("POST", "/api/onboarding", {
        chineseLevel,
        nativeLanguage,
        focusAreas,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      window.location.href = "/";
    } catch (err) {
      toast({ title: "Error", description: "Failed to save. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={pandaLogo} alt="Marlow" className="w-24 h-24 object-contain" />
        </div>

        <div className="flex justify-center gap-2 mb-8" data-testid="onboarding-progress">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i <= stepIndex ? "bg-primary w-12" : "bg-muted w-8"
              }`}
            />
          ))}
        </div>

        {step === "level" && (
          <Card data-testid="onboarding-step-level">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <GraduationCap className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-display">What's your Chinese level?</CardTitle>
              <CardDescription>This helps us pick the right phrases for you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3" onMouseLeave={() => setHoveredCard(null)}>
              {CHINESE_LEVELS.map(level => (
                <button
                  key={level.value}
                  onClick={() => setChineseLevel(level.value)}
                  onMouseEnter={() => setHoveredCard(level.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 ${
                    chineseLevel === level.value
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  } ${hoveredCard && hoveredCard !== level.value ? "opacity-40" : ""}`}
                  data-testid={`level-option-${level.value}`}
                >
                  <div className="font-medium">{level.label}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{level.description}</div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === "focus" && (
          <Card data-testid="onboarding-step-focus">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-display">What do you want to focus on?</CardTitle>
              <CardDescription>Pick one or more areas. You can change these later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3" onMouseLeave={() => setHoveredCard(null)}>
              {FOCUS_AREA_OPTIONS.map(area => (
                <button
                  key={area.value}
                  onClick={() => toggleFocus(area.value)}
                  onMouseEnter={() => setHoveredCard(area.value)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-150 flex items-center justify-between ${
                    focusAreas.includes(area.value)
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  } ${hoveredCard && hoveredCard !== area.value ? "opacity-40" : ""}`}
                  data-testid={`focus-option-${area.value}`}
                >
                  <div>
                    <div className="font-medium">{area.label}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{area.description}</div>
                  </div>
                  {focusAreas.includes(area.value) && (
                    <Badge variant="default" className="ml-3 shrink-0">Selected</Badge>
                  )}
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {step === "language" && (
          <Card data-testid="onboarding-step-language">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-display">What's your native language?</CardTitle>
              <CardDescription>We'll tailor tips to common challenges for your language background.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-1" onMouseLeave={() => setHoveredCard(null)}>
                {NATIVE_LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setNativeLanguage(lang)}
                    onMouseEnter={() => setHoveredCard(lang)}
                    className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                      nativeLanguage === lang
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/30 hover:bg-muted/50 text-foreground"
                    } ${hoveredCard && hoveredCard !== lang ? "opacity-40" : ""}`}
                    data-testid={`language-option-${lang}`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-between mt-6">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={handleBack} data-testid="onboarding-back-btn">
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step === "language" ? (
            <Button
              onClick={handleSubmit}
              disabled={!canNext || submitting}
              data-testid="onboarding-finish-btn"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                "Get Started"
              )}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={!canNext}
              data-testid="onboarding-next-btn"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
