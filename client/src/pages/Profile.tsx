import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { useUpload } from "@/hooks/use-upload";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, Zap, Shield, ExternalLink, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { NATIVE_LANGUAGES, FOCUS_AREA_OPTIONS } from "@/pages/Onboarding";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useDisplayPrefs } from "@/hooks/use-display-prefs";
import { SUBSCRIPTION_PLANS, FREE_RECORDINGS_PER_DAY, FREE_PRACTICE_LIST_MAX, FREE_ERROR_POPUPS_PER_DAY } from "@shared/credits";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/use-subscription";
import { format } from "date-fns";

const CHINESE_LEVELS = [
  "Absolute Beginner",
  "Beginner",
  "Intermediate",
  "Advanced"
];

const DIALECTS = [
  "Mandarin",
  "Wu (Shanghainese)",
  "Yue (Cantonese)",
  "Min",
  "Jin",
  "Xiang",
  "Hakka",
  "Gan",
  "Huizhou",
  "Pinghua"
];

const CITIES = [
  "Beijing", "Changchun", "Changsha", "Changzhou", "Chengdu", "Chongqing", "Dalian", "Dongguan", "Foshan", "Fuzhou",
  "Guangzhou", "Guiyang", "Haikou", "Hangzhou", "Harbin", "Hefei", "Hohhot", "Huizhou", "Jiaxing", "Jinan",
  "Jinhua", "Kunming", "Lanzhou", "Lhasa", "Linyi", "Nanchang", "Nanjing", "Nanning", "Nantong", "Ningbo",
  "Qingdao", "Quanzhou", "Shaoxing", "Shanghai", "Shenyang", "Shenzhen", "Shijiazhuang", "Suzhou", "Taiyuan", "Taizhou",
  "Tangshan", "Tianjin", "Urumqi", "Weifang", "Wenzhou", "Wuhan", "Wuxi", "Xi'an", "Xiamen", "Xining",
  "Xuzhou", "Yantai", "Yinchuan", "Zhengzhou", "Zhongshan", "Zhuhai"
];

function sortedJson(arr: string[]) {
  return JSON.stringify([...arr].sort());
}

