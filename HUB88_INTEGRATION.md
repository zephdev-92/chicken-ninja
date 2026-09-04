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

**Cadrage multi-plateformes** : l'objectif n'est pas d'intégrer Hub88 spécifiquement mais
plusieurs agrégateurs/opérateurs au fil du temps. Hub88 sert ici de **premier cas concret**
pour construire une architecture d'adaptateurs réutilisable — voir la section dédiée
juste en dessous avant de lire le détail Hub88, qui n'en est qu'une instance.

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

## Architecture multi-plateformes : interfaces, pas de clones

Cloner le repo par plateforme (Hub88, puis une autre, puis une autre) garantit le drift :
un fix de bug ou un ajustement de `effectiveRTP` devra être répliqué à la main dans chaque
clone, et le jour où l'un est oublié, deux plateformes tournent avec des probabilités
différentes sous le même nom de jeu — un problème sérieux pour un jeu audité (RNG/RTP).
La bonne unité de réutilisation n'est pas le repo mais trois couches qu'il faut séparer
proprement une fois, puis ne plus jamais dupliquer.

### Ce qui reste commun à toutes les plateformes

**Le plus gros morceau ne change pas du tout.** Le protocole Socket.IO actuel
(`round:start`, `round:step`, `round:cashout`, `wallet:deposit/withdraw`, `session:sync`)
peut rester **la seule surface que le frontend connaît**, quelle que soit la plateforme qui
héberge la partie. Ce que fait une plateforme, concrètement, se limite à deux choses :

