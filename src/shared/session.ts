export type Credentials = { apiUrl: string; idInstance: string; token: string };

export type Session = Readonly<
  Credentials & { generation: number; signal: AbortSignal }
>;

let current: Session | undefined;
let generation = 0;
let controller = new AbortController();

export function clearSession() {
  controller.abort();
  controller = new AbortController();
  current = undefined;
  generation++;
}

export function openSession(credentials: Credentials): Session {
  clearSession();

  const url = new URL(credentials.apiUrl);

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".green-api.com") ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error(
      "Укажите HTTPS API URL инстанса на домене green-api.com, без пути.",
    );

  if (!/^\d+$/.test(credentials.idInstance) || !credentials.token.trim())
    throw new Error("Укажите цифровой idInstance и непустой токен.");

  current = Object.freeze({
    ...credentials,
    apiUrl: url.origin,
    generation,
    signal: controller.signal,
  });

  return current;
}

export function getSession(expectedGeneration?: number): Session {
  if (
    !current ||
    (expectedGeneration !== undefined &&
      current.generation !== expectedGeneration)
  )
    throw new Error("Сессия завершена.");

  return current;
}

export function isCurrent(session: Session) {
  return current === session && !session.signal.aborted;
}
