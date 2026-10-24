import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { store } from "../app/store";
import {
  consume,
  processNotification,
} from "../features/receive-messages/receiver";
import { clearSession, openSession } from "../shared/session";
import { incoming, demo } from "./fixtures";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});

afterAll(() => server.close());

it("processes once, retries ACK without reading again, then advances", async () => {
  vi.useFakeTimers();

  const session = openSession(demo);
  const order: string[] = [];
  let deletes = 0;

  server.use(
    http.get("*/receiveNotification/*", () => {
      order.push("receive");

      return HttpResponse.json(incoming());
    }),
    http.delete("*/deleteNotification/*", () => {
      order.push("delete");

      expect(store.getState().chat.messages.ids).toHaveLength(1);

      if (++deletes === 1) return new HttpResponse(null, { status: 503 });

      clearSession();

      return HttpResponse.json({ result: true });
    }),
  );

  const done = consume(session, store.dispatch);

  await vi.advanceTimersByTimeAsync(5000);
  await done;

  expect(order).toEqual(["receive", "delete", "delete"]);
});

it("handles duplicates and messages in inactive chats", () => {
  const session = openSession(demo);

  processNotification(incoming(), session, store.dispatch);
  processNotification(incoming(), session, store.dispatch);
  processNotification(incoming("20000000"), session, store.dispatch);

  expect(store.getState().chat.messages.ids).toHaveLength(2);
  expect(Object.keys(store.getState().chat.chats)).toHaveLength(2);
});

it("does not ACK malformed text", async () => {
  const session = openSession(demo);
  let deleted = false;

  server.use(
    http.get("*/receiveNotification/*", () =>
      HttpResponse.json({
        ...incoming(),
        body: {
          ...incoming().body,
          messageData: { typeMessage: "textMessage" },
        },
      }),
    ),
    http.delete("*/deleteNotification/*", () => {
      deleted = true;

      return HttpResponse.json({ result: true });
    }),
  );
  await consume(session, store.dispatch);

  expect(deleted).toBe(false);
  expect(store.getState().chat.receiver).toContain("Несовместимый");
});

it("ACKs unsupported valid events and ignores outgoing echoes", () => {
  const session = openSession(demo);
  const raw = incoming();

  expect(
    processNotification(
      {
        ...raw,
        body: { ...raw.body, typeWebhook: "outgoingAPIMessageReceived" },
      },
      session,
      store.dispatch,
    ),
  ).toBe(12);
  expect(store.getState().chat.messages.ids).toHaveLength(0);
});

it("stops a repeated result:false ACK without an infinite loop", async () => {
  vi.useFakeTimers();

  const session = openSession(demo);
  let deletes = 0;

  server.use(
    http.get("*/receiveNotification/*", () => HttpResponse.json(incoming())),
    http.delete("*/deleteNotification/*", () => {
      deletes++;

      return HttpResponse.json({ result: false, reason: "not found" });
    }),
  );

  const done = consume(session, store.dispatch);

  await vi.advanceTimersByTimeAsync(6000);
  await done;

  expect(deletes).toBe(3);
  expect(store.getState().chat.messages.ids).toHaveLength(1);
  expect(store.getState().chat.receiver).toContain("трёх");
});

it("ignores receive result after logout and never ACKs it", async () => {
  const session = openSession(demo);
  let deleted = false;

  server.use(
    http.get("*/receiveNotification/*", () => {
      clearSession();

      return HttpResponse.json(incoming());
    }),
    http.delete("*/deleteNotification/*", () => {
      deleted = true;

      return HttpResponse.json({ result: true });
    }),
  );
  await consume(session, store.dispatch);

  expect(deleted).toBe(false);
  expect(store.getState().chat.messages.ids).toHaveLength(0);
});
