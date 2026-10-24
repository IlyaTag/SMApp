import { describe, expect, it } from "vitest";
import { normalizePhone, validText } from "../shared/validation";
import { ContractError, extractText } from "../shared/api/contracts";
import { chatSlice, actions, externalKey } from "../entities/state";

describe("validation and message reconciliation", () => {
  it("normalizes international phone without assuming country", () => {
    expect(normalizePhone("+7 (999) 123-45-67")).toBe("+79991234567");
    expect(() => normalizePhone("9991234567")).toThrow();
  });

  it("rejects whitespace and over-limit Unicode conservatively", () => {
    expect(validText(" \n ")).toBe(false);
    expect(validText("a".repeat(4096))).toBe(true);
    expect(validText("🙂".repeat(2049))).toBe(false);
  });

  it("extracts both text variants and rejects malformed supported text", () => {
    expect(
      extractText({
        typeMessage: "textMessage",
        textMessageData: { textMessage: "<script>x</script>" },
      }),
    ).toBe("<script>x</script>");
    expect(
      extractText({
        typeMessage: "extendedTextMessage",
        extendedTextMessageData: { text: "https://example.com" },
      }),
    ).toBe("https://example.com");
    expect(() => extractText({ typeMessage: "textMessage" })).toThrow(
      ContractError,
    );
    expect(extractText({ typeMessage: "imageMessage" })).toBeUndefined();
  });

  it("deduplicates by chat and direction rather than message ID alone", () => {
    const m = {
      localId: "one",
      chatId: "a",
      idMessage: "same",
      text: "text",
      direction: "in" as const,
      time: 1,
      status: "accepted" as const,
    };
    let s = chatSlice.reducer(undefined, actions.addMessage(m));

    s = chatSlice.reducer(
      s,
      actions.addMessage({ ...m, localId: "duplicate" }),
    );
    s = chatSlice.reducer(
      s,
      actions.addMessage({ ...m, localId: "other", chatId: "b" }),
    );

    expect(s.messages.ids).toEqual(["one", "other"]);
    expect(externalKey("1", "a", "in", "same")).not.toBe(
      externalKey("2", "a", "in", "same"),
    );
  });

  it("applies a status that arrives before send resolves and avoids read regression", () => {
    let s = chatSlice.reducer(
      undefined,
      actions.addMessage({
        localId: "local",
        chatId: "a",
        text: "Hi",
        direction: "out",
        time: 1,
        status: "sending",
      }),
    );

    s = chatSlice.reducer(
      s,
      actions.providerStatus({
        chatId: "a",
        idMessage: "remote",
        status: "read",
      }),
    );
    s = chatSlice.reducer(
      s,
      actions.sendResult({
        localId: "local",
        idMessage: "remote",
        status: "accepted",
      }),
    );
    s = chatSlice.reducer(
      s,
      actions.providerStatus({
        chatId: "a",
        idMessage: "remote",
        status: "delivered",
      }),
    );

    expect(s.messages.entities.local.status).toBe("read");
  });
});
