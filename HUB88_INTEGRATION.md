# Intégration Hub88 — plan de mise en conformité

Hub88 est un agrégateur : les opérateurs (casinos en ligne) accèdent à leur catalogue via
une seule intégration (**Operator API**), les studios de jeu leur fournissent du contenu
via une seule intégration symétrique (**Supplier API**). Chicken Ninja est un jeu — on
s'intègre donc côté **Supplier**, pas Operator.

Sources consultées : `docs.hub88.io/developer-docs` → Fundamentals, Core API Flow, Request
Structure, Private/Public Keys, Supplier API Overview, Wallet API, Games API, Supplier
Games SDK, Freebets API, Rate Limits (accès le 2026-09-04). Les specs exactes de
certification RNG/compliance ne sont pas exposées publiquement dans cette doc — à
demander directement au contact Hub88 (BD/intégration) une fois l'onboarding commercial
lancé.

## Changement architectural n°1 (le plus important)

**Aujourd'hui**, `server/index.js` est self-custodial : `PlayerAccount.balance` /
`.wallet` vivent dans une `Map` en mémoire côté serveur, alimentées par des dépôts/retraits
factices (`DEFAULT_BALANCE = 100`, `DEFAULT_WALLET = 1000`). C'est nous qui sommes
l'autorité sur l'argent du joueur.

**Avec Hub88**, c'est l'inverse : l'**opérateur** est l'autorité sur le solde réel du
joueur. Nous (le supplier) n'avons pas de solde à nous — à chaque mise/gain, on **appelle**
la Wallet API de l'opérateur (via Hub88 comme relais) pour débiter/créditer, et c'est la
réponse de cet appel qui nous dit si l'opération a réussi et quel est le nouveau solde.

Concrètement ça veut dire que le mode "jeu réel via Hub88" et le mode "jeu autonome actuel
(wallet/balance internes)" sont deux chemins différents dans le code, pas une évolution du
même chemin :

- Le mode autonome actuel (`accounts` Map, `wallet:deposit`/`withdraw`, Socket.IO privé)
  reste tel quel pour le produit standalone / démo publique.
- Un nouveau chemin HTTP (endpoints REST signés RSA, décrits plus bas) doit être ajouté
  pour le mode "lancé depuis un opérateur via Hub88" — celui-là ne touche jamais à
  `accounts`, il relaie bet/win vers Hub88.

Le moteur de jeu pur (`src/shared/gameConfig.js` : `computeStepMultiplier`,
`resolveStep`/HMAC, `effectiveRTP`) est réutilisable tel quel dans les deux chemins — c'est
déjà framework-agnostique et sans notion de solde. C'est un point fort de l'architecture
actuelle : aucune réécriture de la maths du jeu n'est nécessaire.

## Ce qu'il faut construire côté Supplier

### 1. Échange de clés RSA (préalable, une fois)

```bash
openssl genrsa -out private.pem 2048
openssl rsa -pubout -in private.pem -out public.pem
```

- On envoie notre clé publique à Hub88, Hub88 nous envoie la sienne.
- **Games API** (`/game/url`, `/game/authorize`, `/game/round`, `/game/list`) : c'est
  Hub88/l'opérateur qui signe les requêtes entrantes vers nous → on vérifie avec la clé
  publique de Hub88.
- **Wallet API** (`/user/balance`, `/transaction/bet|win|rollback`) : c'est **nous** qui
  signons les requêtes sortantes vers Hub88 → avec notre clé privée, RSA-SHA256, corps
  BASE64 dans le header `X-Hub88-Signature`.
- La signature porte sur le corps JSON **octet pour octet** — donc sérialiser une seule
  fois, signer cette sérialisation exacte, l'envoyer telle quelle (pas de re-stringify côté
  transport qui changerait l'ordre des clés/l'espacement).

### 2. Endpoints Games API à exposer (nous répondons à Hub88)

Base : `https://{notre-base-url}/supplier/...` (à confirmer avec Hub88 lors de
l'onboarding — l'exemple doc est `api2.hub88.io/operator/generic/v2/...` côté eux, notre
préfixe à nous sera négocié).

| Endpoint | Rôle | Champs clés |
|---|---|---|
| `POST /game/url` | Retourne l'URL de lancement du jeu | `platform`, `lobby_url`, `lang`, `operator_id`, `currency`, `country`, `game_code`, `user`/`token` optionnels (absents = mode DEMO) |
| `POST /game/round` | Détails d'une partie (page de récap) | `transaction_uuid` ou `round`+`user` |
| `POST /game/list` | Liste des jeux qu'on fournit | retourne `game_code`, `name`, `category`, `platforms`, `blocked_countries` |

