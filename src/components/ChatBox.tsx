"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat-store";

const USERNAME_KEY = "realtimechatbox-username";

type StreamPayload =
  | { type: "history"; messages: ChatMessage[] }
  | { type: "message"; message: ChatMessage };

function formatTime(iso: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function ChatBox() {
  const [username, setUsername] = useState("");
  const [draftName, setDraftName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const seenIds = useRef(new Set<string>());

  useEffect(() => {
    const stored = sessionStorage.getItem(USERNAME_KEY);
    if (stored) {
      setUsername(stored);
      setDraftName(stored);
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/chat");

    source.onopen = () => {
      setConnected(true);
      setError(null);
    };

    source.onmessage = (event) => {
      let payload: StreamPayload;
      try {
        payload = JSON.parse(event.data) as StreamPayload;
      } catch {
        return;
      }

      if (payload.type === "history") {
        seenIds.current = new Set(payload.messages.map((m) => m.id));
        setMessages(payload.messages);
        return;
      }

      if (payload.type === "message") {
        if (seenIds.current.has(payload.message.id)) return;
        seenIds.current.add(payload.message.id);
        setMessages((prev) => [...prev, payload.message]);
      }
    };

    source.onerror = () => {
      setConnected(false);
      setError("Connection lost. Reconnecting…");
    };

    return () => {
      source.close();
      setConnected(false);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const join = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const name = draftName.trim().slice(0, 32);
      if (!name) return;
      sessionStorage.setItem(USERNAME_KEY, name);
      setUsername(name);
    },
    [draftName],
  );

  const sendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const body = text.trim();
      if (!body || !username || sending) return;

      setSending(true);
      setError(null);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, text: body }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? "Failed to send");
        }
        setText("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send");
      } finally {
        setSending(false);
      }
    },
    [text, username, sending],
  );

  if (!username) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Realtime chat
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Pick a display name to join the room. Open another browser tab to
            chat with yourself or share the link with someone on your network.
          </p>
        </div>
        <form onSubmit={join} className="flex flex-col gap-3">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Display name
          </label>
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={32}
            autoFocus
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={!draftName.trim()}
            className="mt-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Join chat
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[min(640px,calc(100vh-8rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Realtime chat
          </h1>
          <p className="text-xs text-zinc-500">
            Signed in as{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-300">
              {username}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <span
            className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-500" : "bg-amber-500"}`}
            aria-hidden
          />
          {connected ? "Live" : "Connecting…"}
        </div>
      </header>

      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-zinc-500">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((msg) => {
            const mine = msg.username === username;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine
                      ? "rounded-br-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "rounded-bl-md bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
                  }`}
                >
                  {!mine && (
                    <span className="mb-0.5 block text-xs font-semibold text-zinc-600 dark:text-zinc-300">
                      {msg.username}
                    </span>
                  )}
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                </div>
                <time
                  className="mt-0.5 px-1 text-[10px] text-zinc-400"
                  dateTime={msg.createdAt}
                >
                  {formatTime(msg.createdAt)}
                </time>
              </div>
            );
          })
        )}
      </div>

      {error && (
        <p className="border-t border-zinc-200 px-4 py-2 text-xs text-red-600 dark:border-zinc-800 dark:text-red-400">
          {error}
        </p>
      )}

      <form
        onSubmit={sendMessage}
        className="flex gap-2 border-t border-zinc-200 p-3 dark:border-zinc-800"
      >
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          maxLength={2000}
          disabled={!connected || sending}
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-zinc-400 focus:ring-2 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
        <button
          type="submit"
          disabled={!connected || sending || !text.trim()}
          className="shrink-0 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          Send
        </button>
      </form>
    </div>
  );
}
