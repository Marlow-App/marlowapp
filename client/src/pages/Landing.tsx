import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mic2, MessageCircle, TrendingUp, ChevronRight, RotateCcw, Star, GraduationCap, BookOpen, Zap, Check } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { SUBSCRIPTION_PLANS, FREE_RECORDINGS_PER_DAY, FREE_PRACTICE_LIST_MAX } from "@shared/credits";
import pandaLogo from "@assets/chow_chow_2_1774332948261.png";
import julesyPhoto from "@assets/IMG_4243_1774760935474.jpg";
import { SiYoutube } from "react-icons/si";

function YouTubeCard({ videoId }: { videoId: string }) {
  const [title, setTitle] = useState<string | null>(null);
  const thumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const url = `https://youtu.be/${videoId}`;

  useEffect(() => {
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      .then(r => r.json())
      .then(d => setTitle(d.title))
      .catch(() => {});
  }, [videoId]);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl overflow-hidden border border-border/50 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
      data-testid={`link-youtube-${videoId}`}
    >
      <div className="relative aspect-video bg-black">
        <img
          src={thumbnail}
          alt={title ?? "YouTube video"}
          className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#FF0000] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
      <div className="bg-card px-3 py-2 flex items-start gap-2">
        <SiYoutube className="w-4 h-4 text-[#FF0000] shrink-0 mt-0.5" />
        <p className="text-[15px] font-medium text-foreground leading-snug line-clamp-2">
          {title ?? "Loading…"}
        </p>
      </div>
    </a>
  );
}

