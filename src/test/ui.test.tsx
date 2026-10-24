import { afterAll, afterEach, beforeAll, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { App } from "../pages/App";
import { store } from "../app/store";
import { actions } from "../entities/state";
import { openSession } from "../shared/session";
import { demo } from "./fixtures";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

const mount = () =>
  render(
    <Provider store={store}>
      <App />
    </Provider>,
  );

it("shows a definite rejected send as failed", async () => {
  connected();
  server.use(
    http.post("*/sendMessage/*", () => new HttpResponse(null, { status: 400 })),
  );
  mount();
  fireEvent.change(screen.getByLabelText("Сообщение"), {
    target: { value: "Проверка" },
  });
  fireEvent.click(screen.getByLabelText("Отправить"));

  await screen.findByText("Ошибка отправки");
});

it("does not restore history when a delayed send completes after logout", async () => {
  connected();

  let arrived!: () => void;
  let finish!: () => void;
  const started = new Promise<void>((r) => {
    arrived = r;
  });
  const pending = new Promise<void>((r) => {
    finish = r;
  });

  server.use(
    http.post("*/sendMessage/*", async () => {
      arrived();
      await pending;

      return HttpResponse.json({ idMessage: "late" });
    }),
  );
  mount();
  fireEvent.change(screen.getByLabelText("Сообщение"), {
    target: { value: "Старое сообщение" },
  });
  fireEvent.click(screen.getByLabelText("Отправить"));
  await started;
  fireEvent.click(screen.getByText("Выйти"));
  finish();

  await screen.findByLabelText("Токен API");
  expect(store.getState().chat.messages.ids).toHaveLength(0);
  expect(store.getState().chat.connected).toBe(false);
});

function connected() {
  const s = openSession(demo);

  store.dispatch(actions.connected(s.generation));
  store.dispatch(actions.upsertChat({ chatId: "10000000", name: "Тест" }));
  store.dispatch(actions.select("10000000"));
}

it("connects using memory credentials and clears token from UI and Redux", async () => {
  server.use(
    http.get("*/getStateInstance/*", () =>
      HttpResponse.json({ stateInstance: "authorized" }),
    ),
    http.get("*/getSettings/*", () =>
      HttpResponse.json({
        typeInstance: "telegram",
        webhookUrl: "",
        incomingWebhook: "yes",
        outgoingWebhook: "yes",
        stateWebhook: "yes",
        webhookUrlToken: "private-webhook-secret",
      }),
    ),
  );
  mount();
  fireEvent.change(screen.getByLabelText("API URL"), {
    target: { value: demo.apiUrl },
  });
  fireEvent.change(screen.getByLabelText("ID инстанса"), {
    target: { value: demo.idInstance },
  });
  fireEvent.change(screen.getByLabelText("Токен API"), {
    target: { value: demo.token },
  });
  fireEvent.click(screen.getByText("Подключить Telegram →"));

  await screen.findByText("Выйти");
  expect(JSON.stringify(store.getState())).not.toContain(demo.token);
  expect(JSON.stringify(store.getState())).not.toContain(
    "private-webhook-secret",
  );
});

it("renders text safely and marks a network send result unknown without retry", async () => {
  connected();

  let requests = 0;

  server.use(
    http.post("*/sendMessage/*", () => {
      requests++;

      return HttpResponse.error();
    }),
  );
  mount();
  fireEvent.change(screen.getByLabelText("Сообщение"), {
    target: { value: "<script>alert(1)</script>" },
  });
  fireEvent.click(screen.getByLabelText("Отправить"));

  await screen.findByText("Результат неизвестен");
  expect(
    screen.getByText("<script>alert(1)</script>", { selector: "article p" }),
  ).toBeInTheDocument();
  expect(document.querySelector("article script")).toBeNull();
  expect(requests).toBe(1);
});

it("keeps draft per chat and does not move delayed send on selection change", async () => {
  connected();
  store.dispatch(actions.upsertChat({ chatId: "20000000", name: "Второй" }));

  let resolve!: () => void;
  const pending = new Promise<void>((r) => {
    resolve = r;
  });

  server.use(
    http.post("*/sendMessage/*", async () => {
      await pending;

      return HttpResponse.json({ idMessage: "remote" });
    }),
  );
  mount();
  fireEvent.change(screen.getByLabelText("Сообщение"), {
    target: { value: "Первый текст" },
  });
  fireEvent.click(screen.getByLabelText("Отправить"));
  fireEvent.click(screen.getByText("Второй"));
  fireEvent.change(screen.getByLabelText("Сообщение"), {
    target: { value: "Черновик второго" },
  });
  resolve();

  await waitFor(() =>
    expect(
      Object.values(store.getState().chat.messages.entities)[0].status,
    ).toBe("accepted"),
  );
  expect(Object.values(store.getState().chat.messages.entities)[0].chatId).toBe(
    "10000000",
  );
  expect(screen.getByLabelText("Сообщение")).toHaveValue("Черновик второго");
});
