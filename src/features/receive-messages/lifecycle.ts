import { listener, store } from "../../app/store";
import { actions } from "../../entities/state";
import { getSession, isCurrent } from "../../shared/session";
import { consume } from "./receiver";

let running: Promise<void> = Promise.resolve();

listener.startListening({
  actionCreator: actions.connected,
  effect: () => {
    const session = getSession();

    running = running
      .catch(() => {})
      .then(async () => {
        if (!isCurrent(session)) return;

        const run = async () => {
          store.dispatch(actions.receiverStatus("Приём активен"));
          await consume(session, store.dispatch);
        };

        if (navigator.locks) {
          await navigator.locks.request(
            `green-telegram-${session.idInstance}`,
            { ifAvailable: true },
            async (lock) => {
              if (!isCurrent(session)) return;

              if (lock) await run();
              else
                store.dispatch(
                  actions.receiverStatus(
                    "Приём занят другой вкладкой. Закройте её и переподключитесь.",
                  ),
                );
            },
          );
        } else {
          store.dispatch(
            actions.receiverStatus(
              "Web Locks недоступен: используйте одну рабочую вкладку.",
            ),
          );
          await consume(session, store.dispatch);
        }
      })
      .catch(() => {
        if (isCurrent(session))
          store.dispatch(
            actions.receiverStatus(
              "Не удалось запустить приём. Проверьте поддержку Web Locks и переподключитесь.",
            ),
          );
      });
  },
});
