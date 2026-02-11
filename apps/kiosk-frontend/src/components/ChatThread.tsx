import { useEffect, useRef } from "react";
import { ChatBubble } from "./ChatBubble";
import type { ChatMessage } from "./KioskFlow";

type ChatThreadProps = {
  messages: ChatMessage[];
  isStreaming: boolean;
  lang: "EN" | "AR" | "FR";
  onChipClick: (text: string) => void;
  onSourcesClick: (sources: ChatMessage["sources"]) => void;
  onFeedbackThumb: (msgId: string, isPositive: boolean) => void;
};

export function ChatThread({ messages, isStreaming, lang, onChipClick, onSourcesClick, onFeedbackThumb }: ChatThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRTL = lang === "AR";

  // Auto-scroll to bottom on new messages or streaming updates
  const lastMsg = messages[messages.length - 1];
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, lastMsg?.content]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {messages.map((msg) => (
        <ChatBubble
          key={msg.id}
          message={msg}
          isRTL={isRTL}
          lang={lang}
          onChipClick={onChipClick}
          onSourcesClick={onSourcesClick}
          onFeedbackThumb={onFeedbackThumb}
        />
      ))}

      {/* Typing indicator when waiting for first token */}
      {isStreaming && lastMsg?.role === "assistant" && !lastMsg.content && (
        <div className={`flex ${isRTL ? "justify-end" : "justify-start"}`}>
          <div className="bg-white/90 backdrop-blur-sm border border-gold-200 rounded-2xl px-4 py-3 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      )}
    </div>
  );
}
