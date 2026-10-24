export const demo = {
  apiUrl: "https://test.api.green-api.com",
  idInstance: "4100000000",
  token: "fixture-token",
};

export const incoming = (
  chatId = "10000000",
  idMessage = "message-1",
  text = "Ответ из Telegram",
) => ({
  receiptId: 12,
  body: {
    typeWebhook: "incomingMessageReceived",
    instanceData: {
      idInstance: Number(demo.idInstance),
      typeInstance: "telegram",
    },
    timestamp: 1763115112,
    idMessage,
    senderData: { chatId, chatName: "Собеседник" },
    messageData: {
      typeMessage: "textMessage",
      textMessageData: { textMessage: text },
    },
  },
});
