export type ChatMessage = {
  id: string;
  username: string;
  text: string;
  createdAt: string;
};

type ChatStore = {
  messages: ChatMessage[];
  subscribers: Set<(payload: string) => void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __chatStore: ChatStore | undefined;
}

const MAX_MESSAGES = 200;

function getStore(): ChatStore {
  if (!globalThis.__chatStore) {
    globalThis.__chatStore = {
      messages: [],
      subscribers: new Set(),
    };
  }
  return globalThis.__chatStore;
}

function broadcast(data: unknown) {
  const payload = JSON.stringify(data);
  for (const send of getStore().subscribers) {
    send(payload);
  }
}

export function getRecentMessages(): ChatMessage[] {
  return [...getStore().messages];
}

export function addMessage(username: string, text: string): ChatMessage {
  const trimmedUser = username.trim().slice(0, 32);
  const trimmedText = text.trim().slice(0, 2000);
  if (!trimmedUser || !trimmedText) {
    throw new Error("Username and message are required");
  }

  const message: ChatMessage = {
    id: crypto.randomUUID(),
    username: trimmedUser,
    text: trimmedText,
    createdAt: new Date().toISOString(),
  };

  const store = getStore();
  store.messages.push(message);
  if (store.messages.length > MAX_MESSAGES) {
    store.messages.splice(0, store.messages.length - MAX_MESSAGES);
  }

  broadcast({ type: "message", message });
  return message;
}

export function subscribe(send: (payload: string) => void): () => void {
  const store = getStore();
  store.subscribers.add(send);
  return () => {
    store.subscribers.delete(send);
  };
}

export function sendHistory(send: (payload: string) => void) {
  send(
    JSON.stringify({
      type: "history",
      messages: getRecentMessages(),
    }),
  );
}
