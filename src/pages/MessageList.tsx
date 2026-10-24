import { useEffect, useRef, useState } from "react";
import type { Message } from "../entities/state";
import styles from "./App.module.scss";

const statusLabels: Record<string, string> = {
  sending: "Отправляется",
  accepted: "Принято API",
  failed: "Ошибка отправки",
  unknown: "Результат неизвестен",
  delivered: "Доставлено",
  read: "Прочитано",
  noAccount: "Получатель недоступен",
};

export function MessageList({ messages }: { messages: Message[] }) {
  const list = useRef<HTMLDivElement>(null);
  const nearEnd = useRef(true);
  const [showDown, setShowDown] = useState(false);

  useEffect(() => {
    if (nearEnd.current && list.current)
      list.current.scrollTop = list.current.scrollHeight;
    else setShowDown(true);
  }, [messages.length]);

  return (
    <div className={styles.timelineWrap}>
      <div
        ref={list}
        className={styles.timeline}
        onScroll={() => {
          const el = list.current;

          if (el) {
            nearEnd.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;

            if (nearEnd.current) setShowDown(false);
          }
        }}
      >
        <div className={styles.historyNotice}>
          История доступна только в текущей сессии
        </div>
        {!messages.length && (
          <div className={styles.emptyMessages}>
            Начните разговор — отправьте первое сообщение
          </div>
        )}
        {messages.map((m) => (
          <article
            key={m.localId}
            className={`${styles.bubble} ${m.direction === "out" ? styles.outgoing : styles.incoming}`}
          >
            <p>{m.text}</p>
            <footer>
              <time dateTime={new Date(m.time).toISOString()}>
                {new Intl.DateTimeFormat("ru", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(m.time)}
              </time>
              {m.direction === "out" && <span>{statusLabels[m.status]}</span>}
            </footer>
            {m.status === "unknown" && (
              <small>
                Запрос мог быть принят. Повторная отправка может создать дубль.
              </small>
            )}
          </article>
        ))}
      </div>
      {showDown && (
        <button
          className={styles.downButton}
          onClick={() => {
            if (list.current)
              list.current.scrollTop = list.current.scrollHeight;

            nearEnd.current = true;
            setShowDown(false);
          }}
        >
          К новым сообщениям ↓
        </button>
      )}
    </div>
  );
}