1. **Comment le token de session est délivré** — aujourd'hui minté anonymement au premier
   `socket.handshake.auth.token` (`server/index.js:234-238`). Pour Hub88, ce sera plutôt le
   token que Hub88 nous transmet via son handshake `/game/url`, que le client réutilisera
   pour ouvrir la connexion Socket.IO (même mécanique `auth: { token }`, juste une autre
   source de vérité pour l'émettre).
2. **Où va l'argent** — aujourd'hui `account.balance` dans la `Map` en mémoire. Pour Hub88,
   des appels à leur Wallet API signée. Pour une 3e plateforme, autre chose encore.

Tout le reste — `resolveStep`, `computeStepMultiplier`, la séquence
start→step→step→…→cashout/bust, les événements Socket.IO émis vers le client, le rendu
Pixi, `useChickenGame.js` — ne doit être écrit **qu'une fois**.

### Découpage proposé : `roundEngine` + interface `Ledger`

`PlayerSession` (`server/index.js:82-227`) mélange aujourd'hui trois responsabilités dans
la même classe : (1) la state machine du round, (2) l'orchestration du HMAC/provably-fair,
(3) la mutation directe de `account.balance`/`account.wallet`. Les deux premières sont déjà
plateforme-agnostiques ; c'est la troisième qu'il faut extraire derrière une interface.

```
server/
  core/
    roundEngine.js   # Round : startRound/step_/cashOut — state machine + HMAC, inchangé
                      # dans son comportement, mais ne touche plus account.balance
                      # directement : il appelle this.ledger.debit/credit/getBalance.
    ledger.js         # Contrat documenté (pas de TS dans ce repo) que toute plateforme
                        # doit satisfaire pour driver roundEngine.
  platforms/
    standalone/
      localLedger.js  # Implémente Ledger via la Map `accounts` — c'est PlayerAccount
                        # tel qu'il existe aujourd'hui, juste déplacé et mis derrière
                        # l'interface plutôt qu'en champ direct de PlayerSession.
    hub88/
      hub88Ledger.js   # Implémente Ledger via la Wallet API Hub88 (signée RSA).
      gamesApi.js       # Endpoints /game/url, /game/round, /game/list (voir plus bas).
      signature.js       # sign/verify RSA-SHA256.
    <plateforme-suivante>/
      xLedger.js
      xGamesApi.js (ou équivalent propre à cette plateforme)
```

`Ledger` — le contrat exact :

```js
// server/core/ledger.js
// Toute plateforme fournit un objet conforme à ceci pour driver roundEngine.
// getBalance/debit/credit/rollback sont toujours async : le chemin standalone résout
// immédiatement (Map en mémoire), le chemin Hub88 fait un vrai appel HTTP signé — la
// state machine ne doit jamais supposer que l'un ou l'autre est synchrone.
export class Ledger {
  async getBalance()              { throw new Error('not implemented'); }
  async debit(amount, meta)       { throw new Error('not implemented'); } // meta: { roundId, transactionUuid }
  async credit(amount, meta)      { throw new Error('not implemented'); } // meta: { roundId, transactionUuid, referenceTransactionUuid }
  async rollback(meta)            { throw new Error('not implemented'); } // no-op licite si la plateforme n'a pas de rollback
}
```

`debit`/`credit` retournent `{ ok: true, balance }` ou `{ ok: false, error }` — même
vocabulaire d'erreur que les `server:error` actuels (`insufficient_balance`, etc.), à
charge pour chaque `Ledger` de traduire les codes propres à sa plateforme
(`RS_ERROR_NOT_ENOUGH_MONEY` → `insufficient_balance`) vers ce vocabulaire commun, pour
que `roundEngine` et le frontend n'aient jamais à connaître le vocabulaire d'une
plateforme tierce.

**Conséquence directe à anticiper** : `PlayerSession.startRound/step_/cashOut` passent de
synchrone à `async` (`await this.ledger.debit(...)`), donc les handlers Socket.IO dans
`server/index.js` (`socket.on('round:start', ...)`, etc.) doivent devenir `async` aussi.
C'est le seul changement mécanique imposé au code existant par ce refactor — tout le reste
de `PlayerSession` (calcul du multiplicateur, HMAC, transitions de statut) est copié tel
quel dans `roundEngine.js`.

### Ce qui varie réellement par plateforme

| | Standalone (actuel) | Hub88 | Plateforme future |
|---|---|---|---|
| Émission du token de session | Anonyme, minté au 1er handshake socket | Reçu de Hub88 via `/game/url` → relayé au client | Selon son propre protocole de lancement |
| `Ledger` | `localLedger.js` (Map mémoire) | `hub88Ledger.js` (Wallet API signée RSA) | Son propre client wallet |
| Devise | Unité de jeu abstraite | ISO 4217, entiers ×100000 | Selon la plateforme — conversion à isoler dans son `xLedger.js`, jamais dans `gameConfig.js`/`roundEngine.js` |
| Transport joueur ↔ serveur | Socket.IO privé | **Identique** — Socket.IO privé | **Identique** |
| Round id | Nonce entier (`session.round`) | UUID string, `round_closed` sur le dernier appel | Selon la plateforme |

### Frontend : même logique de séparation

`src/core/` est déjà documenté comme la couche à ne jamais dupliquer en changeant de
frontend (voir `CLAUDE.md`, section Structure) ; le même principe s'applique en changeant
de *plateforme de lancement*. En iframe (le mode recommandé pour Hub88, voir plus bas),
`useChickenGame.js`/`socketClient.js` n'ont besoin de rien connaître d'une plateforme
particulière — seule la façon dont `playerToken` est initialement obtenu diffère
(`localStorage` généré par le client pour le mode standalone vs. lu depuis la query string
fournie par l'opérateur pour Hub88). Isoler cette lecture dans une fonction unique (ex.
`resolveLaunchToken()` dans `src/core/`) plutôt que de la disperser évite d'avoir à forker
`useChickenGame.js` par plateforme.

### Ce que ça coûte, ce que ça évite

Ce découpage est un refactor amont avant d'ajouter Hub88 — pas rentable pour une seule
intégration à vie, mais ici l'objectif annoncé est plusieurs plateformes, donc
l'investissement se rembourse dès le premier bugfix qui, sans lui, aurait dû être
répliqué dans un clone. Le plan d'implémentation ci-dessous part de ce découpage (étape 0)
avant de brancher Hub88 dessus (étapes 1+).

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

0. **Extraire `roundEngine` + interface `Ledger`** (voir section dédiée ci-dessus),
   *avant* d'écrire quoi que ce soit de spécifique à Hub88 :
   - Déplacer `PlayerAccount` + la logique `accounts` Map de `server/index.js` vers
     `server/platforms/standalone/localLedger.js`, implémentant `Ledger`.
   - Extraire la state machine de `PlayerSession` vers `server/core/roundEngine.js`
     (`Round`), paramétrée par un `ledger` injecté au constructeur, plus `async` sur
     `startRound/step_/cashOut`.
   - Mettre à jour `server/index.js` : chaque connexion Socket.IO instancie toujours un
     `Round`, mais construit avec `new LocalLedger(account)` — comportement strictement
     identique à aujourd'hui, c'est une extraction pure, pas un changement de comportement.
   - Vérifier avec `npm run concurrency-test` et `npm run rtp-sim` que rien n'a changé
     côté standalone avant de toucher à Hub88.
1. **Signature RSA** : générer la paire de clés, ajouter
   `server/platforms/hub88/signature.js` (sign sortant Wallet API, verify entrant Games
   API).
2. **Endpoints Games API** (nouveau routeur Express,
   `server/platforms/hub88/gamesApi.js`, monté à côté du serveur Socket.IO existant dans
   `server/index.js`) : `/game/url`, `/game/round`, `/game/list`. `/game/url` mint un
   token de session Hub88 (distinct du token anonyme standalone) que le client réutilise
   pour ouvrir sa connexion Socket.IO exactement comme aujourd'hui — même handshake
   `auth: { token }`, juste une autre source d'émission.
3. **`hub88Ledger.js`** (implémente `Ledger`) : `getBalance`/`debit`/`credit`/`rollback`
   appellent `/user/balance`, `/transaction/bet`, `/transaction/win`,
   `/transaction/rollback`, avec retry/backoff raisonnable et mapping des `RS_ERROR_*`
   vers le vocabulaire d'erreur commun (`insufficient_balance`, etc.).
4. **Brancher** : au moment où la connexion Socket.IO s'ouvre, choisir
   `new LocalLedger(account)` ou `new Hub88Ledger(session)` selon que le token présenté
   est un token anonyme local ou un token Hub88 — c'est la **seule** branche
   plateforme-dépendante dans `server/index.js`, tout `roundEngine.js` en aval est
   partagé sans condition.
5. **Conversion de devise** : wrapper `toHub88Amount(x) = Math.round(x * 100000)` /
   `fromHub88Amount(x) = x / 100000`, utilisé uniquement dans `hub88Ledger.js`, jamais
   dans `gameConfig.js`/`roundEngine.js`.
6. **Rollback sur échec** : si `bet` réussit côté Hub88 mais que la partie ne peut pas
   démarrer (déconnexion socket avant le premier `round:step`, crash serveur), appeler
   `ledger.rollback(meta)` — sinon le joueur reste débité sans round valide.
7. **Persistance minimale des transactions** (mode Hub88 seulement) : au moins un log
   append-only (`transaction_uuid`, `round`, montant, statut) conservé 4+ mois — pas
   besoin d'une vraie DB pour démarrer, un fichier JSONL suffit en MVP.
8. **Tests** : étendre `scripts/concurrency-test.js` avec un scénario "Hub88 wallet
   simulé" (mock des endpoints Wallet API, ou directement un `Ledger` de test conforme au
   contrat) pour vérifier idempotence (`transaction_uuid` rejoué) et rollback, en plus de
   ce qui existe déjà pour le mode standalone. `npm run rtp-sim` n'a besoin d'aucun
   changement — le moteur de jeu est inchangé.
9. **Onboarding commercial Hub88** : demander à Hub88 leurs exigences de certification
   (RNG/RTP audité par un labo agréé — GLI, iTech Labs ou équivalent selon les
   juridictions ciblées) et leurs specs de sécurité/compliance précises, non publiques
   dans cette documentation développeur — ce n'est pas quelque chose qu'on peut déduire de
   la doc technique seule.
10. **Plateforme suivante** : répéter uniquement les étapes 1-3 et 9 (Games API +
    `Ledger` + onboarding propres à cette plateforme) — les étapes 0, 5-8 sont déjà
    acquises et ne se refont pas.

## Ce qui ne change pas

`src/shared/gameConfig.js` (maths pures, HMAC), `src/animation/PixiRenderer.js`, et tous
les composants React restent inchangés dans le chemin recommandé (iframe). Le
provably-fair par case (HMAC-SHA256 par step) n'a pas d'équivalent dans le protocole
Hub88 — c'est une garantie additionnelle qu'on continue d'exposer au joueur en plus, pas un
remplacement de leur système de settlement.
