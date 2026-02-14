import type { ChatMessage } from "./KioskFlow";

type ChatBubbleProps = {
  message: ChatMessage;
  isRTL: boolean;
  lang: "EN" | "AR" | "FR";
  onChipClick: (text: string) => void;
  onSourcesClick: (sources: ChatMessage["sources"]) => void;
  onFeedbackThumb: (msgId: string, isPositive: boolean) => void;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function labelsFor(lang: "EN" | "AR" | "FR") {
  if (lang === "AR") {
    return {
      direct: "\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629",
      details: "\u062a\u0641\u0627\u0635\u064a\u0644",
      steps: "\u0627\u0644\u062e\u0637\u0648\u0627\u062a",
      mistakes: "\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629",
    };
  }
  if (lang === "FR") {
    return {
      direct: "Reponse directe",
      details: "Details",
      steps: "Etapes",
      mistakes: "Erreurs courantes",
    };
  }
  return {
    direct: "Direct Answer",
    details: "Details",
    steps: "Steps",
    mistakes: "Common Mistakes",
  };
}

function normalizeStructuredText(content: string, lang: "EN" | "AR" | "FR"): string {
  const labels = labelsFor(lang);
  let normalized = content.trim();

  normalized = normalized.replace(
    /\*\*(Direct Answer|Answer|Details?|Steps?|Common Mistakes|R[e\u00e9]ponse directe|D[e\u00e9]tails?|[E\u00c9]tapes|Erreurs courantes|\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629|\u062a\u0641\u0627\u0635\u064a\u0644|\u0627\u0644\u062e\u0637\u0648\u0627\u062a|\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629)\*\*/gi,
    "$1",
  );

  // If the model emits "Direct Answer <text>" on one line, split it into heading + body.
  normalized = normalized
    .replace(/(^|\n)\s*#{0,3}\s*(Direct Answer|Answer)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.direct}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(Details?)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.details}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(Steps?|Step-by-step)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.steps}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(Common Mistakes|Mistakes to avoid)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.mistakes}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(R[e\u00e9]ponse directe)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.direct}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(D[e\u00e9]tails?)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.details}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*([E\u00c9]tapes)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.steps}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(Erreurs courantes)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.mistakes}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.direct}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(\u062a\u0641\u0627\u0635\u064a\u0644)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.details}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(\u0627\u0644\u062e\u0637\u0648\u0627\u062a)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.steps}\n${p3}`)
    .replace(/(^|\n)\s*#{0,3}\s*(\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629)\s*:?\s*([^\n]+)/gim, (_m, p1, _p2, p3) => `${p1}## ${labels.mistakes}\n${p3}`);

  normalized = normalized
    .replace(/(^|\n)\s*#{1,3}\s*(Direct Answer|Answer)\s*:?/gim, `\n## ${labels.direct}`)
    .replace(/(^|\n)\s*#{1,3}\s*(Details?)\s*:?/gim, `\n## ${labels.details}`)
    .replace(/(^|\n)\s*#{1,3}\s*(Steps?|Step-by-step)\s*:?/gim, `\n## ${labels.steps}`)
    .replace(/(^|\n)\s*#{1,3}\s*(Common Mistakes|Mistakes to avoid)\s*:?/gim, `\n## ${labels.mistakes}`)
    .replace(/(^|\n)\s*#{1,3}\s*(R[e\u00e9]ponse directe)\s*:?/gim, `\n## ${labels.direct}`)
    .replace(/(^|\n)\s*#{1,3}\s*(D[e\u00e9]tails?)\s*:?/gim, `\n## ${labels.details}`)
    .replace(/(^|\n)\s*#{1,3}\s*([E\u00c9]tapes)\s*:?/gim, `\n## ${labels.steps}`)
    .replace(/(^|\n)\s*#{1,3}\s*(Erreurs courantes)\s*:?/gim, `\n## ${labels.mistakes}`)
    .replace(/(^|\n)\s*#{1,3}\s*(\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629)\s*:?/gim, `\n## ${labels.direct}`)
    .replace(/(^|\n)\s*#{1,3}\s*(\u062a\u0641\u0627\u0635\u064a\u0644)\s*:?/gim, `\n## ${labels.details}`)
    .replace(/(^|\n)\s*#{1,3}\s*(\u0627\u0644\u062e\u0637\u0648\u0627\u062a)\s*:?/gim, `\n## ${labels.steps}`)
    .replace(/(^|\n)\s*#{1,3}\s*(\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629)\s*:?/gim, `\n## ${labels.mistakes}`);

  normalized = normalized
    .replace(/(^|\n)\s*(Direct Answer)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(Details?)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.details}\n`)
    .replace(/(^|\n)\s*(Answer)\s*:\s*/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(Steps?|Step-by-step)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.steps}\n`)
    .replace(/(^|\n)\s*(Common Mistakes|Mistakes to avoid)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.mistakes}\n`)
    .replace(/(^|\n)\s*(R[e\u00e9]ponse directe)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(D[e\u00e9]tails?)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.details}\n`)
    .replace(/(^|\n)\s*([E\u00c9]tapes)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.steps}\n`)
    .replace(/(^|\n)\s*(Erreurs courantes)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.mistakes}\n`)
    .replace(/(^|\n)\s*(\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(\u062a\u0641\u0627\u0635\u064a\u0644)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.details}\n`)
    .replace(/(^|\n)\s*(\u0627\u0644\u062e\u0637\u0648\u0627\u062a)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.steps}\n`)
    .replace(/(^|\n)\s*(\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.mistakes}\n`);

  return normalized.trim();
}

function ensureMarkdownNewlines(raw: string): string {
  let text = raw;
  text = text.replace(/([^\n#])(\s*#{1,3}\s+)/g, "$1\n$2");
  text = text.replace(/([^\n])(- )/g, "$1\n$2");
  text = text.replace(/([^\n])(\d+\.\s)/g, "$1\n$2");
  text = text
    .replace(/(Direct Answer|Details|Common Mistakes|Steps)\s*:?\s*(?=\S)/g, "$1\n\n")
    .replace(/(Reponse directe|Details|Etapes|Erreurs courantes)\s*:?\s*(?=\S)/g, "$1\n\n")
    .replace(/(\u0627\u0644\u0627\u062c\u0627\u0628\u0629 \u0627\u0644\u0645\u0628\u0627\u0634\u0631\u0629|\u062a\u0641\u0627\u0635\u064a\u0644|\u0627\u0644\u062e\u0637\u0648\u0627\u062a|\u0627\u062e\u0637\u0627\u0621 \u0634\u0627\u0626\u0639\u0629)\s*(?=\S)/g, "$1\n\n");
  return text;
}

function formatMessageContent(content: string, lang: "EN" | "AR" | "FR"): string {
  const withoutInlineSources = content.replace(/\[Source\s+\d+\]/gi, "").trim();
  const preprocessed = ensureMarkdownNewlines(withoutInlineSources);
  const structured = normalizeStructuredText(preprocessed, lang);
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;
  const listPad = lang === "AR" ? "pr-5" : "pl-5";

  const closeLists = () => {
    if (inUl) {
      htmlParts.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      htmlParts.push("</ol>");
      inOl = false;
    }
  };

  const inlineFormat = (text: string) => {
    let safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/(^|[\s(])\*(.+?)\*([)\s]|$)/g, "$1<em>$2</em>$3");
    return safe;
  };

  for (const rawLine of structured.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      closeLists();
      htmlParts.push("<br />");
      continue;
    }

    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (inOl) {
        htmlParts.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push(`<ul class="list-disc ${listPad} my-1 space-y-1">`);
        inUl = true;
      }
      htmlParts.push(`<li>${inlineFormat(bulletMatch[1])}</li>`);
      continue;
    }

    const numberedMatch = line.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch) {
      if (inUl) {
        htmlParts.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push(`<ol class="list-decimal ${listPad} my-1 space-y-1">`);
        inOl = true;
      }
      htmlParts.push(`<li>${inlineFormat(numberedMatch[1])}</li>`);
      continue;
    }

    const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      closeLists();
      htmlParts.push(`<h4 class="text-emerald-900 font-semibold mt-3 mb-1">${inlineFormat(headingMatch[1])}</h4>`);
      continue;
    }

    closeLists();
    htmlParts.push(`<p>${inlineFormat(line)}</p>`);
  }

  closeLists();
  return htmlParts.join("");
}

export function ChatBubble({ message, isRTL, lang, onChipClick, onSourcesClick, onFeedbackThumb }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const alignment = isUser ? (isRTL ? "justify-start" : "justify-end") : isRTL ? "justify-end" : "justify-start";

  // Feedback message - special rendering with thumbs
  if (message.isFeedback) {
    return (
      <div className={`flex ${alignment}`}>
        <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white/90 backdrop-blur-sm border border-gold-200 text-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-800">T</div>
            <span className="text-xs text-emerald-700 font-semibold">Tayyib</span>
          </div>
          <p className="text-[0.95rem] leading-7">{message.content}</p>
          {!message.feedbackGiven && (
            <div className="mt-2 flex gap-3">
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-50 text-emerald-800 text-sm font-medium active:scale-95 transition-transform border border-emerald-200"
                onClick={() => onFeedbackThumb(message.id, true)}
                style={{ minHeight: "44px" }}
              >
                <span className="text-lg">👍</span>
                {lang === "AR" ? "نعم" : lang === "FR" ? "Oui" : "Yes"}
              </button>
              <button
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 text-red-700 text-sm font-medium active:scale-95 transition-transform border border-red-200"
                onClick={() => onFeedbackThumb(message.id, false)}
                style={{ minHeight: "44px" }}
              >
                <span className="text-lg">👎</span>
                {lang === "AR" ? "لا" : lang === "FR" ? "Non" : "No"}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${alignment}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-emerald-800 text-white" : "bg-white/90 backdrop-blur-sm border border-gold-200 text-gray-800"
        }`}
      >
        {!isUser && (
          <div className="flex items-center gap-2 mb-1">
            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-[10px] font-bold text-emerald-800">T</div>
            <span className="text-xs text-emerald-700 font-semibold">Tayyib</span>
          </div>
        )}

        <div dir={isRTL ? "rtl" : "ltr"} className={`bubble-text type-body text-[0.95rem] leading-7 tracking-[0.01em] text-balance [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:space-y-1.5 [&_ol]:my-2 [&_ol]:space-y-1.5 ${isRTL ? "[&_li]:pr-0.5" : "[&_li]:pl-0.5"} [&_strong]:font-semibold [&_strong]:text-emerald-900 [&_em]:text-emerald-800/90`}>
          <span dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content, lang) }} />
          {message.isStreaming && <span className="inline-block w-0.5 h-4 bg-emerald-600 animate-pulse ml-0.5 align-text-bottom" />}
        </div>

        {!isUser && message.sources && message.sources.length > 0 && !message.isStreaming && (
          <button
            className="mt-2 text-xs text-emerald-700 bg-emerald-50 rounded-full px-3 py-1 active:scale-95 transition-transform"
            onClick={() => onSourcesClick(message.sources!)}
            style={{ minHeight: "32px" }}
          >
            Sources ({message.sources.length})
          </button>
        )}

        {!isUser && message.refinement_chips && message.refinement_chips.length > 0 && !message.isStreaming && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.refinement_chips.map((chip) => (
              <button
                key={chip}
                className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-900 text-xs active:scale-95 transition-transform border border-emerald-200"
                onClick={() => onChipClick(chip)}
                style={{ minHeight: "36px" }}
              >
                {chip}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
