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

### Découpage : `roundEngine` + interface `Ledger`

L'ancien `PlayerSession` mélangeait trois responsabilités dans la même classe : (1) la
state machine du round, (2) l'orchestration du HMAC/provably-fair, (3) la mutation directe
de `account.balance`. Les deux premières étaient déjà plateforme-agnostiques ; c'est la
troisième qui a été extraite derrière une interface.

**✅ Fait** (2026-09-04) — l'extraction ci-dessous est en place et validée
(`npm run lint`, `npm run concurrency-test`, `npm run rtp-sim` tous verts) :

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
      localLedger.js  # Implémente Ledger via account.balance — c'est PlayerAccount
                        # (toujours dans server/index.js) mis derrière l'interface au
                        # lieu d'être manipulé en champ direct de l'ancien PlayerSession.
    hub88/                    # ← reste à écrire (voir plan d'implémentation)
      hub88Ledger.js   # Implémente Ledger via la Wallet API Hub88 (signée RSA).
      gamesApi.js       # Endpoints /game/url, /game/round, /game/list (voir plus bas).
      signature.js       # sign/verify RSA-SHA256.
    <plateforme-suivante>/
      xLedger.js
      xGamesApi.js (ou équivalent propre à cette plateforme)
```

**Piège rencontré pendant l'extraction, à connaître avant d'écrire `hub88Ledger.js`** :
rendre `startRound` `async` (nécessaire — `ledger.debit` fera un vrai appel HTTP signé
côté Hub88) introduit une fenêtre de réentrance que le code synchrone d'origine n'avait
pas. Le garde-fou `if (this.status === 'active') return { error: 'already_active' }`
doit être **posé de façon synchrone avant le premier `await`**, sinon deux `round:start`
tirés dos-à-dos passent tous les deux la garde pendant que le premier attend la résolution
du débit — `concurrency-test` l'a détecté immédiatement (double débit). La solution
retenue dans `roundEngine.js` : un état transitoire `'starting'` posé de façon synchrone
avant l'`await`, restauré à l'état précédent si le débit échoue — ça bloque à la fois un
second `round:start` concurrent (même garde) et un `round:step`/`cashOut` prématuré (les
deux exigent `status === 'active'`, que `'starting'` ne satisfait pas). Toute méthode
`Ledger` future qui fait un vrai I/O doit être écrite en gardant ce principe en tête :
**toujours poser la garde de façon synchrone avant le premier point d'`await`.**

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

**Conséquence mécanique appliquée** : `Round.startRound/step_/cashOut` sont `async`
(`await this.ledger.debit(...)`), donc les handlers Socket.IO dans `server/index.js`
(`socket.on('round:start', ...)`, etc.) le sont aussi. C'était le seul changement
mécanique imposé au code existant par ce refactor — le reste (calcul du multiplicateur,
HMAC, transitions de statut) est resté identique, déplacé tel quel dans `roundEngine.js`.
Ce passage à `async` est exactement ce qui a produit le piège de réentrance documenté
plus haut — pas une coïncidence, c'est le risque générique de rendre async un code qui
gardait ses invariants par exécution synchrone.

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

Implémenté sous `/hub88/supplier/generic/v2/...` (`server/platforms/hub88/gamesApi.js`,
monté dans `server/index.js`) — préfixe choisi arbitrairement en attendant la vraie base
URL négociée avec Hub88 à l'onboarding (l'exemple de leur doc est
`api2.hub88.io/operator/generic/v2/...` côté eux ; la nôtre reste à confirmer).

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

0. ✅ **Fait — Extraire `roundEngine` + interface `Ledger`** (voir section dédiée
   ci-dessus), avant d'écrire quoi que ce soit de spécifique à Hub88 :
   - `server/core/ledger.js` (contrat) + `server/core/roundEngine.js` (`Round`,
     extrait de l'ancien `PlayerSession`, `async` sur `startRound/step_/cashOut`,
     piloté par un `ledger` injecté au constructeur).
   - `server/platforms/standalone/localLedger.js` implémente `Ledger` en enveloppant
     `PlayerAccount.balance` (`PlayerAccount` + la `Map` `accounts` restent dans
     `server/index.js`, c'est la logique wallet/reserve — hors du contrat `Ledger`,
     propre au standalone).
   - `server/index.js` : chaque connexion Socket.IO instancie `new Round(new
     LocalLedger(account))` — comportement externe strictement identique à avant.
   - Validé : `npm run lint`, `npm run concurrency-test` (0 violation après le fix de
     réentrance décrit ci-dessus), `npm run rtp-sim` (tous les spot-checks dans leur IC
     95%) tous verts.
1. ✅ **Fait — Signature RSA** : `server/platforms/hub88/signature.js`
   (`signBody`/`verifyBody`, RSA-SHA256, BASE64), plus `generateDevKeyPair()` — un
   helper de dev **uniquement** pour exercer le code avant d'avoir de vraies clés
   échangées avec Hub88 (jamais utilisé pour du vrai trafic).
2. **Partiel — Endpoints Games API** (`server/platforms/hub88/gamesApi.js`, monté sur
   `app` dans `server/index.js` sous `/hub88/supplier/generic/v2` — seulement si les
   variables d'env `HUB88_*` sont toutes présentes, sinon totalement absent des routes) :
   - ✅ `/game/url` : vérifie la signature (clé publique Hub88), rejette `game_code`
     inconnu, mint un token de session interne (`sessions.js`) qui garde à part le
     `hub88Token` du joueur (celui que la Wallet API attend) — jamais confondu avec
     notre propre clé de session, voir le commentaire dans `sessions.js` sur ce piège.
     Gère le mode DEMO (`user`/`token` absents ou `currency: "XXX"`) en réutilisant
     directement `LocalLedger` — une session démo n'appelle jamais la vraie Wallet API.
   - ✅ `/game/list` : retourne le seul jeu (`game_code` configuré).
   - ❌ `/game/round` : renvoie `501 not_implemented` — bloqué sur l'absence de
     persistance des transactions (étape 7 plus bas), répondre honnêtement plutôt que
     fabriquer une URL.
3. ✅ **Fait — `hub88Ledger.js`** (implémente `Ledger`) : `getBalance`/`debit`/`credit`/
   `rollback` via `walletClient.js` (signature sortante, mapping `RS_ERROR_*` →
   vocabulaire commun). Pas de retry/backoff au-delà d'une tentative unique + erreur
   `network_error` explicite — à durcir avant la prod si Hub88 recommande une politique
   de retry spécifique à l'onboarding.
4. ✅ **Fait — Brancher** : dans `server/index.js`, chaque connexion Socket.IO résout
   `getHub88Session(token)` ; trouvé → `Hub88Ledger` (ou `LocalLedger` si la session est
   DEMO) ; sinon → le chemin anonyme standalone existant. C'est la seule branche
   plateforme-dépendante, tout `roundEngine.js` en aval est partagé sans condition.
5. ✅ **Fait — Conversion de devise** : `server/platforms/hub88/currency.js`
   (`toHub88Amount`/`fromHub88Amount`, ×100000), utilisé uniquement dans
   `hub88Ledger.js`.
6. **Partiel — Rollback** : `Ledger.rollback` est implémenté et testé au niveau
   `hub88Ledger.js`/`walletClient.js` (voir `hub88-mock-test.js`), mais **rien ne
   l'appelle encore** dans `server/index.js`. Raison : le déclencheur documenté
   ("le round ne peut pas démarrer — déconnexion avant le premier `round:step`") est en
   réalité une question produit non tranchée pour ce jeu précis, pas juste un branchement
   technique — voir "Décision produit ouverte" ci-dessous. Ne pas câbler ça sans réponse,
   au risque d'un mauvais choix (ex. laisser un joueur annuler sa mise en fermant l'onglet
   pile après un mauvais tirage).
7. ❌ **Pas fait — Persistance minimale des transactions** (mode Hub88 seulement) : log
   append-only (`transaction_uuid`, `round`, montant, statut) conservé 4+ mois. Bloque
   `/game/round` (étape 2) en plus d'être une exigence de conformité en soi.
8. ✅ **Fait — Tests** : `scripts/hub88-mock-test.js` (`npm run hub88-mock-test`) — mock
   in-process de la Wallet API + signature simulée côté "Hub88" pour exercer
   `signature.js`, `gamesApi.js` (`/game/url`, rejet signature invalide, rejet mauvais
   `game_code`) et `hub88Ledger.js` (debit/credit/rollback, idempotence sur
   `transaction_uuid` rejoué, solde insuffisant) de bout en bout sans réseau réel. 18/18
   assertions vertes. `concurrency-test.js`/`rtp-sim` restent inchangés et toujours verts
   (le chemin standalone est totalement inerte tant que les env vars `HUB88_*` ne sont
   pas toutes définies).
9. ❌ **Pas fait — Onboarding commercial Hub88** : demander à Hub88 leurs exigences de
   certification (RNG/RTP audité par un labo agréé — GLI, iTech Labs ou équivalent selon
   les juridictions ciblées) et leurs specs de sécurité/compliance précises, non
   publiques dans cette documentation développeur.
10. ❌ **Pas fait — Frontend** : `useChickenGame.js`/`socketClient.js` ne savent
    toujours lire le token que depuis `localStorage` (`chicken:playerToken`) — rien ne
    lit encore le `?token=` que `/game/url` embarque dans l'URL de lancement (voir
    `HUB88_LAUNCH_BASE_URL`). Tant que ce bootstrap n'existe pas côté client, tout ce qui
    précède n'est vérifié qu'en backend pur (mock test) — **aucun test n'a encore fait
    tourner le jeu réel dans un navigateur via ce chemin**. C'est le prochain morceau
    concret à faire avant de pouvoir dire "l'iframe Hub88 marche".
11. **Plateforme suivante** : répéter les étapes 1-3 et 9 (Games API + `Ledger` +
    onboarding propres à cette plateforme) — 0, 5, 8 sont déjà acquises telles quelles ;
    6-7 restent à finir une fois pour toutes les plateformes, pas par plateforme.

**Décision produit ouverte (bloque l'étape 6)** : que doit-il se passer si un joueur
lancé depuis Hub88 perd sa connexion socket pendant un round actif (mise déjà débitée,
aucun cashout envoyé) ? Trois options, aucune évidente sans trancher côté produit :
(a) forfait silencieux — comportement actuel du mode standalone, mais potentiellement
non conforme aux attentes d'un agrégateur sur le traitement des rounds interrompus ;
(b) rollback automatique du bet — rembourse le joueur, mais ouvre une façon de se
soustraire à un tirage déjà engagé en coupant la connexion au bon moment ; (c) reprise de
session — nécessite de persister l'état du `Round` en cours (pas seulement le
`transaction_uuid`) pour le réhydrater à la reconnexion, fonctionnalité qui n'existe pas
du tout aujourd'hui, y compris côté standalone. À trancher avant d'écrire le code de
l'étape 6.

### Variables d'environnement (activation Hub88)

`server/index.js` ne monte le routeur Games API et n'active jamais le chemin Hub88 que si
**toutes** ces variables sont présentes — absentes, le comportement standalone est
strictement celui d'avant (c'est ce que vérifient `concurrency-test`/`rtp-sim`, qui ne les
définissent pas) :

| Variable | Rôle |
|---|---|
| `HUB88_PRIVATE_KEY` | Notre clé privée RSA (PEM) — signe les appels sortants vers la Wallet API |
| `HUB88_REMOTE_PUBLIC_KEY` | Clé publique RSA de Hub88 (PEM) — vérifie les appels entrants sur la Games API |
| `HUB88_WALLET_BASE_URL` | Base URL de la Wallet API Hub88 (ex. `https://api.hub88.io/supplier/generic/v2`) |
| `HUB88_GAME_CODE` | `game_code` attribué par Hub88 pour Chicken Ninja |
| `HUB88_GAME_NAME` | Nom affiché dans `/game/list` (défaut : `"Chicken Ninja"`) |
| `HUB88_LAUNCH_BASE_URL` | URL du frontend réel où `/game/url` redirige (le build Vite en prod) |

Aucune valeur par défaut n'est fournie pour les clés/URL — pas de placeholder qui
ressemblerait à une vraie config par accident. `server/platforms/hub88/signature.js`
exporte `generateDevKeyPair()` pour générer une paire de clés éphémère en local, utile
uniquement pour rejouer `npm run hub88-mock-test` ou développer sans attendre l'onboarding.

## Ce qui ne change pas

`src/shared/gameConfig.js` (maths pures, HMAC), `src/animation/PixiRenderer.js`, et tous
les composants React restent inchangés dans le chemin recommandé (iframe). Le
provably-fair par case (HMAC-SHA256 par step) n'a pas d'équivalent dans le protocole
Hub88 — c'est une garantie additionnelle qu'on continue d'exposer au joueur en plus, pas un
remplacement de leur système de settlement.