export default function Profile() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { uploadFile, isUploading } = useUpload();
  const { showPinyin, showSandhi, showTips, setShowPinyin, setShowSandhi, setShowTips } = useDisplayPrefs();
  const { data: subscription } = useSubscription();

  const [activeTab, setActiveTab] = useState<string>("profile");
  const [formData, setFormData] = useState({
    firstName: user?.firstName || "",
    lastName: user?.lastName || "",
    profileImageUrl: user?.profileImageUrl || "",
    chineseLevel: user?.chineseLevel || "",
    nativeLanguage: user?.nativeLanguage || "",
    focusAreas: user?.focusAreas || [] as string[],
    city: user?.city || "",
    teachingExperience: user?.teachingExperience || 0,
    dialects: user?.dialects || [] as string[]
  });

  const [cityOpen, setCityOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [reactivateLoading, setReactivateLoading] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState<boolean>((user as any)?.emailNotifications ?? false);
  const [supportCategory, setSupportCategory] = useState<string>("");
  const [supportMessage, setSupportMessage] = useState<string>("");
  const chineseLevelRef = useRef<HTMLDivElement>(null);
  const [highlightLevel, setHighlightLevel] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "settings" || tab === "subscription") {
      setActiveTab(tab);
    } else if (params.get("highlight") === "chineseLevel") {
      setActiveTab("profile");
      setHighlightLevel(true);
      setTimeout(() => {
        chineseLevelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
      setTimeout(() => setHighlightLevel(false), 4000);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        profileImageUrl: user.profileImageUrl || "",
        chineseLevel: user.chineseLevel || "",
        nativeLanguage: user.nativeLanguage || "",
        focusAreas: user.focusAreas || [],
        city: user.city || "",
        teachingExperience: user.teachingExperience || 0,
        dialects: user.dialects || []
      });
      setEmailNotifications((user as any).emailNotifications ?? false);
    }
  }, [user]);

  async function handleEmailNotificationsChange(enabled: boolean) {
    setEmailNotifications(enabled);
    try {
      await apiRequest("PATCH", "/api/auth/user", { emailNotifications: enabled });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      setEmailNotifications(!enabled);
      toast({ title: "Failed to update email notification setting", variant: "destructive" });
    }
  }

  const sendSupportMutation = useMutation({
    mutationFn: (data: { category: string; message: string }) =>
      apiRequest("POST", "/api/support/contact", data),
    onSuccess: () => {
      setSupportCategory("");
      setSupportMessage("");
      toast({ title: "Support ticket submitted", description: "Your message has been logged. A reviewer will follow up with you." });
    },
    onError: () => {
      toast({ title: "Failed to send message", description: "Please try again.", variant: "destructive" });
    },
  });

  const isDirty = user ? (
    formData.firstName !== (user.firstName || "") ||
    formData.lastName !== (user.lastName || "") ||
    formData.profileImageUrl !== (user.profileImageUrl || "") ||
    formData.chineseLevel !== (user.chineseLevel || "") ||
    formData.nativeLanguage !== (user.nativeLanguage || "") ||
    formData.city !== (user.city || "") ||
    formData.teachingExperience !== (user.teachingExperience || 0) ||
    sortedJson(formData.focusAreas) !== sortedJson(user.focusAreas || []) ||
    sortedJson(formData.dialects) !== sortedJson(user.dialects || [])
  ) : false;

  const handleDiscard = () => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        profileImageUrl: user.profileImageUrl || "",
        chineseLevel: user.chineseLevel || "",
        nativeLanguage: user.nativeLanguage || "",
        focusAreas: user.focusAreas || [],
        city: user.city || "",
        teachingExperience: user.teachingExperience || 0,
        dialects: user.dialects || []
      });
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFile(file);
      if (res) {
        setFormData(prev => ({ ...prev, profileImageUrl: res.objectPath }));
        toast({ title: "Photo uploaded", description: "Save profile to keep changes." });
      }
    } catch (err) {
      toast({ title: "Upload failed", description: "Please try again.", variant: "destructive" });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await apiRequest("PATCH", "/api/auth/user", formData);
      const updatedUser = await res.json();
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (err) {
      toast({ title: "Save failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setSubscribeLoading(planId);
    try {
      const res = await apiRequest("POST", "/api/stripe/subscribe", { plan: planId });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Checkout failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setSubscribeLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const res = await apiRequest("POST", "/api/stripe/portal", {});
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      toast({ title: "Failed to open billing portal", description: "Please try again.", variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCancelLoading(true);
    try {
      await apiRequest("POST", "/api/stripe/cancel", {});
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({ title: "Subscription cancelled", description: "You'll keep Pro access until the end of your billing period." });
    } catch {
      toast({ title: "Couldn't cancel", description: "Please try again.", variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleReactivateSubscription = async () => {
    setReactivateLoading(true);
    try {
      await apiRequest("POST", "/api/stripe/reactivate", {});
      await queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      toast({ title: "Subscription reactivated", description: "Your Pro plan will continue as normal." });
    } catch {
      toast({ title: "Couldn't reactivate", description: "Please try again.", variant: "destructive" });
    } finally {
      setReactivateLoading(false);
    }
  };

  const isReviewer = user?.role === "reviewer";
  const isCanceling = subscription?.status === "canceling";
  const isPro = subscription?.tier === "pro" && (subscription?.status === "active" || isCanceling || !!subscription?.isUnlimited);
  const isUnlimited = !!subscription?.isUnlimited;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6 animate-in pb-24">
        <h1 className="text-3xl font-bold font-display">Your Profile</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full ${isReviewer ? "grid-cols-2" : "grid-cols-3"}`}>
            <TabsTrigger value="profile" data-testid="tab-profile">Profile</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            {!isReviewer && <TabsTrigger value="subscription" data-testid="tab-subscription">Subscription</TabsTrigger>}
          </TabsList>

          {/* ── Profile Tab ── */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>Click any field to edit it.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col md:flex-row items-center gap-6 pb-6 border-b border-border/50">
                  <div className="relative group cursor-pointer">
                    <Avatar className="w-24 h-24 border-4 border-primary/10">
                      <AvatarImage src={formData.profileImageUrl} />
                      <AvatarFallback className="text-2xl font-bold bg-primary text-primary-foreground">
                        {formData.firstName?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <Label
                      htmlFor="photo-upload"
                      className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium"
                    >
                      {isUploading ? "Uploading..." : "Change"}
                      <Input id="photo-upload" type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} disabled={isUploading} />
                    </Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 w-full">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={formData.firstName}
                        onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={formData.lastName}
                        onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {!isReviewer ? (
                  <div className="space-y-6 pt-4">
                    <div
                      ref={chineseLevelRef}
                      className={`space-y-2 rounded-lg p-3 -mx-3 transition-all duration-500 ${highlightLevel ? "bg-primary/10 ring-2 ring-primary/40 animate-pulse" : ""}`}
                    >
                      <Label className={highlightLevel ? "text-primary font-bold" : ""}>Chinese Level</Label>
                      <Select
                        value={formData.chineseLevel}
                        onValueChange={v => setFormData(p => ({ ...p, chineseLevel: v }))}
                      >
                        <SelectTrigger className={highlightLevel ? "border-primary ring-1 ring-primary/30" : ""}>
                          <SelectValue placeholder="Select your level" />
                        </SelectTrigger>
                        <SelectContent>
                          {CHINESE_LEVELS.map(level => (
                            <SelectItem key={level} value={level}>{level}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Native Language</Label>
                      <Select
                        value={formData.nativeLanguage}
                        onValueChange={v => setFormData(p => ({ ...p, nativeLanguage: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select your native language" />
                        </SelectTrigger>
                        <SelectContent>
                          {NATIVE_LANGUAGES.map(lang => (
                            <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label>Focus Areas</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {FOCUS_AREA_OPTIONS.map(area => (
                          <div key={area.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={`focus-${area.value}`}
                              checked={formData.focusAreas.includes(area.value)}
                              onCheckedChange={(checked) => {
                                setFormData(prev => {
                                  const focusAreas = checked
                                    ? [...prev.focusAreas, area.value]
                                    : prev.focusAreas.filter(v => v !== area.value);
                                  return { ...prev, focusAreas };
                                });
                              }}
                            />
                            <Label htmlFor={`focus-${area.value}`} className="text-sm font-normal cursor-pointer">
                              {area.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6 pt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label>Hometown City</Label>
                        <Popover open={cityOpen} onOpenChange={setCityOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={cityOpen}
                              className="w-full justify-between"
                            >
                              {formData.city || "Select city..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search city..." />
                              <CommandList>
                                <CommandEmpty>No city found.</CommandEmpty>
                                <CommandGroup>
                                  {CITIES.map((city) => (
                                    <CommandItem
                                      key={city}
                                      value={city}
                                      onSelect={(currentValue) => {
                                        setFormData(p => ({ ...p, city: currentValue }));
                                        setCityOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.city === city ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {city}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="experience">Teaching Experience (Years)</Label>
                        <Input
                          id="experience"
                          type="number"
                          min="0"
                          value={formData.teachingExperience}
                          onChange={e => setFormData(p => ({ ...p, teachingExperience: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label>Dialects Spoken</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border rounded-lg p-4 bg-muted/20">
                        {DIALECTS.map(dialect => (
                          <div key={dialect} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dialect-${dialect}`}
                              checked={formData.dialects.includes(dialect)}
                              onCheckedChange={(checked) => {
                                setFormData(prev => {
                                  const dialects = checked
                                    ? [...prev.dialects, dialect]
                                    : prev.dialects.filter(d => d !== dialect);
                                  return { ...prev, dialects };
                                });
                              }}
                            />
                            <Label htmlFor={`dialect-${dialect}`} className="text-sm font-normal cursor-pointer">
                              {dialect}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Settings Tab ── */}
          <TabsContent value="settings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Display Settings</CardTitle>
                <CardDescription>Control how Chinese text is shown throughout the app.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <div className="flex items-center justify-between py-5">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="toggle-pinyin" className="text-base font-medium">Show pinyin</Label>
                    <p className="text-sm text-muted-foreground">
                      Display tone-coloured pinyin above each Chinese character on recording pages.
                    </p>
                  </div>
                  <Switch
                    id="toggle-pinyin"
                    checked={showPinyin}
                    onCheckedChange={setShowPinyin}
                    data-testid="switch-show-pinyin"
                  />
                </div>

                <div className="flex items-center justify-between py-5">
                  <div className="space-y-1 pr-4">
                    <Label
                      htmlFor="toggle-sandhi"
                      className={`text-base font-medium ${!showPinyin ? "text-muted-foreground" : ""}`}
                    >
                      Show tone sandhi
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      When tones change in natural speech (e.g. 你好 → níhǎo), show the "Original" and "As spoken" side-by-side view.
                      {!showPinyin && (
                        <span className="block mt-1 italic">Turn on pinyin to enable this option.</span>
                      )}
                    </p>
                  </div>
                  <Switch
                    id="toggle-sandhi"
                    checked={showSandhi}
                    onCheckedChange={setShowSandhi}
                    disabled={!showPinyin}
                    data-testid="switch-show-sandhi"
                  />
                </div>

                <div className="flex items-center justify-between py-5">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="toggle-tips" className="text-base font-medium">Show pronunciation tips</Label>
                    <p className="text-sm text-muted-foreground">
                      Show tone tips below each phrase — helpful hints on how to pronounce each tone correctly.
                    </p>
                  </div>
                  <Switch
                    id="toggle-tips"
                    checked={showTips}
                    onCheckedChange={setShowTips}
                    data-testid="switch-show-tips"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Choose when you'd like to receive email updates.</CardDescription>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                <div className="flex items-center justify-between py-5">
                  <div className="space-y-1 pr-4">
                    <Label htmlFor="toggle-email-notifications" className="text-base font-medium">
                      {user?.role === "reviewer"
                        ? "Email me when a new recording is submitted"
                        : "Email me when I receive feedback"}
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {user?.role === "reviewer"
                        ? "Get an email whenever a learner submits a new recording for review."
                        : "Get an email whenever a reviewer leaves feedback on one of your recordings."}
                      {!user?.email && (
                        <span className="block mt-1 italic text-amber-600">No email address is associated with your account — notifications cannot be sent.</span>
                      )}
                    </p>
                  </div>
                  <Switch
                    id="toggle-email-notifications"
                    checked={emailNotifications}
                    onCheckedChange={handleEmailNotificationsChange}
                    disabled={!user?.email}
                    data-testid="switch-email-notifications"
                  />
                </div>
              </CardContent>
            </Card>
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Contact Support</CardTitle>
                <CardDescription>Have a question or run into a problem? Send us a message and we'll get back to you.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="support-category">Category</Label>
                  <Select value={supportCategory} onValueChange={setSupportCategory}>
                    <SelectTrigger id="support-category" data-testid="select-support-category">
                      <SelectValue placeholder="What is this about?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Technical Issue">Technical Issue</SelectItem>
                      <SelectItem value="Bug Report">Bug Report</SelectItem>
                      <SelectItem value="Feature Request">Feature Request</SelectItem>
                      <SelectItem value="Billing Question">Billing Question</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="support-message">Message</Label>
                  <Textarea
                    id="support-message"
                    data-testid="textarea-support-message"
                    placeholder="Describe your issue or question in detail..."
                    className="min-h-[120px] resize-none"
                    value={supportMessage}
                    onChange={e => setSupportMessage(e.target.value)}
                    maxLength={2000}
                  />
                  <p className="text-xs text-muted-foreground text-right">{supportMessage.length}/2000</p>
                </div>
                <Button
                  data-testid="button-send-support"
                  onClick={() => sendSupportMutation.mutate({ category: supportCategory, message: supportMessage })}
                  disabled={!supportCategory || supportMessage.trim().length < 10 || sendSupportMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  {sendSupportMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</>
                  ) : (
                    <><Send className="mr-2 h-4 w-4" />Send Message</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Subscription Tab (learners only) ── */}
          {!isReviewer && (
            <TabsContent value="subscription" className="mt-6 space-y-6">
              {/* Current status card */}
              <Card className={`border-2 ${isPro ? "border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-transparent" : "border-border/60"}`} data-testid="subscription-status-card">
                <CardContent className="pt-6 pb-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isPro ? "bg-primary/10" : "bg-muted/50"}`}>
                        {isPro ? <Zap className="w-7 h-7 text-primary" /> : <Shield className="w-7 h-7 text-muted-foreground" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold font-display">{isPro ? "Pro" : "Free"}</p>
                          {isPro && !isCanceling && (
                            <Badge className="bg-primary text-primary-foreground text-xs">Active</Badge>
                          )}
                          {isCanceling && (
                            <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/40">Cancels soon</Badge>
                          )}
                        </div>
                        {isPro && subscription?.periodEnd && !isUnlimited && !isCanceling && (
                          <p className="text-sm text-muted-foreground">
                            Renews {format(new Date(subscription.periodEnd), "MMM d, yyyy")}
                          </p>
                        )}
                        {isCanceling && subscription?.periodEnd && (
                          <p className="text-sm text-muted-foreground">
                            Pro access until {format(new Date(subscription.periodEnd), "MMM d, yyyy")}
                          </p>
                        )}
                        {!isPro && (
                          <p className="text-sm text-muted-foreground">
                            {FREE_RECORDINGS_PER_DAY} recordings/day · {FREE_PRACTICE_LIST_MAX} practice items
                          </p>
                        )}
                      </div>
                    </div>
                    {isPro && isUnlimited && (
                      <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg shrink-0">Developer access</span>
                    )}
                    {isPro && !isUnlimited && (
                      <div className="flex flex-col gap-2 shrink-0">
                        {isCanceling ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={handleReactivateSubscription}
                            disabled={reactivateLoading}
                            data-testid="btn-reactivate-subscription"
                          >
                            {reactivateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reactivate"}
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleManageSubscription}
                              disabled={portalLoading}
                              data-testid="btn-manage-subscription"
                            >
                              {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Manage</span><ExternalLink className="w-3.5 h-3.5 ml-1.5" /></>}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelSubscription}
                              disabled={cancelLoading}
                              data-testid="btn-cancel-subscription"
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs"
                            >
                              {cancelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cancel plan"}
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Free tier limits */}
              {!isPro && (
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Free Plan Limits</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>Daily recordings</span>
                      <span className="font-semibold text-foreground">{FREE_RECORDINGS_PER_DAY} / day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Error insights</span>
                      <span className="font-semibold text-foreground">{FREE_ERROR_POPUPS_PER_DAY} / day</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Practice List items</span>
                      <span className="font-semibold text-foreground">{FREE_PRACTICE_LIST_MAX} total</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Plan selection (only shown for non-pro users) */}
              {!isPro && (
                <div>
                  <h2 className="text-xl font-semibold mb-3">Upgrade to Pro</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {SUBSCRIPTION_PLANS.map(plan => (
                      <Card
                        key={plan.id}
                        className={`relative border-2 transition-all ${plan.highlight === "best_value" ? "border-primary/40" : "border-border/60"}`}
                        data-testid={`plan-card-${plan.id}`}
                      >
                        {plan.highlight === "best_value" && (
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground text-xs px-3">Best Value</Badge>
                          </div>
                        )}
                        <CardContent className="pt-6 pb-5 text-center space-y-3">
                          <p className="text-base font-semibold">{plan.label}</p>
                          <div>
                            <span className="text-4xl font-bold font-display">${plan.priceUsd}</span>
                            <span className="text-muted-foreground text-sm">/{plan.interval}</span>
                          </div>
                          {plan.highlight === "best_value" && (
                            <p className="text-xs text-emerald-600 font-medium">Save ~17% vs monthly</p>
                          )}
                          <Button
                            className="w-full rounded-full"
                            variant={plan.highlight === "best_value" ? "default" : "outline"}
                            onClick={() => handleSubscribe(plan.id)}
                            disabled={!!subscribeLoading}
                            data-testid={`btn-subscribe-${plan.id}`}
                          >
                            {subscribeLoading === plan.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Subscribe"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Pro features list */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Pro Plan Includes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    "Unlimited recordings per day",
                    "Unlimited error category insights",
                    "Unlimited Practice List items",
                    "Full pronunciation breakdown per character",
                  ].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Fixed save bar */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-out ${isDirty ? "translate-y-0" : "translate-y-full"}`}
        data-testid="profile-save-bar"
      >
        <div className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t border-border shadow-lg">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">You have unsaved changes.</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                disabled={isSaving}
                data-testid="btn-discard-profile"
              >
                Discard
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                data-testid="btn-save-profile"
              >
                {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
