import { useRef, type Dispatch, type SetStateAction } from "react";
import { useAppDispatch, useAppSelector } from "../../app/store";
import { actions, type MessageStatus } from "../../entities/state";
import { greenApi } from "../../shared/api/greenApi";
import { getSession, isCurrent } from "../../shared/session";
import { MAX_TEXT_LENGTH, validText } from "../../shared/validation";
import styles from "../../pages/App.module.scss";

export function Composer({
  chatId,
  drafts,
  setDrafts,
}: {
  chatId: string;
  drafts: Record<string, string>;
  setDrafts: Dispatch<SetStateAction<Record<string, string>>>;
}) {
  const dispatch = useAppDispatch();
  const [send] = greenApi.useSendMutation();
  const text = drafts[chatId] ?? "";
  const busy = useAppSelector((s) =>
    Object.values(s.chat.messages.entities).some(
      (m) => m.chatId === chatId && m.status === "sending",
    ),
  );
  const blocked = useAppSelector((s) => s.chat.instance !== "authorized");
  const inFlight = useRef(new Set<string>());

  async function submit() {
    if (!validText(text) || inFlight.current.has(chatId) || busy || blocked)
      return;

    const session = getSession();
    const localId = crypto.randomUUID();
    const target = chatId;
    const original = text;

    inFlight.current.add(target);
    dispatch(
      actions.addMessage({
        localId,
        chatId: target,
        direction: "out",
        text: original,
        time: Date.now(),
        status: "sending",
      }),
    );
    setDrafts((d) => ({ ...d, [target]: "" }));

    try {
      const result = await send({
        generation: session.generation,
        chatId: target,
        message: original,
      });

      if (!isCurrent(session)) return;

      if ("data" in result && result.data)
        dispatch(
          actions.sendResult({
            localId,
            idMessage: result.data.idMessage,
            status: "accepted",
          }),
        );
      else {
        const status: MessageStatus =
          result.error &&
          "status" in result.error &&
          Number(result.error.status) >= 400 &&
          Number(result.error.status) < 500
            ? "failed"
            : "unknown";

        dispatch(actions.sendResult({ localId, status }));
      }
    } finally {
      inFlight.current.delete(target);
    }
  }

  return (
    <div className={styles.composerWrap}>
      <form
        className={styles.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <textarea
          aria-label="Сообщение"
          placeholder="Написать сообщение…"
          value={text}
          rows={1}
          onChange={(e) =>
            setDrafts((d) => ({ ...d, [chatId]: e.target.value }))
          }
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          className={styles.sendButton}
          aria-label="Отправить"
          disabled={!validText(text) || busy || blocked}
        >
          ➤
        </button>
      </form>
      <div className={styles.composerHint}>
        <span>Enter — отправить · Shift+Enter — новая строка</span>
        <span className={text.length > MAX_TEXT_LENGTH ? styles.error : ""}>
          {text.length} / {MAX_TEXT_LENGTH}
        </span>
      </div>
    </div>
  );
}
