# Контракт и статус интеграции

Документация просмотрена 22 октября 2026 года. Выбран путь **SPA → GREEN-API HTTPS**. Доступность CORS не объявляется подтверждённой; UI показывает сетевую ошибку, если браузер блокирует запрос. Нужен BFF, если интеграционная проверка выявит ограничения POST/DELETE. Реальная отправка и удаление уведомлений при разработке не выполнялись: тестовый получатель не согласован.

API URL задан пользователем: `https://4100.api.green-api.com`. Хост не вычисляется из идентификатора. Форма допускает HTTPS-хосты под `green-api.com`, без пути, порта и userinfo. Личные реквизиты сюда не записываются.

Префикс: `{apiUrl}/waInstance{idInstance}`. Токен подставляется transport только из снимка текущей сессии.

| Метод  | Путь                                             | Проверяемые поля                                                                           |
| ------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| GET    | `/getStateInstance/{token}`                      | stateInstance: authorized                                                                  |
| GET    | `/getSettings/{token}`                           | typeInstance: telegram; webhookUrl пуст; incomingWebhook/outgoingWebhook/stateWebhook: yes |
| POST   | `/checkAccount/{token}`                          | body: phoneNumber integer; response: exist, chatId, optional username                      |
| POST   | `/sendMessage/{token}`                           | body: chatId, message; response: idMessage                                                 |
| GET    | `/receiveNotification/{token}?receiveTimeout=25` | null/пустое тело либо receiptId и body                                                     |
| DELETE | `/deleteNotification/{token}/{receiptId}`        | result boolean, optional reason                                                            |

Пустое тело допустимо только у receive. Невалидный JSON или поддерживаемый текст с неверной структурой останавливают приём без ACK. Сырые ошибки провайдера и GetSettings не помещаются в Redux: ответ verify содержит только состояние.

Обезличенный текстовый envelope:

```json
{
  "receiptId": 12,
  "body": {
    "typeWebhook": "incomingMessageReceived",
    "instanceData": { "idInstance": 4100000000, "typeInstance": "telegram" },
    "timestamp": 1763115112,
    "idMessage": "example-id",
    "senderData": { "chatId": "10000000", "chatName": "Собеседник" },
    "messageData": {
      "typeMessage": "textMessage",
      "textMessageData": { "textMessage": "Пример" }
    }
  }
}
```

Для extendedTextMessage используется `extendedTextMessageData.text`. Положительный числовой chatId без chatType принимается как личный; отрицательные/group chatId игнорируются. Составной ключ сообщения: instance + chatId + direction + idMessage. Статусы могут предшествовать send response; сопоставляются после получения idMessage. Статус без idMessage отображается для чата.

Последовательность receive/process/delete не зависит от активного чата. При сетевой ошибке DELETE сохраняется receipt; повторяется только ACK. При result:false выполняется сверка следующего receive; три отклонённых ACK одного receipt останавливают цикл. Неподдерживаемые корректные события и исходящие эхо подтверждаются без добавления сообщения.

Backoff: экспоненциально 1–30 секунд с jitter, Retry-After учитывается; для доступа/контракта автоматические повторы прекращаются. Таймаут receive 35 секунд при upstream ожидании 25 секунд. Logout отменяет сессию и проверяется перед обработкой и ACK.

## Что подтвердить на выделенном инстансе

1. GET, JSON POST и DELETE из будущего origin, включая preflight и доступность Retry-After.
2. Состояние, настройки, фактический пустой receive и оба варианта текста.
3. По согласованному номеру: CheckAccount → send → ответ в Telegram → receive → delete.
4. Текст со ссылкой, длинный Unicode, активный/неактивный чат и обрыв сети.

## Источники

- [SendMessage](https://green-api.com/telegram/docs/api/sending/SendMessage/)
- [CheckAccount](https://green-api.com/telegram/docs/api/service/CheckAccount/)
- [ReceiveNotification](https://green-api.com/telegram/docs/api/receiving/technology-http-api/ReceiveNotification/)
- [DeleteNotification](https://green-api.com/telegram/docs/api/receiving/technology-http-api/DeleteNotification/)
- [GetSettings](https://green-api.com/telegram/docs/api/account/GetSettings/)
- [Текст](https://green-api.com/telegram/docs/api/receiving/notifications-format/incoming-message/TextMessage/)
- [Статусы](https://green-api.com/telegram/docs/api/receiving/notifications-format/statuses/OutgoingMessageStatus/)
