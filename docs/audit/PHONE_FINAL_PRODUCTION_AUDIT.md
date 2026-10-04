# Phone final production audit

Scope is the live call session, Messages, presentation, and phone photos. Scoreboard work on `48821875` is out of scope.

## Fixed

### P0 — Camera upload rejected

- FILE: `panel/src/app/api/media/upload/route.ts`
- FUNCTION: `POST`
- WHY: `phone_photo` was not a handled media type. A real multipart upload returned HTTP 400 `Invalid upload parameters`. An empty body threw inside `formData()` and became HTTP 500.
- PLAYER IMPACT: Every camera shutter showed "Poza nu a putut fi incarcata."
- FIX: Store jpeg/png/webp under `public/media/phone/` and return `https://racket.cat/media/phone/<32 hex>.<ext>` plus mime and size. The game token must be 48 hex characters. Bytes stay on disk.
- TEST: `panel/tests/phone-photo.test.ts`. Live retry is a camera shutter after the panel process is rebuilt.

### P1 — Voice was a one-shot join

- FILE: `resources/[sunset]/sunset_phone/server/calls.lua`
- FUNCTION: `sunset:phoneCallAnswer`, `sunset:phoneCallSetVoice`, `PhoneCalls.applySavedVoice`
- WHY: Answer called `setPlayerCall` for both players whenever the preference was on, and every join re-read MySQL. There was no per-call runtime flag and no toggle.
- PLAYER IMPACT: Voice could not be turned off without hanging up. A settings change during a call did nothing until the next call.
- FIX: `callerVoice` / `calleeVoice` live on the call. The preference is read once at answer and when settings are saved. Toggle sends only a boolean. The channel stays server-side. `finish` always clears both pma calls.
- TEST: `resolveVoice` cases in `phone-state.test.js`.

### P1 — Phone line could show, then fail

- FILE: `resources/[sunset]/sunset_chat/server/main.lua`
- FUNCTION: `deliverPhoneCall`
- WHY: The sender was emitted before the peer was checked against the same call and character.
- PLAYER IMPACT: The sender could see a `[PHONE]` line and then "message not sent", or a recycled source could receive the text.
- FIX: Both `GetActiveCallContext` results must be active, the same call id, and point at each other before either client is notified.
- TEST: routing cases in `phone-state.test.js` and `scripts/test-phone-e2e.js`.

### P1 — Empty composer said the draft was dropped

- FILE: `resources/[sunset]/sunset_chat/client/main.lua`, `resources/[sunset]/sunset_ui/web/js/chat.js`
- FUNCTION: `sunset:chat:phoneCallEnded`, `Chat.applyPhoneContext`
- WHY: Any open chat during hangup injected "Message not sent" even when the input was empty.
- PLAYER IMPACT: Players who had not typed anything still saw a failure. A real draft could also be sent locally on the next Enter.
- FIX: Empty input only gets the server "Call ended." line. A non-empty draft or attachment is kept, the composer leaves PHONE, and the next Enter is swallowed once.
- TEST: `phoneDraftOnEnd`.

## Left as live checks

### P2 — pma-voice restart does not rejoin

- FILE: `resources/[sunset]/sunset_phone/server/calls.lua`
- FUNCTION: `onResourceStop` for `pma-voice`
- WHY: Rejoining a channel after pma restarts can attach a player to a stale call channel.
- PLAYER IMPACT: Voice drops until the player presses Voice on again. The call, timer, and T chat stay up.
- FIX: Flags go false and both clients are pushed `voiceAvailable: false`. No automatic reconnect.
- TEST: Needs two clients and a resource restart.

### P2 — 4K scale was not rendered

- FILE: `resources/[sunset]/sunset_ui/web/css/phone.css`
- WHY: Peek is `translateY(60%)` on `.phone-device` while `.phone-hardware` owns `scale(var(--s))`. Static audit only.
- PLAYER IMPACT: Unknown until a 4K client looks at FULL and PEEK.
- TEST: `scripts/test-phone-e2e.js` peek selector. Not a live 4K pass.

### P3 — Migrations 80, 86, 88, 89

Already applied on this host, in order, idempotent. `89` adds `voice_calls` only when `phone_character_prefs` exists from `84` and the column is missing. Default is 1. Do not edit those files.

## Security notes kept

Clients cannot send a call id, pma channel, or peer source. `/hangup` and voice toggle resolve the source's own call. Chat mute and the 350ms chat bucket still run before phone routing. Voice toggle is rate-limited at 400ms.
