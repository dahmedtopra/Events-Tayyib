import { useEffect, useRef, useState } from "react";
import { fetchJSON, fetchSSE, API_BASE_URL } from "../api/client";
import { TayyibPanel } from "./TayyibPanel";
import { IntroWave } from "./IntroWave";
import AnimatedContent from "./ui/AnimatedContentReactBits";
import { ClickSpark } from "./ui/reactbits/ClickSpark";
import { StarBorder } from "./ui/reactbits/StarBorder";
import { GradualBlur } from "./ui/reactbits/GradualBlur";
import MetaBalls from "./ui/reactbits/MetaBalls";
import TextType from "./ui/reactbits/TextType";
import { ChatThread } from "./ChatThread";
import { useLang } from "../hooks/useLang";
import { useTayyibDebug } from "../hooks/useTayyibDebug";
import type { TayyibState } from "../tayyib/loops";

type FlowState =
  | "ATTRACT"
  | "LANGUAGE_PICK"
  | "INTRO_WAVE"
  | "SEARCH_READY"
  | "CHAT"
  | "FEEDBACK"
  | "RESET";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{
    title: string;
    url_or_path?: string;
    url?: string;
    snippet: string;
    relevance?: string;
    page?: number;
    page_start?: number;
    page_end?: number;
  }>;
  refinement_chips?: string[];
  route_used?: string;
  confidence?: number;
  general_mode?: boolean;
  isStreaming?: boolean;
  isFeedback?: boolean;
  feedbackGiven?: boolean;
};

const SESSION_ID_KEY = "session_id";
const SESSION_START_KEY = "session_start";
const LANG_LOCK_KEY = "kiosk_lang_locked";
const INACTIVITY_MS = 60000;