export default function Landing() {
  const howItWorksRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLElement>(null);

  const scrollToHowItWorks = () => {
    howItWorksRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-background text-foreground overflow-x-hidden">
      {/* Navigation */}
      <nav className="p-6 md:px-12 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <img src={pandaLogo} alt="Marlow" className="w-12 h-12 object-contain" />
          <span className="font-display font-bold text-2xl tracking-tight">Marlow</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/api/switch-account" className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors hidden sm:block">
            Use a different account
          </a>
          <a href="/api/login?role=reviewer" className="text-xs text-muted-foreground hover:text-primary transition-colors">
            Reviewer Login
          </a>
          <a href="/api/login?role=learner">
            <Button variant="ghost" className="font-medium">Log In</Button>
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-8 pb-16 md:pt-16 md:pb-20 px-6 md:px-12 max-w-7xl mx-auto w-full">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl z-0"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl z-0"></div>

        <div className="grid md:grid-cols-2 gap-12 items-center relative z-10">
          <div className="space-y-8 animate-in">
            <h1 className="text-5xl md:text-7xl font-display font-bold leading-[1.1] tracking-tight text-balance">
              Master Chinese with <span className="text-primary">Real</span> Feedback
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
              Don't guess if you sound right. Marlow's feedback system — developed by linguists and native Chinese speakers — tells you exactly what to fix.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a href="/api/login?role=learner">
                <Button size="lg" className="h-14 px-8 text-lg rounded-full bg-primary hover:bg-primary/90 shadow-xl shadow-primary/30 transition-all hover:-translate-y-1">
                  Start Free
                </Button>
              </a>
              <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-2" onClick={scrollToHowItWorks} data-testid="how-it-works-btn">
                How it works
              </Button>
            </div>
          </div>

          <div className="relative animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="relative bg-card rounded-3xl shadow-2xl border border-border/50 p-6 md:p-8 transform rotate-3 hover:rotate-0 transition-transform duration-500 ease-out">
              <div className="absolute -top-6 -right-6 bg-secondary text-secondary-foreground px-4 py-2 rounded-full font-bold shadow-lg rotate-12 z-20">
                Feedback Received!
              </div>
              
              <div className="space-y-6">
                <div className="flex items-center gap-4 border-b border-border/50 pb-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Mic2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">你好，很高兴认识你</h3>
                    <div className="h-1.5 w-32 bg-gray-200 rounded-full mt-2 overflow-hidden">
                       <div className="h-full bg-primary w-2/3"></div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-muted/30 rounded-xl p-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-bold text-xs">E</div>
                    <div>
                      <p className="text-sm font-medium">Marlow</p>
                      <p className="text-foreground/80 mt-1">
                        Your "shì" in "rènshí" was a bit too high. Try dropping the pitch sharply. Listen to my recording below.
                      </p>
                      <div className="mt-3 bg-background rounded-full p-2 flex items-center gap-2 border shadow-sm w-48">
                        <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </div>
                        <div className="h-1 flex-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="w-1/3 h-full bg-primary/50"></div>
                        </div>
                        <span className="text-xs font-mono">0:04</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Walkthrough */}
      <section ref={howItWorksRef} className="py-16 px-6 md:px-12" data-testid="how-it-works-section">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">How It Works</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every recording gets detailed, character-by-character analysis from <span className="text-primary">Marlow's system</span>, developed by linguists and native Chinese speakers.
            </p>
          </div>

          <div className="space-y-16">
            {/* Step 1: Record */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-display text-lg">1</div>
                  <h3 className="text-2xl font-bold font-display">Record a Phrase</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Pick from a daily challenge matched to your level, choose from our phrase bank, or type your own sentence. Hit record and speak naturally.
                </p>
              </div>
              <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-border/30">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Mic2 className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[16px] text-muted-foreground uppercase tracking-wide font-semibold">Today's phrase</p>
                      <div className="flex items-end gap-1 mt-1">
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs text-green-500 font-medium">nǐ</span>
                          <span className="text-2xl font-bold text-green-600">你</span>
                        </span>
                        <span className="inline-flex flex-col items-center">
                          <span className="text-xs text-green-500 font-medium">hǎo</span>
                          <span className="text-2xl font-bold text-green-600">好</span>
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg">
                        <Mic2 className="w-7 h-7" />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">Tap to start recording (max 10 seconds)</p>
                </div>
              </div>
            </div>

            {/* Step 2: Tone Sandhi */}
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="order-2 md:order-1 bg-card rounded-2xl shadow-lg border border-border/50 p-6 hover:-translate-y-1 transition-transform duration-200">
                <div className="space-y-4">
                  <p className="text-[16px] font-semibold uppercase text-muted-foreground tracking-wide">Tone 3 Sandhi</p>
                  <p className="text-[16px] text-muted-foreground font-medium">Tone 3 + Tone 3 → first becomes Tone 2</p>
                  <div className="grid grid-cols-[100px_1fr] gap-x-3 gap-y-2 items-center">
                    <span className="text-muted-foreground/70 text-right text-[16px]">Dictionary</span>
                    <span className="flex gap-4">
                      <span className="flex flex-col items-center"><span className="text-[16px] font-medium text-[#3b82f6]">nǐ</span><span className="font-bold text-[26px]">你</span></span>
                      <span className="flex flex-col items-center"><span className="text-[16px] font-medium text-[#3b82f6]">hǎo</span><span className="font-bold text-[26px]">好</span></span>
                    </span>
                    <span className="text-muted-foreground/70 text-right text-[16px]">As spoken</span>
                    <span className="flex gap-4">
                      <span className="flex flex-col items-center"><span className="text-[16px] font-semibold text-amber-500">ní</span><span className="font-bold text-[26px]">你</span></span>
                      <span className="flex flex-col items-center"><span className="text-[16px] font-medium text-[#3b82f6]">hǎo</span><span className="font-bold text-[26px]">好</span></span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="order-1 md:order-2 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-display text-lg">2</div>
                  <h3 className="text-2xl font-bold font-display">We Show the Real Pronunciation</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Chinese pronunciation isn't always what the dictionary says. Marlow shows you both the dictionary tones <em>and</em> how the phrase is actually spoken.
                </p>
              </div>
            </div>

            {/* Step 3: Ratings + Corrections (merged) */}
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="order-1 md:order-1 space-y-4 md:pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-display text-lg">3</div>
                  <h3 className="text-2xl font-bold font-display">Instant Score + Explanation</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Marlow scores every character across <strong>Initial</strong>, <strong>Final</strong>, and <strong>Tone</strong>. Tap any problem character to see exactly what went wrong and how to fix it — no guessing.
                </p>
              </div>
              <div className="order-2 md:order-2 bg-card rounded-2xl shadow-lg border border-border/50 p-5 hover:-translate-y-1 transition-transform duration-200 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold uppercase text-muted-foreground tracking-wide">你好 — Overall 68%</p>
                  <span className="text-sm font-bold text-amber-600">68%</span>
                </div>

                {/* Character row — 你 only */}
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2.5">
                  <div className="flex flex-col items-center w-10 shrink-0">
                    <span className="text-xs font-medium text-blue-500">ní</span>
                    <span className="text-xl font-bold text-red-600">你</span>
                  </div>
                  <div className="flex gap-4 flex-1">
                    {[["Initial","87","text-emerald-600"],["Final","91","text-emerald-600"],["Tone","24","text-primary"]].map(([d,v,c]) => (
                      <div key={d} className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-muted-foreground">{d}</span>
                        <span className={`text-sm font-bold tabular-nums ${c}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Error detail card */}
                <div className="border border-border/60 rounded-xl p-4 space-y-2.5 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 uppercase tracking-wide">Tone</span>
                    <span className="text-xs font-mono text-muted-foreground">T001 · 你</span>
                  </div>
                  <p className="text-sm font-bold leading-snug">Tone 3 sandhi</p>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">What's happening</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">你好 is two Tone 3s — the first must rise (Tone 2). Yours dipped instead.</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-primary mb-1">How to fix it</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">Rise on 你, then fall on 好. Treat it as Tone 2 + Tone 3.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4: Track Progress */}
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="order-1 md:order-2 space-y-4 md:pt-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold font-display text-lg">4</div>
                  <h3 className="text-2xl font-bold font-display">Track Your Progress</h3>
                </div>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Watch your Tone, Initial, and Final scores improve over time. Marlow spots patterns and tells you exactly where to focus next.
                </p>
              </div>

              <div className="order-2 md:order-1 bg-card rounded-2xl shadow-lg border border-border/50 p-5 hover:-translate-y-1 transition-transform duration-200 space-y-4">
                {/* Mini sparkline */}
                <div>
                  <p className="text-[12px] font-semibold uppercase text-muted-foreground tracking-wide mb-2">Score over time</p>
                  <div className="relative h-16">
                    <svg viewBox="0 0 200 60" className="w-full h-full" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,48 L66,36 L133,44 L200,16" stroke="hsl(var(--primary))" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M0,48 L66,36 L133,44 L200,16 L200,60 L0,60 Z" fill="url(#chartGrad)" />
                    </svg>
                    {[[0,48],[66,36],[133,44],[200,16]].map(([x,y],i) => (
                      <div
                        key={i}
                        className="absolute w-2 h-2 rounded-full bg-primary -translate-x-1/2 -translate-y-1/2"
                        style={{ left: `${(x / 200) * 100}%`, top: `${(y / 60) * 100}%` }}
                      />
                    ))}
                    <div className="absolute bottom-0 left-0 right-0 flex justify-between px-0.5">
                      {["Jan","Apr","Jul","Oct"].map(m => (
                        <span key={m} className="text-[9px] text-muted-foreground">{m}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Pronunciation breakdown */}
                <div className="space-y-2.5">
                  <p className="text-[12px] font-semibold uppercase text-muted-foreground tracking-wide">Pronunciation Breakdown</p>
                  {[["Tone","68","bg-primary"],["Initial consonant","85","bg-emerald-500"],["Final vowel","79","bg-amber-500"]].map(([label,pct,bar]) => (
                    <div key={label} className="space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium">{label}</span>
                        <span className={`text-xs font-bold tabular-nums ${pct === "68" ? "text-primary" : pct === "85" ? "text-emerald-600" : "text-amber-600"}`}>{pct}%</span>
                      </div>
                      <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Focus card */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-800/40">
                  <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold mb-1">Focus on Tone <span className="text-orange-600 font-bold">68%</span></p>
                    <ul className="space-y-0.5">
                      <li className="text-xs text-muted-foreground flex items-start gap-1.5">
                        <span className="text-orange-400 shrink-0">·</span>
                        Tone 4 not falling sharply enough — drop from high to low in one swift motion
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center mt-16">
            <a href="/api/login?role=learner">
              <Button size="lg" className="h-14 px-10 text-lg rounded-full shadow-xl shadow-primary/30" data-testid="cta-start-recording">
                Start Recording Free
                <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 md:px-12 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Built for Real Progress</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Every feature is designed to help you improve faster and stay motivated.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-x-6 gap-y-14 mt-8">
            <div className="relative bg-card rounded-2xl border border-border/50 pt-12 px-7 pb-7 hover:shadow-lg transition-shadow hover:-translate-y-1 duration-200">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-primary flex items-center justify-center shadow-lg ring-4 ring-muted/20">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold font-display mb-3">Four Levels, Hundreds of Phrases</h3>
              <p className="text-muted-foreground leading-relaxed">
                Choose from <strong>Absolute Beginner</strong>, <strong>Beginner</strong>, <strong>Intermediate</strong>, or <strong>Advanced</strong>. Each level has hundreds of real phrases and sentences so you never run out of material to practise.
              </p>
            </div>

            <div className="relative bg-card rounded-2xl border border-border/50 pt-12 px-7 pb-7 hover:shadow-lg transition-shadow hover:-translate-y-1 duration-200">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-secondary flex items-center justify-center shadow-lg ring-4 ring-muted/20">
                <BookOpen className="w-7 h-7 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-bold font-display mb-3">Save Errors to Your Practice List</h3>
              <p className="text-muted-foreground leading-relaxed">
                When Marlow flags a mistake, save it straight to your <strong>Practice List</strong>. Drill those words on their own — and quickly spot if the same error keeps coming up.
              </p>
            </div>

            <div className="relative bg-card rounded-2xl border border-border/50 pt-12 px-7 pb-7 hover:shadow-lg transition-shadow hover:-translate-y-1 duration-200">
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg ring-4 ring-muted/20">
                <BookOpen className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold font-display mb-3">Master Mandarin's Tone Quirks</h3>
              <p className="text-muted-foreground leading-relaxed">
                Mandarin is full of tone change rules that textbooks gloss over. Marlow has built-in tips for every pattern — Tone 3 sandhi, the half-third, 不 and 一 tone changes, neutral tones, and more — so nothing catches you off guard.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section ref={pricingRef} className="py-16 px-6 md:px-12" data-testid="pricing-section">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Start free. Upgrade when you're ready to practise more.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto" data-testid="pricing-plans-grid">
            {/* Free tier */}
            <div className="bg-card rounded-2xl border border-border/60 p-7 flex flex-col gap-4" data-testid="pricing-free-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Star className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display">Free</h3>
                  <p className="text-sm text-muted-foreground">Get started, no card required</p>
                </div>
              </div>
              <div className="text-4xl font-bold font-display">$0</div>
              <ul className="space-y-2.5 text-sm">
                {[
                  `${FREE_RECORDINGS_PER_DAY} recordings per day`,
                  `3 error insights per day`,
                  `${FREE_PRACTICE_LIST_MAX} Practice List items`,
                  "Instant AI pronunciation scoring",
                  "Tone colour-coded feedback",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/api/login?role=learner" className="mt-auto">
                <Button variant="outline" className="w-full rounded-full" data-testid="pricing-start-free">
                  Start Free
                </Button>
              </a>
            </div>

            {/* Pro tier */}
            <div className="relative bg-card rounded-2xl border-2 border-primary/40 p-7 flex flex-col gap-4" data-testid="pricing-pro-card">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider px-4 py-1 rounded-full whitespace-nowrap">
                  Most Popular
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-display">Pro</h3>
                  <p className="text-sm text-muted-foreground">For serious learners</p>
                </div>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-display">$9.99</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-emerald-600 font-medium mt-0.5">Or $99.99/year — save 17%</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  "Unlimited recordings per day",
                  "Unlimited error insights",
                  "Unlimited Practice List items",
                  "Everything in Free, plus more to come",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a href="/api/login?role=learner" className="mt-auto">
                <Button className="w-full rounded-full bg-primary hover:bg-primary/90" data-testid="pricing-get-pro">
                  Get Pro
                </Button>
              </a>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground mt-6">
            No credit card required for the free plan. Cancel Pro any time.
          </p>
        </div>
      </section>

      {/* Who We Are Section */}
      <section className="py-16 px-6 md:px-12 bg-muted/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Who We Are</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Marlow was built by experts who know exactly what it takes to master Chinese tones.
            </p>
          </div>

          <div className="bg-card rounded-3xl border border-border/50 shadow-lg p-8 md:p-12 space-y-8">
            {/* Top row: photo + bio */}
            <div className="grid md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-start">
              {/* Photo + credentials */}
              <div className="flex flex-col items-center gap-4">
                <a href="http://youtube.com/@julesytooshoes" target="_blank" rel="noopener noreferrer" className="group">
                  <img
                    src={julesyPhoto}
                    alt="Julesy (Dr. Chen)"
                    className="w-40 h-40 rounded-full object-cover shadow-xl ring-4 ring-primary/20 group-hover:ring-[#FF0000]/40 transition-all"
                  />
                </a>
                <div className="text-center">
                  <h3 className="text-xl font-bold font-display">Julesy (Dr. Chen)</h3>
                  <p className="text-primary font-semibold text-sm mt-0.5">PhD in Chinese Linguistics</p>
                  <p className="text-muted-foreground text-xs mt-0.5 leading-snug">The Hong Kong Polytechnic University</p>
                  <p className="text-muted-foreground text-xs mt-0.5">Language YouTuber</p>
                </div>
              </div>

              {/* Bio + videos */}
              <div className="space-y-5">
                <p className="text-foreground/80 leading-relaxed">
                  Julesy (Dr. Chen), born in China and raised in the United States, is passionate about the Chinese language and helping people learn it. She first got her Master's in Chinese Linguistics at PolyU in Hong Kong, but loved the program so much that she later got her PhD in the same department. Since then, she's turned to YouTube to share her love for the historical, social, and scientific aspects of the language.
                </p>
                <p className="text-foreground/80 leading-relaxed">
                  With Marlow, she hopes to create a platform to help Chinese learners hone their skills by finetuning their tone issues.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <YouTubeCard videoId="eIP8yVcDZRI" />
                  <YouTubeCard videoId="UzZyc2BobYw" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-6 md:px-12">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Why Marlow works</h2>
            <p className="text-muted-foreground text-lg">Generic AI isn't enough for tonal languages. Marlow's system was built by linguists and native Chinese speakers who know the nuances.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6">
                <Mic2 className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Record Daily</h3>
              <p className="text-muted-foreground">Practice makes perfect. Submit a sentence every day to build your muscle memory.</p>
            </div>
            <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-secondary/10 rounded-xl flex items-center justify-center text-secondary mb-6">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Expert Feedback</h3>
              <p className="text-muted-foreground">Get corrections from Marlow's system — built by linguists who can explain exactly what went wrong and why.</p>
            </div>
            <div className="bg-card p-8 rounded-2xl shadow-sm border border-border/50 hover:shadow-lg transition-all duration-300">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-green-600 mb-6">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold mb-3">Track Progress</h3>
              <p className="text-muted-foreground">Watch your recordings improve over time and build a library of your spoken Chinese.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 md:px-12 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <img src={pandaLogo} alt="Marlow" className="w-[53px] h-[53px] object-contain" />
            <span className="font-display font-bold text-xl">Marlow</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-privacy">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-primary transition-colors" data-testid="link-footer-terms">Terms of Service</Link>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 Marlow. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