Règle critique du Core API Flow : **ne jamais accepter d'appel Wallet API tant qu'on n'a
pas nous-même répondu avec succès à `/game/url`** — sinon Hub88 attend `RS_ERROR_INVALID_TOKEN`
de notre part. Le token de session n'est actif qu'après notre réponse.

Mode DEMO : `currency: "XXX"`, pas de `token`/`user` → pas d'appels Wallet du tout, le
joueur joue en monnaie fictive. C'est proche de ce que fait déjà notre mode standalone
actuel, juste sans les endpoints Wallet réels derrière.

### 3. Endpoints Wallet API à appeler (nous appelons Hub88)

Base réelle donnée en exemple : `https://api.hub88.io/supplier/generic/v2/...`
(régions : `api.hub88.io` EU, `api.as1.hub88.io` Asie, `api.am.hub88.io` LatAm,
`api.stage.hub88.io` staging).

| Endpoint | Quand l'appeler dans notre flow actuel |
|---|---|
| `POST /user/balance` | Avant d'afficher le solde initial du joueur au chargement du jeu |
| `POST /transaction/bet` | Au moment de `session.startRound()` — remplace le débit local `account.balance -= cleanBet` |
| `POST /transaction/win` | Au bust (`win` avec `amount: 0` pour clore le round proprement) et au cashout / auto-cashout sur `lanesRemaining === 0` (`amount` = payout) — remplace le crédit local |
| `POST /transaction/rollback` | Si une mise a été débitée côté opérateur mais que la partie ne peut pas démarrer côté nous (crash serveur, socket coupé avant le premier `round:step`) — annule la transaction `bet` correspondante |

**Format des montants** : entiers en unité mineure ×100000 (ex. `3.56 EUR` → `356000`), pas
de flottant. `computeStepMultiplier`/`bet * multiplier` produisent des floats arrondis à 2
décimales aujourd'hui (`+(this.bet * multiplier).toFixed(2)`) — il faudra une conversion
explicite `Math.round(amountInCurrency * 100000)` juste avant l'appel Wallet, jamais stocker
ce format ×100000 dans la logique de jeu elle-même pour ne pas polluer `gameConfig.js`.

**Idempotence** : chaque appel porte un `request_uuid` (anti-duplication de requête) et les
appels bet/win/rollback portent en plus un `transaction_uuid` (et `reference_transaction_uuid`
pour win/rollback, qui pointe vers le `transaction_uuid` du bet correspondant). Rejouer un
appel avec le même `transaction_uuid` mais des données différentes → `RS_ERROR_DUPLICATE_TRANSACTION`.
Génération : `crypto.randomUUID()` (déjà `import { randomBytes } from 'crypto'` dans
`server/index.js`, `randomUUID` est dans le même module).

**`round`** : Hub88 attend une chaîne identifiant la partie, **stable sur tous les appels
bet/win/rollback d'un même round**, avec `round_closed: true` sur le dernier appel du round
(bust ou cashout). Aujourd'hui `session.round` est un entier (le nonce provably-fair) — il
faudra soit le caster en string, soit générer un UUID de round séparé du nonce HMAC (plus
propre, pour ne pas coupler l'identité Hub88 du round à la valeur qui alimente le HMAC).

**Codes d'erreur à gérer** (`RS_OK`, `RS_ERROR_INVALID_TOKEN`, `RS_ERROR_NOT_ENOUGH_MONEY`,
`RS_ERROR_INVALID_SIGNATURE`, `RS_ERROR_USER_DISABLED`, `RS_ERROR_DUPLICATE_TRANSACTION`,
`RS_ERROR_LIMIT_REACHED`, `RS_ERROR_WRONG_SYNTAX`, `RS_ERROR_TOKEN_EXPIRED`,
`RS_ERROR_WRONG_CURRENCY`, `RS_ERROR_TRANSACTION_DOES_NOT_EXIST`) : à mapper vers les
`server:error` déjà émis côté Socket.IO (`insufficient_balance`, `invalid_bet`, etc.) pour
que le front n'ait pas à connaître deux vocabulaires d'erreur différents.

**Rétention** : conserver les transactions au moins 4 mois (actuellement rien n'est
persisté — `accounts` est une Map en mémoire pure, tout est perdu au redémarrage). Il
faudra un log de transactions persistant (fichier ou DB) au moins pour le chemin Hub88,
indépendamment du chemin standalone qui peut rester volatile.

### 4. Rate limits à respecter

Deux endpoints sont limités à **1 req/min** côté Hub88 (`/freebet/prepaids/list`,
`/game/list`) — mettre en cache localement, ne jamais les appeler à la demande depuis un
handler par-requête joueur.

### 5. Front-end : iframe classique vs Supplier Games SDK

Deux options pour livrer le jeu à l'opérateur :

