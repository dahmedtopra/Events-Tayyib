import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type Lang = "EN" | "AR" | "FR";

type Dict = {
  greeting: string;
  attractPrompt: string;
  tapToStart: string;
  chooseLanguage: string;
  searchReadyPrompt: string;
  scopeBanner: string;
  noPersonalData: string;
  searchPlaceholder: string;
  searchButton: string;
  clearButton: string;
  poseCta: string;
  searchingStages: [string, string, string];
  quickChips: string[];
  askTitle: string;
  guideTitle: string;
  poseTitle: string;
  shareTitle: string;
  directAnswer: string;
  steps: string;
  mistakes: string;
  followupTitle: string;
  clarifyTitle: string;
  feedbackPrompt: string;
  thanksMessage: string;
  groundedLabel: string;
  limitedSources: string;
  generalDisclaimer: string;
  showMore: string;
  showLess: string;
  localSource: string;
  openPdf: string;
  floorPlanButton: string;
  floorPlanTitle: string;
  floorPlanUnavailable: string;
  poseTap: string;
  countdownToggle: string;
  moreDetails: string;
  sources: string;
  wizardTitle: string;
  checklistTitle: string;
  qrPlaceholder: string;
  poseFrame: string;
  countdown: string;
  watermark: string;
  checklistLoaded: string;
  checklistMissing: string;
  footerDisclaimer: string;
  headerTitle: string;
  modePlaceholder: string;
  languageLabel: string;
  homeSearchLabel: string;
  trendingTitle: string;
  trendingQuestions: string[];
  serviceUnavailable: string;
  tryAgain: string;
  chatPlaceholder: string;
  sendButton: string;
  tayyibTyping: string;
  feedbackHelpQuestion: string;
  feedbackMoreQuestion: string;
  feedbackYesThumb: string;
  feedbackNoThumb: string;
  endSession: string;
  endButton: string;
  closeButton: string;
  submitButton: string;
  pageAbbr: string;
  pagesAbbr: string;
  noAnswerText: string;
  sessionLimitFallback: string;
};

type LangContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
};

