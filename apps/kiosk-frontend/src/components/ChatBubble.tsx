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

function normalizeStructuredText(content: string, lang: "EN" | "AR" | "FR"): string {
  const hasHeading = /^#{1,3}\s+/m.test(content);
  if (hasHeading) return content;

  const labels =
    lang === "AR"
      ? { direct: "الإجابة المباشرة", steps: "الخطوات", mistakes: "اخطاء شائعة" }
      : lang === "FR"
        ? { direct: "Reponse directe", steps: "Etapes", mistakes: "Erreurs courantes" }
        : { direct: "Direct Answer", steps: "Steps", mistakes: "Common Mistakes" };

  let normalized = content.trim();

  // Strip bold markers from section labels so they match the patterns below
  normalized = normalized.replace(
    /\*\*(Direct Answer|Answer|Steps?|Common Mistakes|Reponse directe|Etapes|Erreurs courantes)\*\*/gi,
    "$1",
  );

  // Convert common inline section labels to markdown headings (colon optional).
  normalized = normalized
    .replace(/(^|\n)\s*(Direct Answer)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(Answer)\s*:\s*/gi, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(Steps?|Step-by-step)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.steps}\n`)
    .replace(/(^|\n)\s*(Common Mistakes|Mistakes to avoid)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.mistakes}\n`)
    .replace(/(^|\n)\s*(Reponse directe)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.direct}\n`)
    .replace(/(^|\n)\s*(Etapes)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.steps}\n`)
    .replace(/(^|\n)\s*(Erreurs courantes)\s*:?\s*(?=\n|$)/gim, `\n## ${labels.mistakes}\n`);

  if (/^#{1,3}\s+/m.test(normalized)) {
    return normalized.trim();
  }

  // Do not auto-split prose into pseudo-steps; preserve model sentence flow.
  return normalized;
}

/**
 * Pre-process raw LLM text so that markdown elements land on their own lines.
 * Handles the common case where the model streams "...some text.## Heading- bullet"
 * without any newlines between them.
 */
function ensureMarkdownNewlines(raw: string): string {
  let text = raw;
  // Insert newline before ## headings that aren't already at the start of a line
  text = text.replace(/([^\n])(\s*#{1,3}\s+)/g, "$1\n$2");
  // Insert newline before bullet points (- ) that aren't at the start of a line
  text = text.replace(/([^\n])(- )/g, "$1\n$2");
  // Insert newline before numbered list items (1. ) that aren't at the start of a line
  text = text.replace(/([^\n])(\d+\.\s)/g, "$1\n$2");
  // Fix bare section labels (Direct Answer, Steps, Common Mistakes) that run into the next sentence
  text = text.replace(/(Direct Answer|Common Mistakes|Steps)\s*(?=[A-Z])/g, "$1\n\n");
  return text;
}

function formatMessageContent(content: string, lang: "EN" | "AR" | "FR"): string {
  const withoutInlineSources = content.replace(/\[Source\s+\d+\]/gi, "").trim();
  const preprocessed = ensureMarkdownNewlines(withoutInlineSources);
  const structured = normalizeStructuredText(preprocessed, lang);
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;

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
        htmlParts.push('<ul class="list-disc pl-5 my-1 space-y-1">');
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
        htmlParts.push('<ol class="list-decimal pl-5 my-1 space-y-1">');
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

        <div className="bubble-text type-body text-[0.95rem] leading-7 tracking-[0.01em] text-balance [&>p]:my-2 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:space-y-1.5 [&_ol]:my-2 [&_ol]:space-y-1.5 [&_li]:pl-0.5 [&_strong]:font-semibold [&_strong]:text-emerald-900 [&_em]:text-emerald-800/90">
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
