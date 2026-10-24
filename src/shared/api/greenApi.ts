import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import {
  accountSchema,
  decode,
  sendSchema,
  settingsSchema,
  stateSchema,
} from "./contracts";
import { ApiError, request } from "./transport";
import { getSession } from "../session";

type Failure = { message: string; status: number };

const failure = (error: unknown): { error: Failure } => ({
  error: {
    message: error instanceof Error ? error.message : "Ошибка API.",
    status: error instanceof ApiError ? error.status : 0,
  },
});

export const greenApi = createApi({
  reducerPath: "greenApi",
  baseQuery: fakeBaseQuery<Failure>(),
  endpoints: (b) => ({
    verify: b.mutation<{ state: string }, number>({
      async queryFn(generation, api) {
        try {
          const session = getSession(generation);
          const state = decode(
            stateSchema,
            await request(session, "getStateInstance", { signal: api.signal }),
          );

          if (state.stateInstance !== "authorized")
            throw new Error(
              `Инстанс: ${state.stateInstance}. Завершите авторизацию Telegram в кабинете GREEN-API и подключитесь снова.`,
            );

          const settings = decode(
            settingsSchema,
            await request(session, "getSettings", { signal: api.signal }),
          );

          console.log('greenApi settings =', settings);

          if (
            settings.webhookUrl ||
            [
              settings.incomingWebhook,
              settings.outgoingWebhook,
              settings.stateWebhook,
            ].some((x) => x !== "yes")
          )
            throw new Error(
              "Настройки инстанса: очистите webhookUrl и включите incomingWebhook, outgoingWebhook, stateWebhook в кабинете GREEN-API.",
            );

          return { data: { state: state.stateInstance } };
        } catch (e) {
          return failure(e);
        }
      },
    }),
    check: b.mutation<
      { exist: boolean; chatId: string; username?: string },
      { generation: number; phone: string }
    >({
      async queryFn(arg, api) {
        try {
          return {
            data: decode(
              accountSchema,
              await request(getSession(arg.generation), "checkAccount", {
                body: { phoneNumber: Number(arg.phone.slice(1)) },
                signal: api.signal,
              }),
            ),
          };
        } catch (e) {
          return failure(e);
        }
      },
    }),
    send: b.mutation<
      { idMessage: string },
      { generation: number; chatId: string; message: string }
    >({
      async queryFn({ generation, ...body }, api) {
        try {
          return {
            data: decode(
              sendSchema,
              await request(getSession(generation), "sendMessage", {
                body,
                signal: api.signal,
              }),
            ),
          };
        } catch (e) {
          return failure(e);
        }
      },
    }),
  }),
});