const DICT: Record<Lang, Dict> = {
  EN: {
    greeting: "Ask about schedules, sessions, speakers, and venue info",
    attractPrompt: "Official event guidance, ready to help.",
    tapToStart: "Tap to begin",
    chooseLanguage: "Choose language",
    searchReadyPrompt: "Tap a topic or type a question",
    scopeBanner: "Event guidance only; not legal or medical advice. Check official organizers for critical decisions.",
    noPersonalData: "Do not enter personal data.",
    searchPlaceholder: "Search event info...",
    searchButton: "Search",
    clearButton: "Clear",
    poseCta: "Pose with Guide",
    searchingStages: ["Finding sources…", "Reading…", "Writing…"],
    quickChips: [
      "Event schedule",
      "Session info",
      "Exhibition & B2B",
      "Venue info"
    ],
    askTitle: "Ask (Chat + Sources)",
    guideTitle: "Guide (Wizard)",
    poseTitle: "Pose Mode",
    shareTitle: "Share Checklist",
    directAnswer: "Direct Answer",
    steps: "Steps",
    mistakes: "Common Mistakes",
    followupTitle: "Ask a follow-up",
    clarifyTitle: "Clarify your question",
    feedbackPrompt: "Rate this answer",
    thanksMessage: "Thanks for your feedback.",
    groundedLabel: "Grounded in official guidance",
    limitedSources: "Limited sources",
    generalDisclaimer: "General guidance (not sourced from the official documents). Please verify with official organizers for critical details.",
    showMore: "Show more",
    showLess: "Show less",
    localSource: "Local source",
    openPdf: "Open PDF",
    floorPlanButton: "View Floor Plan",
    floorPlanTitle: "Floor Plan",
    floorPlanUnavailable: "If the map does not load, open the PDF directly.",
    poseTap: "Tap to change pose",
    countdownToggle: "Countdown toggle",
    moreDetails: "More Details",
    sources: "Sources",
    wizardTitle: "Wizard Steps",
    checklistTitle: "Checklist",
    qrPlaceholder: "QR placeholder",
    poseFrame: "Pose Frame",
    countdown: "Countdown",
    watermark: "ICHS Watermark",
    checklistLoaded: "Checklist loaded (placeholder)",
    checklistMissing: "No checklist payload detected",
    footerDisclaimer: "Informational guidance only. No legal or medical advice.",
    headerTitle: "Event AI Guide",
    modePlaceholder: "Mode: Placeholder",
    languageLabel: "Language",
    homeSearchLabel: "Search",
    trendingTitle: "Trending questions",
    trendingQuestions: [
      "What sessions are happening today?",
      "Where is the exhibition?",
      "When are the masterclasses?",
      "What time does the event start?"
    ],
    serviceUnavailable: "Service unavailable. Please try again.",
    tryAgain: "Try again",
    chatPlaceholder: "Type your message...",
    sendButton: "Send",
    tayyibTyping: "Guide is typing...",
    feedbackHelpQuestion: "Did that answer help you?",
    feedbackMoreQuestion: "Is there anything else about the event I can help with?",
    feedbackYesThumb: "Yes",
    feedbackNoThumb: "No",
    endSession: "End Session",
    endButton: "End",
    closeButton: "Close",
    submitButton: "Submit",
    pageAbbr: "p.",
    pagesAbbr: "pp.",
    noAnswerText: "(No answer text returned)",
    sessionLimitFallback: "This session reached the limit (15 messages). Tap End Session to start a new session."
  },
  AR: {
    greeting: "اسأل عن الجداول والجلسات والمتحدثين ومعلومات المكان",
    attractPrompt: "إرشادات رسمية للفعالية لمساعدتك.",
    tapToStart: "اضغط للبدء",
    chooseLanguage: "اختر اللغة",
    searchReadyPrompt: "اختر موضوعا أو اكتب سؤالا",
    scopeBanner: "إرشادات الفعالية فقط؛ ليست مشورة قانونية أو طبية. راجع المنظمين الرسميين للقرارات المهمة.",
    noPersonalData: "لا تدخل بيانات شخصية.",
    searchPlaceholder: "ابحث في معلومات الفعالية...",
    searchButton: "بحث",
    clearButton: "مسح",
    poseCta: "التقط صورة مع المرشد",
    searchingStages: ["جار العثور على المصادر…", "جار القراءة…", "جار الكتابة…"],
    quickChips: [
      "جدول الفعالية",
      "معلومات الجلسات",
      "المعرض واجتماعات الأعمال",
      "معلومات المكان"
    ],
    askTitle: "اسأل (محادثة + مصادر)",
    guideTitle: "الدليل (خطوات)",
    poseTitle: "وضعية التصوير",
    shareTitle: "مشاركة القائمة",
    directAnswer: "الإجابة المباشرة",
    steps: "الخطوات",
    mistakes: "أخطاء شائعة",
    followupTitle: "اسأل متابعة",
    clarifyTitle: "وضّح سؤالك",
    feedbackPrompt: "قيّم الإجابة",
    thanksMessage: "شكرا لملاحظاتك.",
    groundedLabel: "مستند إلى إرشادات رسمية",
    limitedSources: "مصادر محدودة",
    generalDisclaimer: "إرشادات عامة (غير مستندة إلى المستندات الرسمية). يرجى التحقق من المنظمين الرسميين للتفاصيل المهمة.",
    showMore: "عرض المزيد",
    showLess: "عرض أقل",
    localSource: "مصدر محلي",
    openPdf: "فتح الملف",
    floorPlanButton: "عرض مخطط الطابق",
    floorPlanTitle: "مخطط الطابق",
    floorPlanUnavailable: "إذا لم يتم تحميل الخريطة، افتح ملف PDF مباشرة.",
    poseTap: "اضغط لتغيير الوضعية",
    countdownToggle: "مؤقت العد التنازلي",
    moreDetails: "تفاصيل إضافية",
    sources: "المصادر",
    wizardTitle: "خطوات الإرشاد",
    checklistTitle: "قائمة التحقق",
    qrPlaceholder: "رمز QR (مكان مخصص)",
    poseFrame: "إطار التصوير",
    countdown: "العد التنازلي",
    watermark: "علامة ICHS",
    checklistLoaded: "تم تحميل القائمة (مكان مخصص)",
    checklistMissing: "لا توجد بيانات للقائمة",
    footerDisclaimer: "معلومات إرشادية فقط. لا توجد نصائح قانونية أو طبية.",
    headerTitle: "مرشد الفعالية الذكي",
    modePlaceholder: "الوضع: مكان مخصص",
    languageLabel: "اللغة",
    homeSearchLabel: "بحث",
    trendingTitle: "أسئلة شائعة",
    trendingQuestions: [
      "ما الجلسات المقامة اليوم؟",
      "أين يقام المعرض؟",
      "متى تبدأ ورش العمل؟",
      "متى تبدأ الفعالية؟"
    ],
    serviceUnavailable: "الخدمة غير متاحة حاليا. حاول مرة أخرى.",
    tryAgain: "حاول مرة أخرى",
    chatPlaceholder: "اكتب رسالتك...",
    sendButton: "إرسال",
    tayyibTyping: "المرشد يكتب...",
    feedbackHelpQuestion: "هل كانت هذه الإجابة مفيدة؟",
    feedbackMoreQuestion: "هل هناك أي شيء آخر عن الفعالية يمكنني مساعدتك به؟",
    feedbackYesThumb: "نعم",
    feedbackNoThumb: "لا",
    endSession: "إنهاء الجلسة",
    endButton: "إنهاء",
    closeButton: "إغلاق",
    submitButton: "تقديم",
    pageAbbr: "ص.",
    pagesAbbr: "ص.",
    noAnswerText: "(لم يتم إرجاع نص الإجابة)",
    sessionLimitFallback: "وصلت هذه الجلسة إلى الحد الأقصى (15 رسالة). اضغط على إنهاء الجلسة لبدء جلسة جديدة."
  },
  FR: {
    greeting: "Posez des questions sur les horaires, sessions, intervenants et le lieu",
    attractPrompt: "Guide officiel de l'événement, prêt à aider.",
    tapToStart: "Touchez pour commencer",
    chooseLanguage: "Choisir la langue",
    searchReadyPrompt: "Touchez un sujet ou saisissez une question",
    scopeBanner: "Guide événementiel uniquement ; pas de conseils juridiques ou médicaux. Consultez les organisateurs officiels pour les décisions importantes.",
    noPersonalData: "N'entrez aucune donnée personnelle.",
    searchPlaceholder: "Rechercher des infos sur l'événement...",
    searchButton: "Rechercher",
    clearButton: "Effacer",
    poseCta: "Pose avec le Guide",
    searchingStages: ["Recherche des sources…", "Lecture…", "Rédaction…"],
    quickChips: [
      "Programme de l'événement",
      "Infos sessions",
      "Exposition & B2B",
      "Infos lieu"
    ],
    askTitle: "Demander (Chat + Sources)",
    guideTitle: "Guide (Assistant)",
    poseTitle: "Mode Pose",
    shareTitle: "Partager la checklist",
    directAnswer: "Réponse directe",
    steps: "Étapes",
    mistakes: "Erreurs courantes",
    followupTitle: "Question de suivi",
    clarifyTitle: "Précisez votre question",
    feedbackPrompt: "Notez cette réponse",
    thanksMessage: "Merci pour votre avis.",
    groundedLabel: "Fondé sur des sources officielles",
    limitedSources: "Sources limitées",
    generalDisclaimer: "Conseils généraux (non issus des documents officiels). Vérifiez auprès des organisateurs officiels pour les détails critiques.",
    showMore: "Afficher plus",
    showLess: "Afficher moins",
    localSource: "Source locale",
    openPdf: "Ouvrir le PDF",
    floorPlanButton: "Voir le plan",
    floorPlanTitle: "Plan des lieux",
    floorPlanUnavailable: "Si la carte ne s'affiche pas, ouvrez le PDF directement.",
    poseTap: "Touchez pour changer la pose",
    countdownToggle: "Basculer le compte à rebours",
    moreDetails: "Plus de détails",
    sources: "Sources",
    wizardTitle: "Étapes du guide",
    checklistTitle: "Checklist",
    qrPlaceholder: "Zone QR (placeholder)",
    poseFrame: "Cadre de pose",
    countdown: "Compte à rebours",
    watermark: "Filigrane ICHS",
    checklistLoaded: "Checklist chargée (placeholder)",
    checklistMissing: "Aucune donnée de checklist",
    footerDisclaimer: "Informations uniquement. Pas de conseils juridiques ou médicaux.",
    headerTitle: "Guide IA Événement",
    modePlaceholder: "Mode : placeholder",
    languageLabel: "Langue",
    homeSearchLabel: "Recherche",
    trendingTitle: "Questions tendances",
    trendingQuestions: [
      "Quelles sessions ont lieu aujourd'hui ?",
      "Où se trouve l'exposition ?",
      "Quand sont les masterclasses ?",
      "À quelle heure commence l'événement ?"
    ],
    serviceUnavailable: "Service indisponible. Veuillez réessayer.",
    tryAgain: "Réessayer",
    chatPlaceholder: "Tapez votre message...",
    sendButton: "Envoyer",
    tayyibTyping: "Le Guide écrit...",
    feedbackHelpQuestion: "Cette réponse vous a-t-elle aidé ?",
    feedbackMoreQuestion: "Y a-t-il autre chose sur l'événement avec laquelle je peux vous aider ?",
    feedbackYesThumb: "Oui",
    feedbackNoThumb: "Non",
    endSession: "Fin de session",
    endButton: "Fin",
    closeButton: "Fermer",
    submitButton: "Soumettre",
    pageAbbr: "p.",
    pagesAbbr: "p.",
    noAnswerText: "(Aucun texte de réponse retourné)",
    sessionLimitFallback: "Cette session a atteint la limite (15 messages). Appuyez sur Fin de session pour en démarrer une nouvelle."
  }
};

const LangContext = createContext<LangContextValue | null>(null);

const STORAGE_KEY = "kiosk_lang";

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY) as Lang | null;
    return stored ?? "EN";
  });

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, lang);
    const dir = lang === "AR" ? "rtl" : "ltr";
    document.documentElement.setAttribute("dir", dir);
    document.body.setAttribute("dir", dir);
  }, [lang]);

  const value = useMemo<LangContextValue>(
    () => ({
      lang,
      setLang: setLangState,
      t: DICT[lang]
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) {
    throw new Error("useLang must be used within LangProvider");
  }
  return ctx;
}
