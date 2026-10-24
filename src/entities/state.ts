import {
  createEntityAdapter,
  createSlice,
  type PayloadAction,
} from "@reduxjs/toolkit";

export type MessageStatus =
  | "sending"
  | "accepted"
  | "failed"
  | "unknown"
  | "delivered"
  | "read"
  | "noAccount";

export type Message = {
  localId: string;
  chatId: string;
  idMessage?: string;
  direction: "in" | "out";
  text: string;
  time: number;
  status: MessageStatus;
};

export type Chat = { chatId: string; name: string; phone?: string };

export const externalKey = (
  instance: string,
  chat: string,
  direction: string,
  id: string,
) => JSON.stringify([instance, chat, direction, id]);

const statusKey = (chat: string, id: string) => JSON.stringify([chat, id]);

const adapter = createEntityAdapter<Message, string>({
  selectId: (m) => m.localId,
});

const initialState = () => ({
  connected: false,
  generation: 0,
  activeChat: "",
  chats: {} as Record<string, Chat>,
  messages: adapter.getInitialState(),
  statuses: {} as Record<string, MessageStatus>,
  chatErrors: {} as Record<string, string>,
  receiver: "Остановлен",
  instance: "authorized",
});

const nextStatus = (old: MessageStatus, next: MessageStatus) =>
  old === "read" && next === "delivered" ? old : next;

export const chatSlice = createSlice({
  name: "chat",
  initialState: initialState(),
  reducers: {
    connected(state, action: PayloadAction<number>) {
      state.connected = true;
      state.generation = action.payload;
    },
    reset: () => initialState(),
    select(state, action: PayloadAction<string>) {
      state.activeChat = action.payload;
    },
    upsertChat(state, action: PayloadAction<Chat>) {
      state.chats[action.payload.chatId] ??= action.payload;
    },
    addMessage(state, action: PayloadAction<Message>) {
      const m = action.payload;

      if (
        m.idMessage &&
        Object.values(state.messages.entities).some(
          (x) =>
            x.chatId === m.chatId &&
            x.direction === m.direction &&
            x.idMessage === m.idMessage,
        )
      )
        return;

      adapter.addOne(state.messages, m);
    },
    sendResult(
      state,
      action: PayloadAction<{
        localId: string;
        status: MessageStatus;
        idMessage?: string;
      }>,
    ) {
      const m = state.messages.entities[action.payload.localId];

      if (!m) return;

      Object.assign(m, action.payload);

      if (m.idMessage)
        m.status = state.statuses[statusKey(m.chatId, m.idMessage)] ?? m.status;
    },
    providerStatus(
      state,
      action: PayloadAction<{
        chatId: string;
        idMessage?: string;
        status: string;
      }>,
    ) {
      const p = action.payload;

      if (!["delivered", "read", "failed", "noAccount"].includes(p.status))
        return;

      const status = p.status as MessageStatus;

      if (!p.idMessage) {
        state.chatErrors[p.chatId] =
          `Статус отправки: ${status}. Проверьте получателя и настройки инстанса.`;

        return;
      }

      const key = statusKey(p.chatId, p.idMessage);

      state.statuses[key] = nextStatus(state.statuses[key], status);

      const m = Object.values(state.messages.entities).find(
        (m) =>
          m.chatId === p.chatId &&
          m.idMessage === p.idMessage &&
          m.direction === "out",
      );

      if (m) m.status = nextStatus(m.status, status);
    },
    receiverStatus(state, action: PayloadAction<string>) {
      state.receiver = action.payload;
    },
    instanceStatus(state, action: PayloadAction<string>) {
      state.instance = action.payload;
    },
  },
});

export const actions = chatSlice.actions;
