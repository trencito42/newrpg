# Localization architecture

Sunset supports English (`en`) and Romanian (`ro`) per account. `DefaultLanguage = 'en'` applies only to new accounts and invalid legacy values; it is never a global runtime switch.

## Data flow

1. Migration `sql/62-account-language.sql` adds `accounts.language`.
2. Authentication loads and validates the language into the server-side player object and replicated `sunsetLocale` state.
   Before authentication, the dedicated login UI sends its locally cached locale through `sunset:setConnectionLocale`; this changes only that connection's error language and never writes an account preference.
3. `sunset:client:playerReady` sets the local language before other ready handlers run.
4. A language change is validated and persisted by `sunset:setLocale`, then sent to the owning client with `sunset:client:localeChanged`.
5. The client sends only the locale code to the NUI. The NUI dictionaries are loaded once by `web/js/i18n.js`.

Two players can therefore receive the same system event in different languages. Never use a global locale for runtime presentation.

## APIs

Server, from `sunset_core`:

```lua
exports.sunset_core:GetPlayerLocale(source)
exports.sunset_core:TFor(source, 'property.purchase.success', { property = property.label, price = price })
exports.sunset_core:SetPlayerLocale(source, 'ro')
exports.sunset_core:NotifyFor(source, 'permission_denied', nil, 'error')
exports.sunset_core:BroadcastLocalized('payday.received', { amount = amount }, 'success')
```

System broadcasts must be rendered inside a recipient loop. Player-written messages, advertisements, names, plates, clan names, and custom descriptions must not be translated.

Client:

```lua
exports.sunset_core:GetLocale()
exports.sunset_core:Translate('property_locked')
exports.sunset_core:SetLocale('ro')
```

NUI:

```js
I18n.t('property.purchase.success', { property: label, price })
I18n.plural('property.tenant_count', count)
I18n.money(price)
I18n.distance(metres)
I18n.setLocale('ro')
```

Static HTML uses `data-i18n`, `data-i18n-placeholder`, `data-i18n-title`, and `data-i18n-aria`. Dynamic fragments are translated automatically after mounting. Dynamic JavaScript must call `I18n.t`; parameters inserted into HTML must still be escaped.

## Adding text or a language

Add the same semantic key to both `shared/locales/en.lua` and `shared/locales/ro.lua`. Prefer named placeholders such as `{name}` and keep their sets identical. Add NUI-only presentation keys to both dictionaries in `web/js/i18n.js`. Reuse `common.*` only where meaning and grammar are genuinely identical.

To add a language, create its Lua table, add its NUI dictionary, add the code to `Sunset.ValidLocales`, update the server whitelist, migration constraint policy, and settings selector. Never store translated labels as gameplay state.

Run:

```bash
node scripts/check-locales.js
node scripts/audit-localization.js
```

Missing keys visibly render as `[?key]` and warn in the NUI console. Production keeps running, but the parity validator must pass before deployment.

## Plurals

Lua uses `Sunset.TPlural(locale, 'property.tenant_count', count, params)` and keys ending in `.one` / `.other`. NUI uses `I18n.plural`. English and Romanian currently use the same one/other rule; add a locale-specific rule before introducing a language that needs more plural categories.
