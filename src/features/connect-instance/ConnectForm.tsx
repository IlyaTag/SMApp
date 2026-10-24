import { useState, type FormEvent } from "react";
import { useAppDispatch, logout } from "../../app/store";
import { actions } from "../../entities/state";
import { greenApi } from "../../shared/api/greenApi";
import { openSession, isCurrent } from "../../shared/session";
import styles from "../../pages/App.module.scss";

export function ConnectForm() {
  const dispatch = useAppDispatch();
  const [verify] = greenApi.useVerifyMutation();
  const [apiUrl, setApiUrl] = useState(
    import.meta.env.VITE_GREEN_API_URL || "https://4100.api.green-api.com",
  );
  const [idInstance, setId] = useState("");
  const [token, setToken] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function connect(event: FormEvent) {
    event.preventDefault();

    if (pending) return;

    setPending(true);
    setError("");

    try {
      const session = openSession({
        apiUrl: apiUrl.trim(),
        idInstance: idInstance.trim(),
        token: token.trim(),
      });
      const result = await verify(session.generation);

      if (!isCurrent(session)) return;

      if (result.error) {
        logout();
        setError(
          "message" in result.error
            ? String(result.error.message)
            : "Ошибка подключения.",
        );

        return;
      }

      setToken("");
      dispatch(actions.connected(session.generation));
    } catch (e) {
      logout();
      setError(e instanceof Error ? e.message : "Не удалось подключиться.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className={styles.connectPage}>
      <div className={styles.brandMark} aria-hidden="true">
        ➤
      </div>
      <h1>
        Ваш Telegram.
        <br />
        <span>В одном окне.</span>
      </h1>
      <p className={styles.intro}>
        Подключите свой инстанс GREEN-API,
        <br />
        чтобы начать общение.
      </p>
      <form className={styles.connectForm} onSubmit={connect}>
        <label>
          API URL
          <input
            type="url"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            required
            autoComplete="off"
            disabled={pending}
          />
        </label>
        <label>
          ID инстанса
          <input
            value={idInstance}
            onChange={(e) => setId(e.target.value)}
            inputMode="numeric"
            pattern="[0-9]+"
            placeholder="Из личного кабинета GREEN-API"
            required
            disabled={pending}
          />
        </label>
        <label>
          Токен API
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            placeholder="apiTokenInstance"
            required
            disabled={pending}
          />
        </label>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        <button className={styles.primary} disabled={pending}>
          {pending ? "Проверяем подключение…" : "Подключить Telegram →"}
        </button>
      </form>
      <p className={styles.note}>
        Инстанс должен быть авторизован в Telegram.
        <br />
        Токен и история хранятся только до выхода или обновления страницы.
      </p>
      <a href="https://console.green-api.com/" target="_blank" rel="noreferrer">
        Личный кабинет GREEN-API ↗
      </a>
    </main>
  );
}
