import type { Conversation, Message } from "../../shared/contracts";

const STORAGE_KEY = "linc33.local_conversations.v1";
const MAX_CONVERSATIONS = 30;

interface LocalConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: Message[];
}

function readAll(): LocalConversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LocalConversation[]) : [];
  } catch {
    return [];
  }
}

function writeAll(conversations: LocalConversation[]) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(conversations.slice(0, MAX_CONVERSATIONS)),
    );
  } catch {
    // Storage may be unavailable (private browsing, quota). The
    // conversation simply isn't persisted for next time.
  }
}

export function listLocalConversations(): Conversation[] {
  return readAll()
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .map(({ id, created_at, updated_at, title }) => ({
      id,
      journey_id: null,
      created_at,
      updated_at,
      title,
    }));
}

export function getLocalConversation(id: string): Message[] {
  return readAll().find((c) => c.id === id)?.messages || [];
}

export function saveLocalConversation(id: string, messages: Message[]) {
  if (!messages.length) return;
  const all = readAll();
  const now = new Date().toISOString();
  const existing = all.find((c) => c.id === id);
  if (existing) {
    existing.messages = messages;
    existing.updated_at = now;
  } else {
    const title =
      messages.find((m) => m.role === "user")?.content.slice(0, 60) ||
      "A conversation";
    all.unshift({ id, title, created_at: now, updated_at: now, messages });
  }
  writeAll(all);
}

export function deleteLocalConversation(id: string) {
  writeAll(readAll().filter((c) => c.id !== id));
}
