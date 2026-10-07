# RACKET RPG Cookie Policy

**Version:** 1.0  
**Effective date:** 7 October 2026  
**Contact:** support@racket.cat

This Cookie Policy explains how **racket.cat** uses cookies and similar browser storage.

## 1. What cookies are

Cookies are small pieces of data stored by your browser. They can be used to keep you signed in, remember preferences, provide security or support optional analytics and advertising features.

RACKET currently uses first-party cookies for authentication and language preference.

## 2. Cookies currently used by RACKET

| Cookie | Purpose | Type | Typical lifetime |
|---|---|---|---|
| `sunset_panel_session` | Keeps an authenticated user signed in to the RACKET panel. The raw session token is stored in the browser; a hash is stored server-side. | Strictly necessary | Up to 14 days |
| `sunset_panel_locale` | Remembers the selected panel language for anonymous visitors and synchronizes the account language after login. | Preference / functional | Up to 1 year |

Both cookies are configured with `SameSite=Lax`. In production they are configured as secure cookies. The authentication cookie is also `HttpOnly`, which means client-side JavaScript cannot read it.

## 3. Strictly necessary cookies

The session cookie is required to provide authenticated panel functions and account security.

Because it is necessary to provide a service you explicitly request, it is not used for advertising and is not optional while you remain signed in.

Logging out removes the browser session cookie and revokes the corresponding active session server-side.

## 4. Preference cookies

The language cookie remembers whether you use the Romanian or English interface.

It is not used for advertising or cross-site tracking.

If you delete it while logged out, the site may return to the default language until you choose another language.

## 5. Analytics and advertising

At the effective date of this Policy, the RACKET codebase does **not intentionally set first-party advertising or behavioral-tracking cookies** on the panel.

If we later introduce optional analytics, advertising or another non-essential cookie category, we will update this Policy and, where required by law, request consent before setting those cookies.

## 6. Third-party services

When you follow a link to or interact with a third-party service, such as an authorized payment provider, Discord, Cfx.re/FiveM or another external website, that provider may set its own cookies on its own domain.

Those cookies are controlled by the third party and are governed by its cookie/privacy documentation.

## 7. Managing cookies

You can manage or delete cookies through your browser settings.

Blocking the authentication cookie will prevent authenticated panel features from working correctly.

Deleting the language cookie will remove the saved anonymous language preference.

## 8. Consent

We do not use a consent banner merely to obtain consent for cookies that are strictly necessary to provide a requested service.

If non-essential cookies are introduced, we will implement the consent controls required by applicable law before activating them for users who must be asked for consent.

## 9. Changes to this Policy

We may update this Cookie Policy when our cookie usage, providers or legal obligations change.

The effective date at the top will be updated when changes are made.

## 10. Contact

Questions about cookies or privacy:

**RACKET RPG**  
Email: **support@racket.cat**  
Website: **https://racket.cat**
