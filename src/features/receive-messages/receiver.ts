import {
  decode,
  envelopeSchema,
  incomingSchema,
  extractText,
  statusSchema,
  stateSchema,
  ackSchema,
  ContractError,
} from "../../shared/api/contracts";
import { ApiError, request, wait } from "../../shared/api/transport";
import { isCurrent, type Session } from "../../shared/session";
import { actions, externalKey } from "../../entities/state";
import type { store } from "../../app/store";

type Dispatch = typeof store.dispatch;

export function processNotification(
  raw: unknown,
  session: Session,
  dispatch: Dispatch,
): number {
  const event = decode(envelopeSchema, raw);
  const body = event.body;

  if (body.instanceData.idInstance !== session.idInstance)
    throw new ContractError();

  if (body.typeWebhook === "stateInstanceChanged") {
    const { stateInstance } = decode(stateSchema, body);

    dispatch(actions.instanceStatus(stateInstance));
  } else if (body.typeWebhook === "outgoingMessageStatus") {
    dispatch(actions.providerStatus(decode(statusSchema, body)));
  } else if (body.typeWebhook === "incomingMessageReceived") {
    const incoming = decode(incomingSchema, body);
    const { senderData: sender } = incoming;

    if (
      (sender.chatType && sender.chatType !== "user") ||
      sender.chatId.startsWith("-") ||
      sender.chatId.endsWith("@g.us")
    )
      return event.receiptId;

    const text = extractText(incoming.messageData);

    if (text !== undefined) {
      dispatch(
        actions.upsertChat({
          chatId: sender.chatId,
          name: sender.chatName || sender.senderName || sender.chatId,
        }),
      );
      dispatch(
        actions.addMessage({
          localId: externalKey(
            session.idInstance,
            sender.chatId,
            "in",
            incoming.idMessage,
          ),
          idMessage: incoming.idMessage,
          chatId: sender.chatId,
          direction: "in",
          text,
          time: incoming.timestamp * 1000,
          status: "accepted",
        }),
      );
    }
  }

  // Valid outgoing echoes and unsupported event types are deliberately acknowledged.
  return event.receiptId;
}

export async function consume(
  session: Session,
  dispatch: Dispatch,
  signal = session.signal,
) {
  const current = () => isCurrent(session) && !signal.aborted;
  let receipt: number | undefined;
  let failures = 0;
  let stopAfterAck = false;
  const rejected = new Map<number, number>();

  while (current()) {
    try {
      if (receipt === undefined) {
        const raw = await request(session, "receiveNotification", { signal });

        if (!current()) return;

        if (raw === null) {
          await wait(350, signal);
          continue;
        }

        const envelope = decode(envelopeSchema, raw);

        if ((rejected.get(envelope.receiptId) ?? 0) >= 3)
          throw new ContractError(
            "Очередь повторяет receipt после трёх отклонённых ACK. Приём остановлен; проверьте другой consumer.",
          );

        receipt = processNotification(raw, session, dispatch);
        stopAfterAck =
          envelope.body.typeWebhook === "stateInstanceChanged" &&
          envelope.body.stateInstance !== "authorized";
      }

      if (!current()) return;

      const ack = decode(
        ackSchema,
        await request(session, "deleteNotification", {
          receiptId: receipt,
          signal,
        }),
      );

      if (!current()) return;

      if (stopAfterAck && ack.result) {
        dispatch(
          actions.receiverStatus(
            "Инстанс не авторизован. Завершите авторизацию в кабинете и переподключитесь.",
          ),
        );

        return;
      }

      if (!ack.result) {
        rejected.set(receipt, (rejected.get(receipt) ?? 0) + 1);
        dispatch(
          actions.receiverStatus(
            "ACK отклонён. Проверяем очередь; при повторении приём остановится.",
          ),
        );
        await wait(1500, signal);
      } else {
        rejected.delete(receipt);
        dispatch(actions.receiverStatus("Приём активен"));
      }

      receipt = undefined;
      failures = 0;
    } catch (error) {
      if (!current()) return;

      dispatch(
        actions.receiverStatus(
          error instanceof Error ? error.message : "Ошибка приёма.",
        ),
      );

      if (
        error instanceof ContractError ||
        (error instanceof ApiError && [400, 401, 403].includes(error.status))
      )
        return;

      const backoff =
        Math.min(30000, 1000 * 2 ** Math.min(failures++, 5)) *
        (0.8 + Math.random() * 0.4);

      await wait(
        Math.max(backoff, error instanceof ApiError ? error.retryAfter : 0),
        signal,
      ).catch(() => {});
    }
  }
}
