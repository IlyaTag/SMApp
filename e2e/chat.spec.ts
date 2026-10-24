import { test, expect } from "@playwright/test";

test("connect → canonical chat → send → receive → logout", async ({ page }) => {
  let sent = false;
  let ack = false;

  await page.route("https://test.api.green-api.com/**", async (route) => {
    const url = route.request().url();
    let body: unknown = null;

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });

      return;
    }

    if (url.includes("/getStateInstance/"))
      body = { stateInstance: "authorized" };

    if (url.includes("/getSettings/"))
      body = {
        typeInstance: "telegram",
        webhookUrl: "",
        incomingWebhook: "yes",
        outgoingWebhook: "yes",
        stateWebhook: "yes",
      };

    if (url.includes("/checkAccount/"))
      body = { exist: true, chatId: "10000000", username: "@test" };

    if (url.includes("/sendMessage/")) {
      sent = true;
      body = { idMessage: "out-1" };
    }

    if (url.includes("/receiveNotification/")) {
      await new Promise((r) => setTimeout(r, 200));

      if (sent && !ack)
        body = {
          receiptId: 12,
          body: {
            typeWebhook: "incomingMessageReceived",
            instanceData: { idInstance: 4100000000, typeInstance: "telegram" },
            timestamp: 1763115112,
            idMessage: "in-1",
            senderData: { chatId: "10000000", chatName: "Test" },
            messageData: {
              typeMessage: "textMessage",
              textMessageData: { textMessage: "Ответ из Telegram" },
            },
          },
        };
    }

    if (url.includes("/deleteNotification/")) {
      ack = true;
      body = { result: true };
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  });
  await page.goto("/");
  await page.getByLabel("API URL").fill("https://test.api.green-api.com");
  await page.getByLabel("ID инстанса").fill("4100000000");
  await page.getByLabel("Токен API").fill("fixture-token");
  await page.getByRole("button", { name: "Подключить Telegram" }).click();
  await page.getByRole("button", { name: "＋ Новый чат" }).click();
  await page.getByLabel("Номер телефона").fill("+79991234567");
  await page.getByRole("button", { name: "Открыть чат" }).click();
  await page.getByLabel("Сообщение", { exact: true }).fill("Привет!");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();

  await expect(page.getByText("Принято API")).toBeVisible();
  await expect(
    page.getByText("Ответ из Telegram", { exact: true }).last(),
  ).toBeVisible();
  await expect.poll(() => ack).toBe(true);
  await page.screenshot({
    path: "test-results/chat-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByLabel("Сообщение", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/chat-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Назад к чатам" }).click();
  await page.getByRole("button", { name: /@test/ }).click();
  await page
    .getByLabel("Сообщение", { exact: true })
    .fill("Сохранённый черновик");
  await page.getByRole("button", { name: "Назад к чатам" }).click();
  await page.getByRole("button", { name: /@test/ }).click();

  await expect(page.getByLabel("Сообщение", { exact: true })).toHaveValue(
    "Сохранённый черновик",
  );
  await page.getByRole("button", { name: "Назад к чатам" }).click();
  await page.getByRole("button", { name: "Выйти" }).click();

  await expect(page.getByLabel("Токен API")).toHaveValue("");
  await expect(
    page.getByText("Ответ из Telegram", { exact: true }),
  ).toHaveCount(0);
});
