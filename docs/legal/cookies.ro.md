# Politica privind cookie-urile RACKET RPG

**Versiune:** 1.0  
**Data intrării în vigoare:** 7 octombrie 2026  
**Contact:** support@racket.cat

Această Politică explică modul în care **racket.cat** utilizează cookie-uri și tehnologii similare de stocare în browser.

## 1. Ce sunt cookie-urile

Cookie-urile sunt mici fragmente de date stocate de browser. Ele pot fi folosite pentru menținerea autentificării, memorarea preferințelor, securitate sau, în anumite servicii, pentru analiză și publicitate.

RACKET utilizează în prezent cookie-uri first-party pentru autentificare și preferința de limbă.

## 2. Cookie-urile utilizate în prezent de RACKET

| Cookie | Scop | Tip | Durată tipică |
|---|---|---|---|
| `sunset_panel_session` | Menține utilizatorul autentificat în panelul RACKET. Tokenul brut al sesiunii este stocat în browser, iar pe server se păstrează hash-ul acestuia. | Strict necesar | Până la 14 zile |
| `sunset_panel_locale` | Memorează limba panelului pentru vizitatorii neautentificați și sincronizează limba contului după autentificare. | Preferință / funcțional | Până la 1 an |

Ambele cookie-uri sunt configurate cu `SameSite=Lax`. În producție sunt configurate ca secure. Cookie-ul de autentificare este și `HttpOnly`, ceea ce înseamnă că JavaScript-ul executat în browser nu îl poate citi.

## 3. Cookie-uri strict necesare

Cookie-ul de sesiune este necesar pentru funcțiile autentificate ale panelului și pentru securitatea contului.

Fiind necesar pentru furnizarea unui serviciu solicitat în mod explicit, nu este folosit pentru publicitate și nu este opțional cât timp dorești să rămâi autentificat.

Deconectarea șterge cookie-ul de sesiune din browser și revocă sesiunea activă corespunzătoare pe server.

## 4. Cookie-uri de preferințe

Cookie-ul de limbă memorează dacă folosești interfața în română sau engleză.

Nu este folosit pentru publicitate sau urmărire între site-uri.

Dacă îl ștergi când nu ești autentificat, site-ul poate reveni la limba implicită până când alegi din nou limba.

## 5. Analiză și publicitate

La data intrării în vigoare a acestei Politici, codul RACKET **nu setează în mod intenționat cookie-uri first-party pentru publicitate sau urmărire comportamentală** în panel.

Dacă introducem ulterior analiză opțională, publicitate sau altă categorie de cookie-uri neesențiale, vom actualiza Politica și, atunci când legea o cere, vom solicita consimțământul înainte de setarea lor.

## 6. Servicii terțe

Atunci când accesezi sau interacționezi cu un serviciu terț, precum un furnizor autorizat de plăți, Discord, Cfx.re/FiveM sau alt website extern, acel furnizor poate seta propriile cookie-uri pe propriul domeniu.

Aceste cookie-uri sunt controlate de terț și sunt guvernate de documentația sa privind cookie-urile și confidențialitatea.

## 7. Administrarea cookie-urilor

Poți administra sau șterge cookie-urile din setările browserului.

Blocarea cookie-ului de autentificare va împiedica funcționarea corectă a funcțiilor autentificate ale panelului.

Ștergerea cookie-ului de limbă va elimina preferința de limbă salvată pentru utilizatorul neautentificat.

## 8. Consimțământ

Nu folosim un banner de consimțământ doar pentru a obține acordul pentru cookie-uri strict necesare furnizării unui serviciu solicitat.

Dacă vor fi introduse cookie-uri neesențiale, vom implementa mecanismele de consimțământ cerute de lege înainte de activarea lor pentru utilizatorii pentru care este necesar acordul.

## 9. Modificarea Politicii

Putem actualiza această Politică atunci când se schimbă cookie-urile, furnizorii sau obligațiile legale.

Data intrării în vigoare va fi actualizată la modificarea documentului.

## 10. Contact

Întrebări despre cookie-uri sau confidențialitate:

**RACKET RPG**  
Email: **support@racket.cat**  
Website: **https://racket.cat**
