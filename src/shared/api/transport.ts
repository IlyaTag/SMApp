import type { Session } from "../session";
import { ContractError } from "./contracts";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter = 0,
  ) {
    super(message);
  }
}

export type Method =
  | "getStateInstance"
  | "getSettings"
  | "checkAccount"
  | "sendMessage"
  | "receiveNotification"
  | "deleteNotification";

export async function request(
  session: Session,
  method: Method,
  options: { body?: unknown; receiptId?: number; signal?: AbortSignal } = {},
): Promise<unknown> {
  const timeout = AbortSignal.timeout(
    method === "receiveNotification" ? 35000 : 20000,
  );
  const signal = AbortSignal.any([
    session.signal,
    timeout,
    ...(options.signal ? [options.signal] : []),
  ]);
  const suffix =
    method === "receiveNotification"
      ? "?receiveTimeout=25"
      : method === "deleteNotification"
        ? `/${options.receiptId}`
        : "";

  try {
    const response = await fetch(
      `${session.apiUrl}/waInstance${session.idInstance}/${method}/${encodeURIComponent(session.token)}${suffix}`,
      {
        method:
          method === "deleteNotification"
            ? "DELETE"
            : options.body
              ? "POST"
              : "GET",
        headers: options.body
          ? { "Content-Type": "application/json" }
          : undefined,
        body: options.body ? JSON.stringify(options.body) : undefined,
        credentials: "omit",
        referrerPolicy: "no-referrer",
        signal,
      },
    );

    if (!response.ok) {
      const header = response.headers.get("Retry-After");
      const retryAfter = header
        ? Math.max(
            0,
            Number(header) * 1000 || Date.parse(header) - Date.now() || 0,
          )
        : 0;

      throw new ApiError(
        response.status,
        response.status === 429
          ? "Лимит запросов API. Подождите перед повтором."
          : [401, 403].includes(response.status)
            ? "Нет доступа. Проверьте реквизиты и состояние инстанса."
            : `API вернул ошибку ${response.status}. Проверьте настройки инстанса.`,
        retryAfter,
      );
    }

    const text = await response.text();

    if (!text.trim()) {
      if (method === "receiveNotification") return null;

      throw new ContractError();
    }

    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ContractError();
    }
  } catch (error) {
    if (error instanceof ApiError || error instanceof ContractError)
      throw error;

    if (session.signal.aborted || options.signal?.aborted)
      throw new ApiError(-1, "Операция отменена.");

    throw new ApiError(
      0,
      "Сеть или таймаут. Проверьте подключение и доступность API из браузера (CORS).",
    );
  }
}

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Отменено"));

      return;
    }

    const abort = () => {
      clearTimeout(timer);
      reject(new Error("Отменено"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, ms);

    signal.addEventListener("abort", abort, { once: true });
  });
}
