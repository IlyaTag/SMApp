import { useEffect, useState } from "react";
import { logout, useAppDispatch, useAppSelector } from "../app/store";
import { actions } from "../entities/state";
import { ConnectForm } from "../features/connect-instance/ConnectForm";
import { CreateChat } from "../features/create-chat/CreateChat";
import { Composer } from "../features/send-message/Composer";
import { MessageList } from "./MessageList";
import styles from "./App.module.scss";

function NetworkHint() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);

    window.addEventListener("online", update);
    window.addEventListener("offline", update);

    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return !online ? (
    <p role="status" className={styles.network}>
      Браузер сообщает об отсутствии сети
    </p>
  ) : null;
}

export function App() {
  const state = useAppSelector((s) => s.chat);
  const dispatch = useAppDispatch();
  const [creating, setCreating] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  if (!state.connected)
    return (
      <>
        <NetworkHint />
        <ConnectForm />
      </>
    );

  const all = Object.values(state.messages.entities);
  const last = (id: string) =>
    all.filter((m) => m.chatId === id).sort((a, b) => b.time - a.time)[0];
  const chats = Object.values(state.chats).sort(
    (a, b) => (last(b.chatId)?.time ?? 0) - (last(a.chatId)?.time ?? 0),
  );
  const active = state.chats[state.activeChat];
  const messages = all
    .filter((m) => m.chatId === state.activeChat)
    .sort((a, b) => a.time - b.time);

  return (
    <main className={`${styles.app} ${active ? styles.hasActive : ""}`}>
      <aside className={styles.sidebar} aria-label="Чаты">
        <header className={styles.sidebarHeader}>
          <div className={styles.row}>
            <div className={styles.logo}>➤</div>
            <div>
              <h1>Telegram</h1>
              <span className={styles.eyebrow}>ЧЕРЕЗ GREEN-API</span>
            </div>
            <button
              className={styles.logout}
              onClick={() => {
                setCreating(false);
                setDrafts({});
                logout();
              }}
            >
              Выйти
            </button>
          </div>
        </header>
        <div className={styles.sidebarBody}>
          <button
            className={styles.newChatButton}
            onClick={() => setCreating((v) => !v)}
          >
            ＋ Новый чат
          </button>
          {creating && <CreateChat onClose={() => setCreating(false)} />}
          <div className={styles.sectionLabel}>
            СООБЩЕНИЯ <span>{chats.length}</span>
          </div>
          {!chats.length && (
            <div className={styles.noChats}>
              <span aria-hidden="true">☏</span>
              <h2>Пока нет чатов</h2>
              <p>
                Добавьте собеседника по номеру
                <br />
                или дождитесь входящего сообщения.
              </p>
            </div>
          )}
          <nav aria-label="Список чатов">
            {chats.map((chat) => (
              <button
                key={chat.chatId}
                className={`${styles.chatItem} ${chat.chatId === state.activeChat ? styles.selected : ""}`}
                onClick={() => dispatch(actions.select(chat.chatId))}
              >
                <span className={styles.avatar}>
                  {chat.name.replace("@", "").slice(0, 2).toUpperCase()}
                </span>
                <span className={styles.chatCopy}>
                  <strong>{chat.name}</strong>
                  <span>{last(chat.chatId)?.text || "Нет сообщений"}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
        <footer className={styles.sidebarFooter}>
          <span className={styles.statusDot} />
          <span role="status">{state.receiver}</span>
          {!navigator.locks && <span>Используйте одну рабочую вкладку.</span>}
        </footer>
      </aside>
      <section className={styles.conversation} aria-label="Переписка">
        <NetworkHint />
        {active ? (
          <>
            <header className={styles.chatHeader}>
              <button
                className={`${styles.iconButton} ${styles.back}`}
                aria-label="Назад к чатам"
                onClick={() => dispatch(actions.select(""))}
              >
                ←
              </button>
              <span className={styles.avatar}>
                {active.name.replace("@", "").slice(0, 2).toUpperCase()}
              </span>
              <div>
                <h2>{active.name}</h2>
                <p>Личный чат · Telegram</p>
              </div>
            </header>
            {state.instance !== "authorized" && (
              <p role="alert" className={styles.error}>
                Инстанс: {state.instance}. Проверьте авторизацию в кабинете и
                переподключитесь.
              </p>
            )}
            {state.chatErrors[active.chatId] && (
              <p role="alert" className={styles.error}>
                {state.chatErrors[active.chatId]}
              </p>
            )}
            <MessageList key={active.chatId} messages={messages} />
            <Composer
              chatId={active.chatId}
              drafts={drafts}
              setDrafts={setDrafts}
            />
          </>
        ) : (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>➤</div>
            <h2>Место для ваших разговоров</h2>
            <p>
              Выберите чат слева или начните новый,
              <br />
              указав номер телефона собеседника.
            </p>
            <button
              className={styles.primary}
              onClick={() => setCreating(true)}
            >
              ＋ Начать разговор
            </button>
            <span className={styles.sessionNote}>
              История хранится только в этой сессии
            </span>
          </div>
        )}
      </section>
      <div className={styles.srOnly} aria-live="polite">
        {messages.length ? `Сообщений в чате: ${messages.length}` : ""}
      </div>
    </main>
  );
}
