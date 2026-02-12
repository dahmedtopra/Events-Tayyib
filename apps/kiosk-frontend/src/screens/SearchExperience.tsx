import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchJSON, API_BASE_URL } from "../api/client";
import { RatingStars } from "../components/RatingStars";
import { TayyibPanel } from "../components/TayyibPanel";
import { IntroWave } from "../components/IntroWave";
import Noise from "../components/ui/NoiseReactBits";
import AnimatedContent from "../components/ui/AnimatedContentReactBits";
import { useLang } from "../hooks/useLang";
import { useOrientation } from "../hooks/useOrientation";
import { useTayyibDebug } from "../hooks/useTayyibDebug";
import type { TayyibState } from "../tayyib/loops";

type FlowState =
  | "ATTRACT"
  | "LANGUAGE_PICK"
  | "INTRO_WAVE"
  | "SEARCH_READY"
  | "SEARCHING"
  | "ANSWER"
  | "CLARIFY"
  | "FEEDBACK"
  | "RESET";

type AskResponse = {
  answer: {
    direct: string;
    steps: string[];
    mistakes: string[];
  };
  sources: Array<{
    title: string;
    url_or_path?: string;
    url?: string;
    snippet: string;
    relevance?: string;
    page?: number;
    page_start?: number;
    page_end?: number;
  }>;
  confidence: number;
  refinement_chips?: string[];
  route_used: "offline" | "rag" | "fallback";
  latency_ms: number;
  clarifying_question?: string;
  debug_notes?: string;
  error_code?: string;
};

const SESSION_ID_KEY = "session_id";
const SESSION_START_KEY = "session_start";
const LANG_LOCK_KEY = "kiosk_lang_locked";

const INACTIVITY_MS = 60000;

function stripInlineSources(text: string): string {
  return text.replace(/\[Source\s+\d+\]/gi, "").trim();
}