- **Iframe classique** (via `/game/url`) : l'opérateur charge notre URL dans une iframe.
  Zéro changement d'architecture front — `src/components/`, `PixiRenderer.js`,
  `useChickenGame.js` restent identiques, on ajoute juste une page d'entrée qui lit
  `token`/`user`/`currency`/`lang` en query string au lieu de générer un `playerToken`
  anonyme local. **C'est le chemin recommandé pour un premier ship** : minimise le risque,
  réutilise 100% du frontend existant.
- **Supplier Games SDK** (pas d'iframe, notre JS chargé nativement dans la page de
  l'opérateur) : plus de contrôle pour l'opérateur (son/thème dynamiques via `sendAction`/
  `sendCustomAction`), mais demande d'exposer notre bundle en single ES module sur un CDN
  versionné, d'implémenter `GenericSupplierGames.init(config)` (< 15s, sinon timeout), et
  de dispatcher les événements `game-play-started`/`game-play-ended`/`game-notification`
  sur `window`. À envisager en v2 une fois l'iframe validée en prod — over-engineering de
  le faire dès le premier lancement.

Si iframe : ajouter un endpoint `/game/authorize` répondu par notre backend (appelé par
Hub88 juste avant que l'opérateur charge l'URL) uniquement si on part sur le SDK ; pas
nécessaire pour l'iframe classique.

## Plan d'implémentation concret

1. **Signature RSA** : générer la paire de clés, ajouter un module
   `server/hub88/signature.js` (sign sortant Wallet API, verify entrant Games API).
2. **Endpoints Games API** (nouveau routeur Express, ex. `server/hub88/gamesApi.js`,
   monté à côté du serveur Socket.IO existant dans `server/index.js`) :
   `/game/url`, `/game/round`, `/game/list`. `/game/url` crée une session Hub88 distincte
   des sessions Socket.IO anonymes actuelles — mapper `token` Hub88 → une `PlayerSession`
   qui **n'a pas** de `PlayerAccount` local, juste `operator_id`/`currency`/`user`.
3. **Client Wallet API** (`server/hub88/walletClient.js`) : `getBalance`, `bet`, `win`,
   `rollback`, avec retry/backoff raisonnable et mapping des `RS_ERROR_*` vers nos codes
   d'erreur existants.
4. **Brancher le moteur de jeu** : réutiliser `resolveStep`/`computeStepMultiplier` de
   `gameConfig.js` tels quels ; remplacer les lignes qui touchent `account.balance` dans
   `PlayerSession.startRound/step_/cashOut` (server/index.js:126,172,192) par des appels au
   client Wallet API **uniquement sur le chemin Hub88** — garder le chemin `accounts` Map
   intact pour le mode standalone (déclencher l'un ou l'autre selon si la session vient
   d'un `token` Hub88 ou d'un `playerToken` anonyme local).
5. **Conversion de devise** : wrapper `toHub88Amount(x) = Math.round(x * 100000)` /
   `fromHub88Amount(x) = x / 100000`, utilisé uniquement à la frontière avec la Wallet API,
   jamais dans `gameConfig.js`.
6. **Rollback sur échec** : si `bet` réussit côté Hub88 mais que la partie ne peut pas
   démarrer (déconnexion socket avant le premier `round:step`, crash serveur), appeler
   `rollback` avec le `transaction_uuid` du bet — sinon le joueur reste débité sans round
   valide.
7. **Persistance minimale des transactions** (mode Hub88 seulement) : au moins un log
   append-only (`transaction_uuid`, `round`, montant, statut) conservé 4+ mois — pas
   besoin d'une vraie DB pour démarrer, un fichier JSONL suffit en MVP.
8. **Tests** : étendre `scripts/concurrency-test.js` avec un scénario "Hub88 wallet
   simulé" (mock des endpoints Wallet API) pour vérifier idempotence
   (`transaction_uuid` rejoué) et rollback, en plus de ce qui existe déjà pour le mode
   standalone. `npm run rtp-sim` n'a besoin d'aucun changement — le moteur de jeu est
   inchangé.
9. **Onboarding commercial Hub88** : demander à Hub88 leurs exigences de certification
   (RNG/RTP audité par un labo agréé — GLI, iTech Labs ou équivalent selon les
   juridictions ciblées) et leurs specs de sécurité/compliance précises, non publiques
   dans cette documentation développeur — ce n'est pas quelque chose qu'on peut déduire de
   la doc technique seule.

## Ce qui ne change pas

`src/shared/gameConfig.js` (maths pures, HMAC), `src/animation/PixiRenderer.js`, et tous
les composants React restent inchangés dans le chemin recommandé (iframe). Le
provably-fair par case (HMAC-SHA256 par step) n'a pas d'équivalent dans le protocole
Hub88 — c'est une garantie additionnelle qu'on continue d'exposer au joueur en plus, pas un
remplacement de leur système de settlement.
