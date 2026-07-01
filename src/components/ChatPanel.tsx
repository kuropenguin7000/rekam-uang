"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import type { ParsedExpense } from "@/lib/types";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { ReceiptCard } from "./ReceiptCard";
import { ChevronDownIcon, SendIcon } from "./icons";

type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; upgrade?: boolean }
  | {
      id: string;
      role: "receipt";
      draft: ParsedExpense;
      status: "pending" | "confirmed" | "discarded";
    };

let idSeq = 0;
const nextId = () => `m-${Date.now()}-${idSeq++}`;

const CHAT_STORAGE_KEY = "sw_chat_messages";

/** Load the persisted transcript for this browser-tab session, if any. */
function loadStoredMessages(): Message[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHAT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length > 0
      ? (parsed as Message[])
      : null;
  } catch {
    return null;
  }
}

export function ChatPanel() {
  const { addExpense, parse } = useExpenses();
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>(
    () =>
      loadStoredMessages() ?? [
        { id: "intro", role: "assistant", text: t("chat.intro") },
      ]
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<HTMLDetailsElement>(null);

  const suggestions = [
    t("chat.suggest1"),
    t("chat.suggest2"),
    t("chat.suggest3"),
    t("chat.suggest4"),
  ];

  const notes = [
    t("chat.note1"),
    t("chat.note2"),
    t("chat.note3"),
    t("chat.note4"),
    t("chat.note5"),
    t("chat.note6"),
    t("chat.note7"),
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // Re-translate the static intro bubble when the language changes.
  useEffect(() => {
    setMessages((m) =>
      m.map((msg) =>
        msg.id === "intro" && msg.role === "assistant"
          ? { ...msg, text: t("chat.intro") }
          : msg
      )
    );
  }, [t]);

  // Persist the transcript for this tab session so it survives tab switches and
  // route navigation. sessionStorage clears when the tab is closed.
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* storage unavailable / full — ignore */
    }
  }, [messages]);

  // Collapse the help card when clicking anywhere outside it.
  useEffect(() => {
    if (!notesOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!notesRef.current?.contains(e.target as Node)) setNotesOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [notesOpen]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput("");
    setMessages((m) => [...m, { id: nextId(), role: "user", text: trimmed }]);
    setTyping(true);

    const result = await parse(trimmed);
    setTyping(false);

    if (result.error === "limit_reached" || result.error === "cooldown") {
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          text: result.message ?? t("chat.limitDefault"),
          upgrade: result.error === "limit_reached",
        },
      ]);
      return;
    }
    if (!result.draft) {
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "assistant", text: t("chat.notParsed") },
      ]);
      return;
    }
    setMessages((m) => [
      ...m,
      { id: nextId(), role: "receipt", draft: result.draft!, status: "pending" },
    ]);
  }

  async function resolveReceipt(
    id: string,
    status: "confirmed" | "discarded",
    final?: ParsedExpense
  ) {
    setMessages((m) =>
      m.map((msg) =>
        msg.id === id && msg.role === "receipt"
          ? { ...msg, status, draft: final ?? msg.draft }
          : msg
      )
    );
    if (status === "confirmed" && final) {
      await addExpense(final);
      const amount = formatCurrency(final.amount);
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: "assistant",
          text: final.merchant
            ? t("chat.savedAt", { amount, merchant: final.merchant })
            : t("chat.saved", { amount }),
        },
      ]);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="scroll-thin flex-1 space-y-3 overflow-y-auto px-1 py-4"
      >
        {messages.map((msg) => {
          if (msg.role === "receipt") {
            return (
              <div key={msg.id} className="flex justify-start">
                <ReceiptCard
                  draft={msg.draft}
                  status={msg.status}
                  onConfirm={(final) =>
                    resolveReceipt(msg.id, "confirmed", final)
                  }
                  onDiscard={() => resolveReceipt(msg.id, "discarded")}
                />
              </div>
            );
          }
          return (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "rounded-br-sm bg-primary text-white"
                    : "rounded-bl-sm bg-surface text-foreground shadow-sm"
                }`}
              >
                {msg.text}
                {msg.role === "assistant" && msg.upgrade && (
                  <Link
                    href="/pricing"
                    className="mt-2 block font-semibold text-primary underline"
                  >
                    {t("chat.viewPro")}
                  </Link>
                )}
              </div>
            </div>
          );
        })}

        {typing && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-surface px-4 py-3 shadow-sm">
              <Dot delay="0s" />
              <Dot delay="0.2s" />
              <Dot delay="0.4s" />
            </div>
          </div>
        )}
      </div>

      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 px-1 pb-3">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => submit(s)}
              className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-primary hover:text-primary"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <details
        ref={notesRef}
        open={notesOpen}
        className="group mb-2 rounded-2xl border border-border bg-surface px-3 py-2 text-sm shadow-sm"
      >
        <summary
          onClick={(e) => {
            e.preventDefault();
            setNotesOpen((v) => !v);
          }}
          className="flex cursor-pointer list-none items-center justify-between font-medium text-foreground"
        >
          <span>💡 {t("chat.notesTitle")}</span>
          <ChevronDownIcon className="h-4 w-4 text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          {notes.map((n) => {
            const [term, ...rest] = n.split(" — ");
            return (
              <li key={n}>
                <span className="font-semibold text-foreground">{term}</span>
                {rest.length > 0 && <span> — {rest.join(" — ")}</span>}
              </li>
            );
          })}
        </ul>
      </details>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          aria-label={t("chat.sendAria")}
          disabled={!input.trim()}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition enabled:hover:opacity-90 disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="typing-dot h-2 w-2 rounded-full bg-muted"
      style={{ animationDelay: delay }}
    />
  );
}