export function KioskFlow() {
  const { t, lang, setLang } = useLang();
  const { forcedState } = useTayyibDebug();

  // Flow state
  const [flow, setFlow] = useState<FlowState>(() => {
    const locked = sessionStorage.getItem(LANG_LOCK_KEY) === "1";
    return locked ? "SEARCH_READY" : "ATTRACT";
  });

  // Chat state
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastRoute, setLastRoute] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [sourcesDrawerOpen, setSourcesDrawerOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<ChatMessage["sources"]>([]);
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);

  // Logo compact animation (synced with IntroWave)
  const [logoCompacting, setLogoCompacting] = useState(false);

  // Refs
  const lastInteractionRef = useRef(Date.now());
  const abortRef = useRef<AbortController | null>(null);

  const isDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const floorPlanPdfUrl = "/assets/floorplan/Floor_Plan_EN.pdf";

  // Prevent loops - track if component is mounted
  const isMountedRef = useRef(false);

  // Initialize session
  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;

    let sid = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, sid);
      sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
  }, []);

  // Sync logo zoom-out with IntroWave (1500ms delay, same as INTRO_DURATION_MS)
  useEffect(() => {
    if (flow === "INTRO_WAVE") {
      const timer = window.setTimeout(() => setLogoCompacting(true), 1500);
      return () => window.clearTimeout(timer);
    }
    setLogoCompacting(false);
  }, [flow]);

  // Inactivity monitoring (only after language is locked)
  useEffect(() => {
    if (flow === "ATTRACT" || flow === "LANGUAGE_PICK" || flow === "INTRO_WAVE" || flow === "RESET") {
      return;
    }

    lastInteractionRef.current = Date.now();

    const handler = () => {
      lastInteractionRef.current = Date.now();
    };

    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);

    const tick = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > INACTIVITY_MS) {
        handleReset();
      }
    }, 10000);

    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.clearInterval(tick);
    };
  }, [flow]);

  const handleReset = () => {
    if (abortRef.current) abortRef.current.abort();
    setFlow("RESET");
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_START_KEY);
    sessionStorage.removeItem(LANG_LOCK_KEY);
    setQuery("");
    setMessages([]);
    setIsStreaming(false);
    setSourcesDrawerOpen(false);
    setFloorPlanOpen(false);
    setActiveSources([]);
    setTimeout(() => setFlow("ATTRACT"), 0);
  };

  const ensureLangLock = (next: "EN" | "AR" | "FR") => {
    setLang(next);
    sessionStorage.setItem(LANG_LOCK_KEY, "1");
    setFlow("INTRO_WAVE");
  };

  const handleIntroComplete = () => {
    setFlow("SEARCH_READY");
  };

  const submitChat = async (override?: string) => {
    const q = (typeof override === "string" ? override : query).trim();
    if (!q || isStreaming) return;

    setQuery("");

    // Create user message
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: q };
    // Create empty assistant message for streaming
    const assistantId = crypto.randomUUID();
    const assistantMsg: ChatMessage = { id: assistantId, role: "assistant", content: "", isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);
    setFlow("CHAT");

    // Build conversation history for the API
    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    const abort = new AbortController();
    abortRef.current = abort;

    await fetchSSE(
      "/api/chat",
      {
        lang,
        messages: history,
        session_id: sessionStorage.getItem(SESSION_ID_KEY) || "",
      },
      // onToken
      (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + token } : m))
        );
      },
      // onMeta
      (meta) => {
        const sources = (meta.sources as ChatMessage["sources"]) || [];
        const chips = (meta.refinement_chips as string[]) || [];
        const route = meta.route_used as string;
        const confidence = meta.confidence as number;
        const general = meta.general_mode as boolean | undefined;
        const isClarifier = !!meta.clarifying_question;

        const updated = (prev: ChatMessage[]) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, sources, refinement_chips: chips, route_used: route, confidence, general_mode: general, isStreaming: false }
              : m
          );

        if (isClarifier) {
          // Don't ask "was this helpful?" after a clarifying question
          setMessages(updated);
        } else {
          const feedbackMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: t.feedbackHelpQuestion,
            isFeedback: true,
          };
          setMessages((prev) => [...updated(prev), feedbackMsg]);
        }
        setLastRoute(route);
        setLastConfidence(confidence);
        setIsStreaming(false);
      },
      // onError
      (err) => {
        console.error("Chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content || t.serviceUnavailable, isStreaming: false }
              : m
          )
        );
        setIsStreaming(false);
      },
      abort.signal,
    );
  };

  const handleFeedbackThumb = async (feedbackMsgId: string, isPositive: boolean) => {
    // Mark this feedback message as answered
    setMessages((prev) =>
      prev.map((m) =>
        m.id === feedbackMsgId
          ? { ...m, feedbackGiven: true, content: isPositive ? t.feedbackMoreQuestion : t.feedbackMoreQuestion }
          : m
      )
    );

    // Submit to backend (thumbs up = 5, thumbs down = 2)
    try {
      const session_id = sessionStorage.getItem(SESSION_ID_KEY) || "";
      const start = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
      const time_on_screen_ms = Date.now() - start;
      await fetchJSON("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          session_id,
          rating_1_5: isPositive ? 5 : 2,
          time_on_screen_ms,
          last_route_used: lastRoute,
          last_confidence: lastConfidence,
        }),
      });
    } catch {
      // silent - don't disrupt chat
    }
  };

  const stateForTayyib: TayyibState = forcedState
    ? forcedState
    : flow === "INTRO_WAVE"
      ? "intro_wave"
      : flow === "CHAT" || flow === "FEEDBACK"
        ? "searching"
        : flow === "ATTRACT"
          ? "intro_wave"
          : "idle";

  // Persistent logo - zoom-out synced with IntroWave
  const logoElement = (
    <img
      src="/assets/branding/logo.png"
      alt="Logo"
      className="fixed top-8 left-8 z-[80] w-64 h-auto pointer-events-none select-none"
      style={{
        transform: logoCompacting ? "scale(0.85)" : "scale(1)",
        opacity: logoCompacting ? 0 : 1,
        transition: "transform 800ms cubic-bezier(0.4, 0, 0.2, 1), opacity 800ms cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    />
  );

  // ATTRACT Screen
  if (flow === "ATTRACT") {
    return (
      <div className="h-full w-full relative flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0b4a3a 0%, #156f58 50%, #0f5a46 100%)" }}>
        {logoElement}

        {/* Islamic geometry overlay */}
        <div className="islamic-geo" />

        {/* MetaBalls ambient layer */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ pointerEvents: "none" }}>
          <MetaBalls
            color="#156f58"
            cursorBallColor="#d4a92a"
            speed={0.15}
            ballCount={12}
            clumpFactor={0.8}
            cursorBallSize={2}
            animationSize={25}
            enableTransparency={true}
            enableMouseInteraction={false}
          />
        </div>

        {/* Premium ambient light - top glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 20%, rgba(212, 169, 42, 0.15) 0%, transparent 50%)`,
          }}
        />

        {/* Premium ambient light - center glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, transparent 60%)`,
          }}
        />

        {/* Subtle shimmer overlay for depth */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `
              linear-gradient(125deg, transparent 40%, rgba(212, 169, 42, 0.1) 50%, transparent 60%),
              radial-gradient(circle at 30% 40%, rgba(212, 169, 42, 0.06) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(47, 169, 135, 0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Vignette - darker edges for cinematic depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%)`,
          }}
        />

        <div className="relative z-10 w-full h-full flex items-center justify-center overflow-y-auto">
          <div className="w-full max-w-4xl flex flex-col items-center gap-4 text-center px-8 py-6">
            {/* Tayyib video */}
            <AnimatedContent delay={0} duration={1} distance={40} threshold={0}>
              <div className="w-full max-w-2xl h-[200px] md:h-[300px] relative">
                <div className="absolute inset-0 rounded-3xl border-2 border-gold-400/30 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm pointer-events-none" style={{ pointerEvents: "none" }} />
                <div className="relative h-full flex items-center justify-center">
                  <TayyibPanel state="intro_wave" variant="hero" />
                </div>
              </div>
            </AnimatedContent>

            {/* Purpose title */}
            <AnimatedContent delay={0.3} duration={1} distance={30} threshold={0}>
              <div className="text-xl md:text-2xl font-semibold text-gold-300 uppercase tracking-widest">
                Event Guidance
              </div>
            </AnimatedContent>

            {/* Greeting with TextType */}
            <AnimatedContent delay={0.6} duration={1} distance={30} threshold={0}>
              <TextType
                text="السلام عليكم"
                className="text-4xl md:text-5xl font-semibold text-white tracking-wide"
                typingSpeed={120}
                loop={false}
                showCursor={false}
                initialDelay={800}
              />
            </AnimatedContent>

            <AnimatedContent delay={1.2} duration={1} distance={20} threshold={0}>
              <div className="text-lg md:text-xl text-emerald-100">
                Welcome • مرحباً • Bienvenue
              </div>
            </AnimatedContent>

            {/* Purpose subtitle */}
            <AnimatedContent delay={1.5} duration={1} distance={15} threshold={0}>
              <div className="-mt-1 text-sm md:text-base text-emerald-200/80 max-w-md">
                {t.greeting}
              </div>
            </AnimatedContent>

            {/* CTA with ClickSpark */}
            <AnimatedContent delay={1.8} duration={1} distance={20} threshold={0}>
              <ClickSpark color="#d4a92a" sparkCount={12}>
                <div className="relative">
                  <div className="absolute -inset-4 rounded-full border-2 border-gold-400/40 animate-pulse" style={{ pointerEvents: "none" }} />
                  <button
                    className="relative px-12 py-5 rounded-full bg-gold-500 text-emerald-900 text-xl font-bold shadow-glow hover:bg-gold-400 transition-all hover:scale-105 active:scale-95"
                    onClick={() => setFlow("LANGUAGE_PICK")}
                    style={{ minHeight: "60px" }}
                  >
                    Tap to Begin
                  </button>
                </div>
              </ClickSpark>
            </AnimatedContent>
          </div>
        </div>
      </div>
    );
  }

  // LANGUAGE_PICK Screen
  if (flow === "LANGUAGE_PICK") {
    return (
      <div className="h-full w-full relative flex items-center justify-center overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0b4a3a 0%, #156f58 50%, #0f5a46 100%)" }}>
        {logoElement}

        {/* Islamic geometry overlay */}
        <div className="islamic-geo" />

        {/* MetaBalls ambient layer */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{ pointerEvents: "none" }}>
          <MetaBalls
            color="#156f58"
            cursorBallColor="#d4a92a"
            speed={0.15}
            ballCount={12}
            clumpFactor={0.8}
            cursorBallSize={2}
            animationSize={25}
            enableTransparency={true}
            enableMouseInteraction={false}
          />
        </div>

        {/* Premium ambient light - top glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 20%, rgba(212, 169, 42, 0.15) 0%, transparent 50%)`,
          }}
        />

        {/* Premium ambient light - center glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.08) 0%, transparent 60%)`,
          }}
        />

        {/* Subtle shimmer overlay for depth */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            background: `
              linear-gradient(125deg, transparent 40%, rgba(212, 169, 42, 0.1) 50%, transparent 60%),
              radial-gradient(circle at 30% 40%, rgba(212, 169, 42, 0.06) 0%, transparent 50%),
              radial-gradient(circle at 70% 60%, rgba(47, 169, 135, 0.06) 0%, transparent 50%)
            `,
          }}
        />

        {/* Vignette - darker edges for cinematic depth */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%)`,
          }}
        />

        <div className="relative z-10 w-full h-full flex items-center justify-center">
          <div className="w-full max-w-3xl flex flex-col items-center gap-8 text-center px-8">
            <AnimatedContent delay={0} duration={1} distance={30} threshold={0}>
              <div className="text-3xl md:text-4xl font-semibold text-white mb-4">
                {t.chooseLanguage || "Choose Your Language"}
              </div>
            </AnimatedContent>

            <AnimatedContent delay={0.3} duration={1} distance={20} threshold={0}>
              <StarBorder color="#d4a92a" starCount={30} speed={4}>
                <div className="rounded-3xl px-8 py-8 bg-white/10 backdrop-blur-md border-2 border-gold-400/30">
                  <div className="flex items-center justify-center gap-6 flex-wrap">
                    <ClickSpark color="#d4a92a">
                      <button
                        className="px-10 py-5 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-2xl font-bold hover:bg-white/30 transition-colors"
                        onClick={() => ensureLangLock("EN")}
                        style={{ minWidth: "140px", minHeight: "70px" }}
                      >
                        English
                      </button>
                    </ClickSpark>

                    <ClickSpark color="#d4a92a">
                      <button
                        className="px-10 py-5 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-2xl font-bold hover:bg-white/30 transition-colors"
                        onClick={() => ensureLangLock("AR")}
                        style={{ minWidth: "140px", minHeight: "70px" }}
                      >
                        العربية
                      </button>
                    </ClickSpark>

                    <ClickSpark color="#d4a92a">
                      <button
                        className="px-10 py-5 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-2xl font-bold hover:bg-white/30 transition-colors"
                        onClick={() => ensureLangLock("FR")}
                        style={{ minWidth: "140px", minHeight: "70px" }}
                      >
                        Français
                      </button>
                    </ClickSpark>
                  </div>
                </div>
              </StarBorder>
            </AnimatedContent>
          </div>
        </div>
      </div>
    );
  }

  // INTRO_WAVE Screen
  if (flow === "INTRO_WAVE") {
    return (
      <>
        {logoElement}
        <IntroWave onComplete={handleIntroComplete} />
      </>
    );
  }

  // SEARCH_READY / CHAT / FEEDBACK
  return (
    <div className="h-full w-full overflow-hidden flex flex-col relative"
      style={{ background: "linear-gradient(135deg, #0b4a3a 0%, #156f58 50%, #0f5a46 100%)" }}>
      {logoElement}

      {/* Islamic geometry overlay */}
      <div className="islamic-geo" />

      {/* Premium ambient light - top glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 15%, rgba(212, 169, 42, 0.12) 0%, transparent 45%)`,
        }}
      />

      {/* Premium ambient light - center subtle glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.06) 0%, transparent 55%)`,
        }}
      />

      {/* Subtle shimmer overlay for depth */}
      <div
        className="absolute inset-0 opacity-15 pointer-events-none"
        style={{
          background: `
            linear-gradient(125deg, transparent 40%, rgba(212, 169, 42, 0.08) 50%, transparent 60%),
            radial-gradient(circle at 25% 35%, rgba(212, 169, 42, 0.04) 0%, transparent 45%),
            radial-gradient(circle at 75% 65%, rgba(47, 169, 135, 0.04) 0%, transparent 45%)
          `,
        }}
      />

      {/* Vignette - darker edges for cinematic depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, transparent 35%, rgba(0, 0, 0, 0.35) 100%)`,
        }}
      />

      {/* Tayyib at top - compact in chat mode */}
      <GradualBlur duration={1200} initialBlur={15} delay={flow === "SEARCH_READY" ? 0 : 100}>
        <div className="w-full flex justify-center py-2" style={{ pointerEvents: "none" }}>
          <div className={`w-full ${flow === "CHAT" || flow === "FEEDBACK" ? "max-w-md h-[180px]" : "max-w-sm h-[200px]"} transition-all duration-500`}>
            <div className={`mx-auto h-full ${flow === "CHAT" || flow === "FEEDBACK" ? "max-w-xs p-3" : "w-full"}`}>
              <TayyibPanel state={stateForTayyib} variant="compact" />
            </div>
          </div>
        </div>
      </GradualBlur>

      {/* SEARCH_READY */}
      {flow === "SEARCH_READY" && (
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="max-w-5xl mx-auto space-y-4">
            <StarBorder color="#d4a92a" starCount={18} speed={4}>
              <section className="glass rounded-3xl p-6 flex flex-col gap-4">
                <div className="text-xs text-gold-700">{t.scopeBanner}</div>
                <div className="flex flex-col gap-3">
                  <div className="text-sm text-gray-600">{t.searchReadyPrompt}</div>
                  <div className="flex gap-3 items-center">
                    <div className="relative flex-1">
                      <svg className="search-icon absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700" width="20" height="20" viewBox="0 0 24 24" fill="none">
                        <path d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitChat()}
                        placeholder={t.searchPlaceholder}
                        className="search-input w-full rounded-3xl border border-gold-200 pl-12 pr-5 py-4 bg-white shadow-soft focus:outline-none focus:ring-2 focus:ring-emerald-400 text-base"
                        style={{ minHeight: "56px" }}
                      />
                      <div className="text-xs text-gray-500 mt-1">{t.noPersonalData}</div>
                    </div>
                    <ClickSpark color="#d4a92a" sparkCount={8}>
                      <button
                        className="min-h-[56px] px-6 rounded-2xl bg-emerald-800 text-white text-base shadow-soft active:scale-[0.98] transition-transform"
                        onClick={() => submitChat()}
                      >
                        {t.searchButton}
                      </button>
                    </ClickSpark>
                  </div>
                </div>

                {/* Quick chips */}
                <div className="flex flex-wrap gap-3">
                  {t.quickChips.map((chip) => (
                    <ClickSpark key={chip} color="#d4a92a" sparkCount={5}>
                      <button
                        className="min-h-[52px] px-6 rounded-full border border-emerald-300/70 bg-gradient-to-b from-white to-emerald-50 text-emerald-900 text-sm font-semibold shadow-[0_6px_16px_rgba(9,79,63,0.14)] transition-all hover:border-emerald-400/80 active:translate-y-[1px] active:scale-[0.99]"
                        onClick={() => setQuery(chip)}
                      >
                        {chip}
                      </button>
                    </ClickSpark>
                  ))}
                </div>

                {/* Trending */}
                <div>
                  <div className="text-sm text-gray-600 mb-2">{t.trendingTitle}</div>
                  <div className="flex flex-wrap gap-3">
                    {t.trendingQuestions.map((q) => (
                      <ClickSpark key={q} color="#d4a92a" sparkCount={5}>
                        <button
                          className="min-h-[52px] px-6 rounded-full border border-gold-300/75 bg-gradient-to-b from-white to-gold-50 text-gold-900 text-sm font-semibold shadow-[0_6px_16px_rgba(145,110,24,0.16)] transition-all hover:border-gold-400/85 active:translate-y-[1px] active:scale-[0.99]"
                          onClick={() => setQuery(q)}
                        >
                          {q}
                        </button>
                      </ClickSpark>
                    ))}
                  </div>
                </div>

                {/* Floor plan */}
                <div className="pt-1">
                  <ClickSpark color="#d4a92a" sparkCount={8}>
                    <button
                      className="min-h-[48px] px-5 rounded-2xl bg-emerald-700 text-white text-sm shadow-soft active:scale-[0.98]"
                      onClick={() => {
                        setSourcesDrawerOpen(false);
                        setFloorPlanOpen(true);
                      }}
                    >
                      {t.floorPlanButton}
                    </button>
                  </ClickSpark>
                </div>
              </section>
            </StarBorder>

            {/* Exit button */}
            <div className="flex justify-center">
              <button
                className="min-h-[44px] px-5 py-2 rounded-2xl border border-red-300/60 bg-red-50/80 text-red-700 text-sm font-medium active:scale-[0.98] transition-transform"
                onClick={handleReset}
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHAT / FEEDBACK */}
      {(flow === "CHAT" || flow === "FEEDBACK") && (
        <div className="flex-1 flex flex-col min-h-0 relative z-10">
          <ChatThread
            messages={messages}
            isStreaming={isStreaming}
            lang={lang as "EN" | "AR" | "FR"}
            onChipClick={(text) => submitChat(text)}
            onSourcesClick={(sources) => {
              setFloorPlanOpen(false);
              setActiveSources(sources);
              setSourcesDrawerOpen(true);
            }}
            onFeedbackThumb={(msgId, isPositive) => handleFeedbackThumb(msgId, isPositive)}
          />

          {/* Chat input bar */}
          <div className="px-4 py-3 border-t border-white/10">
            <div className="max-w-2xl mx-auto flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitChat()}
                  placeholder={t.chatPlaceholder}
                  className="w-full rounded-2xl border border-gold-200/60 bg-white/90 backdrop-blur-sm pl-4 pr-4 py-3 text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  style={{ minHeight: "48px" }}
                  disabled={isStreaming}
                />
              </div>
              <ClickSpark color="#d4a92a" sparkCount={6}>
                <button
                  className="min-h-[48px] px-5 rounded-2xl bg-emerald-800 text-white text-sm font-medium shadow-soft active:scale-[0.98] transition-transform disabled:opacity-50"
                  onClick={() => submitChat()}
                  disabled={isStreaming || !query.trim()}
                >
                  {t.sendButton}
                </button>
              </ClickSpark>
              <ClickSpark color="#ef4444" sparkCount={6}>
                <button
                  className="min-h-[48px] px-4 rounded-2xl border border-red-300/60 bg-red-50/80 text-red-700 text-sm font-medium active:scale-[0.98] transition-transform"
                  onClick={handleReset}
                >
                  End
                </button>
              </ClickSpark>
            </div>
          </div>
        </div>
      )}

      {/* Sources drawer */}
      {sourcesDrawerOpen && activeSources && activeSources.length > 0 && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end justify-center md:items-center md:justify-end" onClick={() => setSourcesDrawerOpen(false)}>
          <div
            className="glass w-full max-w-2xl max-h-[70vh] md:max-h-full md:h-full md:w-[480px] rounded-t-3xl md:rounded-none overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gold-200 flex items-center justify-between">
              <div className="text-lg font-semibold text-emerald-900">{t.sources} ({activeSources.length})</div>
              <button
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-600"
                onClick={() => setSourcesDrawerOpen(false)}
                style={{ minHeight: "44px" }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 sources-scroll">
              {activeSources.map((s, idx) => {
                const pageLabel = s.page_start && s.page_end ? `pp. ${s.page_start}-${s.page_end}` : s.page ? `p. ${s.page}` : "";
                const url = s.url_or_path || s.url || "";
                const isLink = typeof url === "string" && url.startsWith("http");
                return (
                  <AnimatedContent key={`${s.title}-${url}-${idx}`} delay={idx * 0.05} duration={0.4} distance={15} threshold={0}>
                    <div className="rounded-2xl border border-gold-200 p-3 bg-white hover:border-emerald-400 transition">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        {pageLabel ? <span className="px-2 py-0.5 rounded-full bg-gold-100 text-gold-800">{pageLabel}</span> : <span />}
                        <span className="text-[11px] text-emerald-800">{isLink ? t.openPdf : t.localSource}</span>
                      </div>
                      {isLink ? (
                        <a className="text-sm font-semibold text-emerald-800 underline" href={url} target="_blank" rel="noreferrer">
                          {s.title}
                        </a>
                      ) : (
                        <div className="text-sm font-semibold text-gray-800">{s.title}</div>
                      )}
                      <div className="text-xs text-gray-600 mt-1 line-clamp-2">{s.snippet}</div>
                    </div>
                  </AnimatedContent>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Floor plan drawer */}
      {floorPlanOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center md:items-center md:justify-end" onClick={() => setFloorPlanOpen(false)}>
          <div
            className="glass w-full max-w-3xl max-h-[80vh] md:max-h-full md:h-full md:w-[720px] rounded-t-3xl md:rounded-none overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gold-200 flex items-center justify-between">
              <div className="text-lg font-semibold text-emerald-900">{t.floorPlanTitle}</div>
              <button
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white hover:bg-emerald-600"
                onClick={() => setFloorPlanOpen(false)}
                style={{ minHeight: "44px" }}
              >
                Close
              </button>
            </div>
            <div className="flex-1 bg-white relative overflow-hidden">
              {/* Mask browser PDF UI to show map area only. */}
              <iframe
                title={t.floorPlanTitle}
                src={`${floorPlanPdfUrl}#page=1&zoom=page-fit&pagemode=none&toolbar=0&navpanes=0&scrollbar=0`}
                className="absolute border-0"
                style={{
                  width: "calc(100% + 260px)",
                  height: "calc(100% + 78px)",
                  left: "-210px",
                  top: "-78px",
                }}
              />
              <div className="absolute top-0 left-0 right-0 h-[78px] bg-white pointer-events-none" />
              <div className="absolute top-0 left-0 bottom-0 w-[210px] bg-white pointer-events-none" />
            </div>
            <div className="px-4 py-2 text-xs text-gray-600 border-t border-gold-200 flex items-center justify-between">
              <span>{t.floorPlanUnavailable}</span>
              <a className="text-emerald-800 underline" href={floorPlanPdfUrl} target="_blank" rel="noreferrer">
                {t.openPdf}
              </a>
            </div>
          </div>
        </div>
      )}

      {isDebug && (
        <div className="fixed top-4 right-4 z-50 glass rounded-2xl p-3 text-xs text-gray-700 space-y-1 max-w-md">
          <div className="font-bold text-emerald-800">DEBUG OVERLAY</div>
          <div>state: {flow}</div>
          <div>api: {API_BASE_URL}</div>
          <div>messages: {messages.length}</div>
          <div>streaming: {isStreaming ? "yes" : "no"}</div>
          <div>route: {lastRoute ?? "-"}</div>
          <div>confidence: {lastConfidence ?? "-"}</div>
        </div>
      )}
    </div>
  );
}