export function SearchExperience({ startAt }: { startAt?: "ATTRACT" | "SEARCH_READY" }) {
  const { t, lang, setLang } = useLang();
  const { isVertical } = useOrientation();
  const { forcedState } = useTayyibDebug();
  const navigate = useNavigate();

  const [flow, setFlow] = useState<FlowState>(() => {
    if (startAt) return startAt;
    const locked = sessionStorage.getItem(LANG_LOCK_KEY) === "1";
    return locked ? "SEARCH_READY" : "ATTRACT";
  });
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [statusStage, setStatusStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [lastRoute, setLastRoute] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);
  const [showMoreSteps, setShowMoreSteps] = useState(false);
  const [showMoreMistakes, setShowMoreMistakes] = useState(false);

  const lastInteractionRef = useRef(Date.now());
  const searchingTimerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const isDebug = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

  useEffect(() => {
    let sid = sessionStorage.getItem(SESSION_ID_KEY);
    if (!sid) {
      sid = crypto.randomUUID();
      sessionStorage.setItem(SESSION_ID_KEY, sid);
      sessionStorage.setItem(SESSION_START_KEY, Date.now().toString());
    }
  }, []);

  useEffect(() => {
    if (flow !== "SEARCHING") return;
    searchingTimerRef.current = window.setInterval(() => {
      setStatusStage((s) => (s + 1) % 3);
    }, 900);
    return () => {
      if (searchingTimerRef.current) window.clearInterval(searchingTimerRef.current);
    };
  }, [flow]);

  useEffect(() => {
    if (flow !== "ANSWER") return;
    const timer = window.setTimeout(() => setFlow("FEEDBACK"), 20000);
    return () => window.clearTimeout(timer);
  }, [flow]);

  useEffect(() => {
    const handler = () => {
      lastInteractionRef.current = Date.now();
    };
    window.addEventListener("pointerdown", handler);
    window.addEventListener("keydown", handler);
    const tick = window.setInterval(() => {
      if (Date.now() - lastInteractionRef.current > INACTIVITY_MS) {
        handleReset();
      }
    }, 2000);
    return () => {
      window.removeEventListener("pointerdown", handler);
      window.removeEventListener("keydown", handler);
      window.clearInterval(tick);
    };
  }, []);

  const handleReset = () => {
    setFlow("RESET");
    sessionStorage.removeItem(SESSION_ID_KEY);
    sessionStorage.removeItem(SESSION_START_KEY);
    sessionStorage.removeItem(LANG_LOCK_KEY);
    setQuery("");
    setResponse(null);
    setError(null);
    setThanks(false);
    setShowMoreSteps(false);
    setShowMoreMistakes(false);
    setTimeout(() => setFlow("ATTRACT"), 0);
  };

  const ensureLangLock = (next: "EN" | "AR" | "FR") => {
    setLang(next);
    sessionStorage.setItem(LANG_LOCK_KEY, "1");
    setFlow("INTRO_WAVE");
  };

  const startSearchReady = () => {
    sessionStorage.setItem(LANG_LOCK_KEY, "1");
    setFlow("INTRO_WAVE");
  };

  const handleIntroComplete = () => {
    setFlow("SEARCH_READY");
  };

  const submit = async (override?: string, clarified?: boolean, clarifierChoice?: string) => {
    const q = typeof override === "string" ? override : query;
    if (!q.trim()) return;
    setError(null);
    setThanks(false);
    setFlow("SEARCHING");
    setStatusStage(0);
    try {
      const session_id = sessionStorage.getItem(SESSION_ID_KEY) || "";
      const clarifiedFlag = clarified ?? (flow === "CLARIFY");
      const data = await fetchJSON<AskResponse>("/api/ask", {
        method: "POST",
        body: JSON.stringify({ lang, query: q, session_id, clarified: clarifiedFlag, clarifier_choice: clarifierChoice })
      });
      setResponse(data);
      setLastRoute(data.route_used);
      setLastConfidence(typeof data.confidence === "number" ? data.confidence : null);
      setShowMoreSteps(false);
      setShowMoreMistakes(false);
      if (data.error_code && data.error_code !== "insufficient_grounding") {
        setError(t.serviceUnavailable);
        setFlow("CLARIFY");
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(() => handleReset(), 10000);
        return;
      }
      if (data.clarifying_question && (!data.answer?.direct || data.answer.direct.length === 0)) {
        setFlow("CLARIFY");
      } else {
        setFlow("ANSWER");
      }
      if (startAt === "ATTRACT") {
        navigate("/ask");
      }
    } catch {
      setError(t.serviceUnavailable);
      setFlow("CLARIFY");
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => handleReset(), 10000);
    }
  };

  const fillQuery = (text: string) => {
    setQuery(text);
  };

  const submitClarified = async (text: string) => {
    setQuery(text);
    await submit(text, true, text);
  };

  const submitFeedback = async (rating: number) => {
    try {
      const session_id = sessionStorage.getItem(SESSION_ID_KEY) || "";
      const start = Number(sessionStorage.getItem(SESSION_START_KEY) || Date.now());
      const time_on_screen_ms = Date.now() - start;
      await fetchJSON("/api/feedback", {
        method: "POST",
        body: JSON.stringify({
          session_id,
          rating_1_5: rating,
          time_on_screen_ms,
          last_route_used: lastRoute,
          last_confidence: lastConfidence
        })
      });
      setThanks(true);
      setTimeout(() => handleReset(), 10000);
    } catch {
      setError(t.serviceUnavailable);
      setFlow("CLARIFY");
    }
  };

  const sources = response?.sources || [];
  const hasSources = sources.length > 0;
  const directAnswer = stripInlineSources(response?.answer?.direct || "");
  const steps = (response?.answer?.steps || []).map(stripInlineSources);
  const mistakes = (response?.answer?.mistakes || []).map(stripInlineSources);
  const hasAnswer = !!directAnswer || steps.length > 0 || mistakes.length > 0;
  const clarifier = response?.clarifying_question;
  const refinement = Array.isArray(response?.refinement_chips) ? response?.refinement_chips : [];

  const clarificationButtons = refinement.length > 0 ? refinement.slice(0, 3) : [
    t.quickChips[0],
    t.quickChips[1],
    t.quickChips[2]
  ].filter(Boolean);

  const followups = refinement.length > 0 ? refinement.slice(0, 3) : [
    t.quickChips[0],
    t.quickChips[1],
    t.quickChips[2]
  ].filter(Boolean);

  const stepsToShow = showMoreSteps ? steps : steps.slice(0, 3);
  const mistakesToShow = showMoreMistakes ? mistakes : mistakes.slice(0, 3);

  const stateForTayyib: TayyibState = forcedState
    ? forcedState
    : flow === "INTRO_WAVE"
      ? "intro_wave"
      : flow === "SEARCHING"
        ? "searching"
        : flow === "ANSWER"
          ? "explaining_a"
          : flow === "CLARIFY"
            ? "listening"
            : flow === "ATTRACT"
              ? "home_hero"
              : "idle";

  const gridClass = useMemo(() => {
    if (flow === "ATTRACT" || flow === "LANGUAGE_PICK" || flow === "INTRO_WAVE") {
      return "h-full w-full";
    }
    return isVertical ? "h-full grid grid-rows-[1fr_1fr] gap-6 p-6" : "h-full grid grid-cols-[1fr_380px] gap-6 p-6";
  }, [flow, isVertical]);

  const statusLabel = t.searchingStages[statusStage] || t.searchingStages[0];

  return (
    <div className={gridClass}>
      {flow === "INTRO_WAVE" && (
        <IntroWave onComplete={handleIntroComplete} />
      )}

      {(flow === "ATTRACT" || flow === "LANGUAGE_PICK") && (
        <section
          className="w-full h-full relative flex items-center justify-center"
          style={{
            background: "linear-gradient(135deg, #0b4a3a 0%, #156f58 50%, #0f5a46 100%)"
          }}
        >
          {/* Noise overlay - decorative, non-interactive */}
          <Noise patternAlpha={25} patternRefreshInterval={3} />

          {/* Content container */}
          <div className="relative z-10 w-full h-full flex items-center justify-center">
            <div className="w-full max-w-4xl flex flex-col items-center gap-8 text-center px-8" style={{ pointerEvents: "auto" }}>

              {/* Tayyib video panel */}
              <AnimatedContent delay={0} duration={1} distance={40} threshold={0}>
                <div className="w-full max-w-2xl h-[320px] md:h-[420px] relative">
                  <div className="absolute inset-0 tayyib-halo" style={{ pointerEvents: "none" }} />
                  <div className="absolute inset-0 rounded-3xl border-2 border-gold-400/30 bg-gradient-to-br from-white/10 to-transparent backdrop-blur-sm" style={{ pointerEvents: "none" }} />
                  <div className="relative h-full flex items-center justify-center">
                    <TayyibPanel
                      state="home_hero"
                      variant="hero"
                      objectPosition={flow === "ATTRACT" ? "center center" : "50% 8%"}
                    />
                  </div>
                </div>
              </AnimatedContent>

              {/* Greeting text */}
              <AnimatedContent delay={0.4} duration={1} distance={30} threshold={0}>
                <div className="text-4xl md:text-5xl font-semibold text-white tracking-wide">
                  {t.attractPrompt}
                </div>
              </AnimatedContent>

              <AnimatedContent delay={0.6} duration={1} distance={20} threshold={0}>
                <div className="text-lg md:text-xl text-emerald-100">
                  {t.greeting}
                </div>
              </AnimatedContent>

              {/* Language picker or CTA */}
              {flow === "LANGUAGE_PICK" && (
                <AnimatedContent delay={0.8} duration={1} distance={20} threshold={0}>
                  <div
                    className="rounded-3xl px-8 py-6 w-full max-w-xl bg-white/10 backdrop-blur-md border border-gold-400/30"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="text-sm text-emerald-100 mb-4">{t.chooseLanguage}</div>
                    <div className="flex items-center justify-center gap-4 flex-wrap">
                      <button
                        className="px-8 py-3 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-lg font-medium hover:bg-white/30 transition-colors min-w-[100px]"
                        onClick={() => ensureLangLock("EN")}
                      >
                        EN
                      </button>
                      <button
                        className="px-8 py-3 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-lg font-medium hover:bg-white/30 transition-colors min-w-[100px]"
                        onClick={() => ensureLangLock("AR")}
                      >
                        AR
                      </button>
                      <button
                        className="px-8 py-3 rounded-2xl border-2 border-gold-400 bg-white/20 text-white text-lg font-medium hover:bg-white/30 transition-colors min-w-[100px]"
                        onClick={() => ensureLangLock("FR")}
                      >
                        FR
                      </button>
                    </div>
                    <div className="mt-6">
                      <button
                        className="px-10 py-4 rounded-3xl bg-gold-500 text-emerald-900 text-lg font-semibold shadow-lg hover:bg-gold-400 transition-colors w-full"
                        onClick={startSearchReady}
                      >
                        {t.tapToStart}
                      </button>
                    </div>
                  </div>
                </AnimatedContent>
              )}

              {flow === "ATTRACT" && (
                <AnimatedContent delay={0.8} duration={1} distance={20} threshold={0}>
                  <div className="relative">
                    {/* Gold ring accent */}
                    <div
                      className="absolute -inset-4 rounded-full border-2 border-gold-400/40 animate-pulse"
                      style={{ pointerEvents: "none" }}
                    />
                    <button
                      className="relative px-12 py-5 rounded-full bg-gold-500 text-emerald-900 text-xl font-bold shadow-glow hover:bg-gold-400 transition-all hover:scale-105 active:scale-95"
                      onClick={() => setFlow("LANGUAGE_PICK")}
                    >
                      {t.tapToStart}
                    </button>
                  </div>
                </AnimatedContent>
              )}
            </div>
          </div>
        </section>
      )}

      {flow !== "ATTRACT" && flow !== "LANGUAGE_PICK" && flow !== "INTRO_WAVE" && (
        <>
          <section className="relative z-20 glass rounded-3xl p-6 flex flex-col h-full min-h-0">
            <div className="flex flex-col gap-4">
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
                      placeholder={t.searchPlaceholder}
                      className="search-input w-full rounded-3xl border border-gold-200 pl-12 pr-5 py-4 bg-white shadow-soft focus:outline-none focus:ring-2 focus:ring-emerald-400 text-base"
                    />
                    <div className="text-xs text-gray-500 mt-1">{t.noPersonalData}</div>
                  </div>
                  <button
                    className="min-h-[52px] px-6 rounded-2xl bg-emerald-800 text-white text-base shadow-soft"
                    onClick={() => submit()}
                    disabled={flow === "SEARCHING"}
                  >
                    {flow === "SEARCHING" ? statusLabel : t.searchButton}
                  </button>
                  <button
                    className="min-h-[52px] px-5 rounded-2xl glass text-emerald-900 text-base"
                    onClick={() => {
                      setQuery("");
                      if (flow === "ANSWER" || flow === "CLARIFY") setFlow("SEARCH_READY");
                    }}
                  >
                    {t.clearButton}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                {t.quickChips.map((chip) => (
                  <button
                    key={chip}
                    className="min-h-[52px] px-6 rounded-full border border-emerald-300/70 bg-gradient-to-b from-white to-emerald-50 text-emerald-900 text-sm font-semibold shadow-[0_6px_16px_rgba(9,79,63,0.14)] transition-all hover:border-emerald-400/80 active:translate-y-[1px] active:scale-[0.99]"
                    onClick={() => fillQuery(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-2">{t.trendingTitle}</div>
                <div className="flex flex-wrap gap-3">
                  {t.trendingQuestions.map((q) => (
                    <button
                      key={q}
                      className="min-h-[52px] px-6 rounded-full border border-gold-300/75 bg-gradient-to-b from-white to-gold-50 text-gold-900 text-sm font-semibold shadow-[0_6px_16px_rgba(145,110,24,0.16)] transition-all hover:border-gold-400/85 active:translate-y-[1px] active:scale-[0.99]"
                      onClick={() => fillQuery(q)}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
              {(flow === "SEARCH_READY" || flow === "ANSWER" || flow === "FEEDBACK") && (
                <div className="flex items-center gap-3 flex-wrap">
                  {flow === "SEARCH_READY" && (
                    <button className="px-4 py-2 rounded-2xl border border-gold-200 text-emerald-900 bg-white hover:bg-gray-50" onClick={() => navigate("/pose")}>
                      {t.poseCta}
                    </button>
                  )}
                  <button
                    className="px-4 py-2 rounded-2xl border-2 border-red-300 text-red-700 bg-red-50 hover:bg-red-100 font-medium shadow-sm"
                    onClick={handleReset}
                  >
                    {t.endSession}
                  </button>
                </div>
              )}
            </div>

            <div className="mt-5 flex-1 flex flex-col gap-4">
              {error && (
                <div className="rounded-2xl border border-red-200 p-4 bg-red-50 text-sm text-red-700 flex items-center justify-between">
                  <span>{error}</span>
                  <button className="px-3 py-2 rounded-xl bg-red-600 text-white" onClick={() => submit()}>
                    {t.tryAgain}
                  </button>
                </div>
              )}

              {flow === "CLARIFY" && (
                <div className="rounded-2xl border border-gold-200 p-5 bg-gold-50 text-sm text-gray-800 space-y-4">
                  <div className="font-semibold">{t.clarifyTitle}</div>
                  {clarifier && <div>{clarifier}</div>}
                  {clarifier && (
                    <div className="flex flex-wrap gap-3">
                    {clarificationButtons.map((c) => (
                        <button
                          key={c}
                          className="min-h-[56px] px-6 rounded-full border border-emerald-300/70 bg-gradient-to-b from-white to-emerald-50 text-emerald-900 text-sm font-semibold shadow-[0_7px_16px_rgba(9,79,63,0.15)] transition-all hover:border-emerald-400/80 active:translate-y-[1px] active:scale-[0.99]"
                          onClick={() => submitClarified(c)}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {(flow === "ANSWER" || flow === "SEARCHING") && response && hasAnswer && hasSources && (
                <div className="rounded-2xl border border-gold-200 p-5 bg-white space-y-4">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className={`rounded-full px-3 py-1 ${hasSources ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
                      {hasSources ? t.groundedLabel : t.limitedSources}
                    </span>
                    {flow === "SEARCHING" && <span className="text-emerald-700 status-shimmer px-2 py-1 rounded-full bg-emerald-50">{statusLabel}</span>}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">{t.directAnswer}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-line">
                      {directAnswer || steps[0] || t.noAnswerText}
                    </div>
                    {import.meta.env.DEV && (
                      <div className="mt-2 text-xs text-red-700">
                        DEBUG direct_len={directAnswer.length}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">{t.steps}</div>
                    <ol className="space-y-2">
                      {stepsToShow.map((s, i) => (
                        <li key={`${s}-${i}`} className="flex gap-3 items-start">
                          <span className="h-6 w-6 rounded-full bg-gold-200 text-gold-900 text-xs flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm text-gray-700">{s}</span>
                        </li>
                      ))}
                    </ol>
                    {steps.length > 3 && (
                      <button className="mt-2 text-xs text-emerald-800" onClick={() => setShowMoreSteps((s) => !s)}>
                        {showMoreSteps ? t.showLess : t.showMore}
                      </button>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">{t.mistakes}</div>
                    <ol className="space-y-2">
                      {mistakesToShow.map((s, i) => (
                        <li key={`${s}-${i}`} className="flex gap-3 items-start">
                          <span className="h-6 w-6 rounded-full bg-amber-200 text-amber-900 text-xs flex items-center justify-center">{i + 1}</span>
                          <span className="text-sm text-amber-900">{s}</span>
                        </li>
                      ))}
                    </ol>
                    {mistakes.length > 3 && (
                      <button className="mt-2 text-xs text-emerald-800" onClick={() => setShowMoreMistakes((s) => !s)}>
                        {showMoreMistakes ? t.showLess : t.showMore}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {flow === "ANSWER" && hasSources && (
                <div className="rounded-2xl border border-gold-200 p-4 bg-white">
                  <div className="text-sm font-semibold mb-2">{t.followupTitle}</div>
                  <div className="flex flex-wrap gap-3">
                  {followups.map((chip) => (
                      <button
                        key={chip}
                        className="min-h-[52px] px-6 rounded-full border border-emerald-300/70 bg-gradient-to-b from-white to-emerald-50 text-emerald-900 text-sm font-semibold shadow-[0_6px_16px_rgba(9,79,63,0.14)] transition-all hover:border-emerald-400/80 active:translate-y-[1px] active:scale-[0.99]"
                        onClick={() => fillQuery(chip)}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(flow === "ANSWER" || flow === "FEEDBACK") && hasSources && !thanks && (
                <div className="rounded-2xl border border-gold-200 p-4 bg-white">
                  <div className="text-sm font-semibold mb-2">{t.feedbackPrompt}</div>
                  <RatingStars onSubmit={(rating) => { setFlow("FEEDBACK"); submitFeedback(rating); }} />
                </div>
              )}

              {thanks && (
                <div className="rounded-2xl border border-gold-200 p-4 bg-emerald-50 text-emerald-900 text-sm">
                  {t.thanksMessage}
                </div>
              )}
            </div>
          </section>

          <aside className="relative z-10 glass rounded-3xl p-4 flex flex-col h-full min-h-0">
            <div className="text-sm font-semibold">{t.sources}</div>
            <div className="flex-1 overflow-y-auto space-y-3 mt-3">
              {sources.length === 0 && (
                <div className="text-xs text-gray-500">-</div>
              )}
              {sources.map((s, idx) => {
                const pageLabel = s.page_start && s.page_end ? `${t.pagesAbbr} ${s.page_start}-${s.page_end}` : s.page ? `${t.pageAbbr} ${s.page}` : "";
                const url = s.url_or_path || s.url || "";
                const isLink = typeof url === "string" && url.startsWith("http");
                return (
                  <div key={`${s.title}-${url}-${idx}`} className="rounded-2xl border border-gold-200 p-3 bg-white hover:border-emerald-400 transition">
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
                );
              })}
            </div>
            <div className="mt-3 h-44 rounded-3xl border border-gold-200 bg-white/60 shadow-glow relative overflow-hidden tayyib-rim">
              <div className="absolute inset-0 tayyib-halo" />
              <TayyibPanel state={stateForTayyib} variant="compact" objectPosition="50% 8%" />
            </div>
          </aside>
        </>
      )}

      {isDebug && (
        <div className="fixed top-4 right-4 z-50 glass rounded-2xl p-3 text-xs text-gray-700 space-y-1">
          <div>direct_len: {directAnswer.length}</div>
          <div>has_answer: {hasAnswer ? "yes" : "no"}</div>
          <div>direct_preview: {directAnswer ? directAnswer.slice(0, 60) : "-"}</div>
          <div>state: {flow}</div>
          <div>api: {API_BASE_URL}</div>
          <div>route: {response?.route_used ?? "-"}</div>
          <div>sources: {sources.length}</div>
          <div>latency: {response?.latency_ms ?? "-"}</div>
          <div>debug: {response?.debug_notes ?? "-"}</div>
          <div>error: {response?.error_code ?? "-"}</div>
        </div>
      )}
    </div>
  );
}
