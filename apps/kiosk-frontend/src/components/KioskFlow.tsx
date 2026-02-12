import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
// Session limit fallback is now language-aware via t.sessionLimitFallback
const FLOOR_PLAN_IMAGE_CANDIDATES = [
  "/assets/floorplan/Floor-Plan_EN.jpg",
  "/assets/floorplan/Floor_Plan_EN.jpg",
  "/assets/Floor_Plan_EN.jpg",
];
const MAP_MIN_ZOOM = 1;
const MAP_MAX_ZOOM = 4;
const MAP_ZOOM_STEP = 0.25;

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
  const [floorPlanImageIdx, setFloorPlanImageIdx] = useState(0);
  const [floorPlanImageFailed, setFloorPlanImageFailed] = useState(false);
  const [mapNatural, setMapNatural] = useState({ w: 0, h: 0 });
  const [mapViewport, setMapViewport] = useState({ w: 0, h: 0 });
  const [mapZoom, setMapZoom] = useState(1);
  const [mapPan, setMapPan] = useState({ x: 0, y: 0 });
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [sessionLimitReached, setSessionLimitReached] = useState(false);
  const [sessionLimitMessage, setSessionLimitMessage] = useState(t.sessionLimitFallback);

  // Logo compact animation (synced with IntroWave)
  const [logoCompacting, setLogoCompacting] = useState(false);

  // Refs
  const lastInteractionRef = useRef(Date.now());
const abortRef = useRef<AbortController | null>(null);
  const mapViewportRef = useRef<HTMLDivElement | null>(null);
  const mapDragRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

const isDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";
  const floorPlanImageUrl = FLOOR_PLAN_IMAGE_CANDIDATES[floorPlanImageIdx];

  // Prevent loops - track if component is mounted
  const isMountedRef = useRef(false);

  const ensureSessionId = () => {
    let sid = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, sid);
    }
    if (!sessionStorage.getItem(SESSION_START_KEY)) {
      sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
return sid;
  };

  const mapBaseScale =
    mapNatural.w > 0 && mapNatural.h > 0 && mapViewport.w > 0 && mapViewport.h > 0
      ? Math.min(mapViewport.w / mapNatural.w, mapViewport.h / mapNatural.h)
      : 1;

  const clampMapPan = (x: number, y: number, zoomLevel = mapZoom) => {
    if (!mapNatural.w || !mapNatural.h || !mapViewport.w || !mapViewport.h) {
      return { x: 0, y: 0 };
    }
    const scale = mapBaseScale * zoomLevel;
    const halfMapWidth = (mapNatural.w * scale) / 2;
    const halfMapHeight = (mapNatural.h * scale) / 2;
    const maxX = Math.max(0, halfMapWidth - mapViewport.w / 2);
    const maxY = Math.max(0, halfMapHeight - mapViewport.h / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  };

  const resetMapView = () => {
    setMapZoom(1);
    setMapPan({ x: 0, y: 0 });
  };

  const updateMapZoom = (delta: number) => {
    setMapZoom((prev) => {
      const unclamped = prev + delta;
      const next = Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, Number(unclamped.toFixed(2))));
      setMapPan((current) => clampMapPan(current.x, current.y, next));
      return next;
    });
  };

  const handleMapPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (floorPlanImageFailed || !mapNatural.w || !mapNatural.h) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    mapDragRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: mapPan.x,
      originY: mapPan.y,
    };
    setIsMapDragging(true);
  };

  const handleMapPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setMapPan(clampMapPan(drag.originX + dx, drag.originY + dy));
  };

  const finishMapPointerDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = mapDragRef.current;
    if (drag.active && drag.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
      }
    }
    mapDragRef.current.active = false;
    mapDragRef.current.pointerId = -1;
    setIsMapDragging(false);
  };

  // Initialize session
  useEffect(() => {
    if (isMountedRef.current) return;
    isMountedRef.current = true;
    ensureSessionId();
  }, []);

  // Sync logo zoom-out with IntroWave (1500ms delay, same as INTRO_DURATION_MS)
  useEffect(() => {
    if (flow === "INTRO_WAVE") {
      const timer = window.setTimeout(() => setLogoCompacting(true), 1500);
      return () => window.clearTimeout(timer);
    }
    setLogoCompacting(false);
}, [flow]);

  useEffect(() => {
    if (!floorPlanOpen) return;

    setFloorPlanImageFailed(false);
    setFloorPlanImageIdx(0);
    setMapNatural({ w: 0, h: 0 });
    resetMapView();

    const node = mapViewportRef.current;
    if (!node) return;

    const updateViewport = () => {
      const rect = node.getBoundingClientRect();
      setMapViewport({ w: rect.width, h: rect.height });
    };

    updateViewport();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateViewport);
      observer.observe(node);
    }

    window.addEventListener("resize", updateViewport);
    return () => {
      window.removeEventListener("resize", updateViewport);
      observer?.disconnect();
      mapDragRef.current.active = false;
      mapDragRef.current.pointerId = -1;
      setIsMapDragging(false);
    };
  }, [floorPlanOpen]);

  useEffect(() => {
    setMapPan((current) => clampMapPan(current.x, current.y, mapZoom));
  }, [mapNatural.w, mapNatural.h, mapViewport.w, mapViewport.h, mapZoom]);

  // Inactivity monitoring (only after language is locked)
  useEffect(() => {
    if (flow === "ATTRACT" || flow === "INTRO_WAVE" || flow === "RESET") {
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
    setSessionLimitReached(false);
    setSessionLimitMessage(t.sessionLimitFallback);
    ensureSessionId();
    setTimeout(() => setFlow("ATTRACT"), 0);
  };

  const startIntro = () => {
    sessionStorage.setItem(LANG_LOCK_KEY, "1");
    setFlow("INTRO_WAVE");
  };

  const handleIntroComplete = () => {
    setFlow("SEARCH_READY");
  };

  const submitChat = async (override?: string) => {
    const q = (typeof override === "string" ? override : query).trim();
    if (!q || isStreaming || sessionLimitReached) return;

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
        session_id: ensureSessionId(),
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
        const errorCode = meta.error_code as string | undefined;
        const isClarifier = !!meta.clarifying_question;

        const updated = (prev: ChatMessage[]) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, sources, refinement_chips: chips, route_used: route, confidence, general_mode: general, isStreaming: false }
              : m
          );

        if (errorCode === "session_limit_reached") {
          setMessages(updated);
          setSessionLimitReached(true);
          setSessionLimitMessage((meta.clarifying_question as string) || t.sessionLimitFallback);
        } else if (isClarifier) {
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
      const session_id = ensureSessionId();
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

        <div className="absolute left-8 top-32 z-[85]" dir="ltr">
          <div className="grid grid-cols-3 gap-2 rounded-full bg-black/20 p-1 backdrop-blur-sm">
            <button
              className={`h-11 w-16 rounded-full text-sm font-semibold transition-colors ${
                lang === "EN" ? "bg-gold-400 text-emerald-950" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              onClick={() => setLang("EN")}
            >
              EN
            </button>
            <button
              className={`h-11 w-16 rounded-full text-sm font-semibold transition-colors ${
                lang === "AR" ? "bg-gold-400 text-emerald-950" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              onClick={() => setLang("AR")}
            >
              AR
            </button>
            <button
              className={`h-11 w-16 rounded-full text-sm font-semibold transition-colors ${
                lang === "FR" ? "bg-gold-400 text-emerald-950" : "bg-white/20 text-white hover:bg-white/30"
              }`}
              onClick={() => setLang("FR")}
            >
              FR
            </button>
          </div>
        </div>

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
                    onClick={startIntro}
                    style={{ minHeight: "60px" }}
                  >
                    {t.tapToStart}
                  </button>
                </div>
              </ClickSpark>
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
              <TayyibPanel state={stateForTayyib} variant="compact" objectPosition="50% 8%" />
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
                {t.endSession}
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
            <div className="max-w-2xl mx-auto space-y-2">
              {sessionLimitReached && (
                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  {sessionLimitMessage}
                </div>
              )}
              <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitChat()}
                  placeholder={t.chatPlaceholder}
                  className="w-full rounded-2xl border border-gold-200/60 bg-white/90 backdrop-blur-sm pl-4 pr-4 py-3 text-sm text-emerald-950 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  style={{ minHeight: "48px" }}
                  disabled={isStreaming || sessionLimitReached}
                />
              </div>
              <ClickSpark color="#d4a92a" sparkCount={6}>
                <button
                  className="min-h-[48px] px-5 rounded-2xl bg-emerald-800 text-white text-sm font-medium shadow-soft active:scale-[0.98] transition-transform disabled:opacity-50"
                  onClick={() => submitChat()}
                  disabled={isStreaming || sessionLimitReached || !query.trim()}
                >
                  {t.sendButton}
                </button>
              </ClickSpark>
              <ClickSpark color="#ef4444" sparkCount={6}>
                <button
                  className="min-h-[48px] px-4 rounded-2xl border border-red-300/60 bg-red-50/80 text-red-700 text-sm font-medium active:scale-[0.98] transition-transform"
                  onClick={handleReset}
                >
                  {t.endButton}
                </button>
              </ClickSpark>
              </div>
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
                {t.closeButton}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 sources-scroll">
              {activeSources.map((s, idx) => {
                const pageLabel = s.page_start && s.page_end ? `${t.pagesAbbr} ${s.page_start}-${s.page_end}` : s.page ? `${t.pageAbbr} ${s.page}` : "";
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
                {t.closeButton}
              </button>
            </div>

            <div className="px-4 py-2 border-b border-gold-200 bg-white/95 flex items-center justify-between gap-3">
              <div className="text-xs text-gray-600">Drag map to pan. Use + and - to zoom.</div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 w-9 rounded-lg border border-gold-200 bg-white text-emerald-900 text-lg leading-none disabled:opacity-40"
                  onClick={() => updateMapZoom(-MAP_ZOOM_STEP)}
                  disabled={mapZoom <= MAP_MIN_ZOOM}
                  aria-label="Zoom out"
                >
                  -
                </button>
                <button
                  className="h-9 w-9 rounded-lg border border-gold-200 bg-white text-emerald-900 text-lg leading-none disabled:opacity-40"
                  onClick={() => updateMapZoom(MAP_ZOOM_STEP)}
                  disabled={mapZoom >= MAP_MAX_ZOOM}
                  aria-label="Zoom in"
                >
                  +
                </button>
                <button
                  className="h-9 px-3 rounded-lg border border-gold-200 bg-white text-emerald-900 text-xs"
                  onClick={resetMapView}
                >
                  Reset
                </button>
              </div>
            </div>

            <div
              ref={mapViewportRef}
              className="flex-1 bg-white relative overflow-hidden touch-none"
              style={{ touchAction: "none" }}
              onPointerDown={handleMapPointerDown}
              onPointerMove={handleMapPointerMove}
              onPointerUp={finishMapPointerDrag}
              onPointerCancel={finishMapPointerDrag}
              onLostPointerCapture={finishMapPointerDrag}
            >
              {!floorPlanImageFailed ? (
                <div
                  className="absolute left-1/2 top-1/2 select-none"
                  style={{
                    transform: `translate(-50%, -50%) translate(${mapPan.x}px, ${mapPan.y}px) scale(${mapBaseScale * mapZoom})`,
                    transformOrigin: "center center",
                    cursor: isMapDragging ? "grabbing" : "grab",
                  }}
                >
                  <img
                    src={floorPlanImageUrl}
                    alt={t.floorPlanTitle}
                    draggable={false}
                    onLoad={(e) => {
                      setFloorPlanImageFailed(false);
                      setMapNatural({ w: e.currentTarget.naturalWidth || 1, h: e.currentTarget.naturalHeight || 1 });
                    }}
                    onError={() => {
                      if (floorPlanImageIdx < FLOOR_PLAN_IMAGE_CANDIDATES.length - 1) {
                        setFloorPlanImageIdx((idx) => Math.min(idx + 1, FLOOR_PLAN_IMAGE_CANDIDATES.length - 1));
                        return;
                      }
                      setFloorPlanImageFailed(true);
                    }}
                    style={{
                      maxWidth: "none",
                      maxHeight: "none",
                      pointerEvents: "none",
                      userSelect: "none",
                    }}
                  />
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-600 px-6 text-center">
                  {t.floorPlanUnavailable}
                </div>
              )}
            </div>

            <div className="px-4 py-2 text-xs text-gray-600 border-t border-gold-200 flex items-center justify-between">
              <span>Zoom: {Math.round(mapZoom * 100)}%</span>
              <span>{floorPlanImageFailed ? t.floorPlanUnavailable : "Drag to move the map"}</span>
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

