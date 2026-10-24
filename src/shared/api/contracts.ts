import { z } from "zod";

export class ContractError extends Error {
  constructor(
    message = "Несовместимый ответ API. Приём приостановлен без удаления уведомления.",
  ) {
    super(message);
  }
}

export function decode<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) throw new ContractError();

  return result.data;
}

export const identifier = z
  .union([z.string().min(1), z.number().int().safe()])
  .transform(String);

export const stateSchema = z.object({ stateInstance: z.string() });

export const settingsSchema = z.object({
  typeInstance: z.literal("telegram"),
  webhookUrl: z.string(),
  incomingWebhook: z.string(),
  outgoingWebhook: z.string(),
  stateWebhook: z.string(),
});

export const accountSchema = z.object({
  exist: z.boolean(),
  chatId: z.string(),
  username: z.string().optional(),
});

export const sendSchema = z.object({ idMessage: z.string().min(1) });

export const ackSchema = z.object({
  result: z.boolean(),
  reason: z.string().optional(),
});

export const envelopeSchema = z.object({
  receiptId: z.number().int().safe().positive(),
  body: z
    .object({
      typeWebhook: z.string(),
      instanceData: z.object({
        idInstance: identifier,
        typeInstance: z.literal("telegram"),
      }),
    })
    .passthrough(),
});

export const incomingSchema = z.object({
  idMessage: z.string().min(1),
  timestamp: z.number().nonnegative(),
  senderData: z.object({
    chatId: z.string().min(1),
    chatType: z.string().optional(),
    chatName: z.string().optional(),
    senderName: z.string().optional(),
  }),
  messageData: z.object({ typeMessage: z.string() }).passthrough(),
});

export function extractText(
  data: z.infer<typeof incomingSchema>["messageData"],
): string | undefined {
  if (data.typeMessage === "textMessage")
    return decode(
      z.object({ textMessageData: z.object({ textMessage: z.string() }) }),
      data,
    ).textMessageData.textMessage;

  if (data.typeMessage === "extendedTextMessage")
    return decode(
      z.object({ extendedTextMessageData: z.object({ text: z.string() }) }),
      data,
    ).extendedTextMessageData.text;
}

export const statusSchema = z.object({
  chatId: z.string(),
  idMessage: z.string().optional(),
  status: z.string(),
});
