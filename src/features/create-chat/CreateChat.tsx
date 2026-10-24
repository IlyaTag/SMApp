import { useState, type FormEvent } from "react";
import { useAppDispatch } from "../../app/store";
import { actions } from "../../entities/state";
import { greenApi } from "../../shared/api/greenApi";
import { getSession, isCurrent } from "../../shared/session";
import { normalizePhone } from "../../shared/validation";
import styles from "../../pages/App.module.scss";

export function CreateChat({ onClose }: { onClose: () => void }) {
  const dispatch = useAppDispatch();
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const [check, { isLoading }] = greenApi.useCheckMutation();

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (isLoading) return;

    setError("");

    try {
      const phone = normalizePhone(number);
      const session = getSession();
      const result = await check({ generation: session.generation, phone });

      if (!isCurrent(session)) return;

      if (result.error)
        throw new Error(
          "message" in result.error
            ? String(result.error.message)
            : "Ошибка поиска.",
        );

      if (!result.data.exist)
        throw new Error(
          "Не удалось найти Telegram-аккаунт по этому номеру. Проверьте номер и настройки приватности получателя.",
        );

      if (!result.data.chatId)
        throw new Error("API не вернул идентификатор получателя.");

      dispatch(
        actions.upsertChat({
          chatId: result.data.chatId,
          name: result.data.username || phone,
          phone,
        }),
      );
      dispatch(actions.select(result.data.chatId));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка поиска.");
    }
  }

  return (
    <form onSubmit={submit} className={styles.newChat}>
      <div className={styles.row}>
        <h2>Новый чат</h2>
        <button
          type="button"
          className={styles.iconButton}
          aria-label="Закрыть форму"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <label>
        Номер телефона
        <input
          autoFocus
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+7 999 123-45-67"
          required
        />
      </label>
      <p className={styles.note}>Международный номер с кодом страны</p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <button className={styles.primary} disabled={isLoading}>
        {isLoading ? "Ищем…" : "Открыть чат"}
      </button>
    </form>
  );
}
