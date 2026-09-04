# Chicken Ninja

Jeu casino type "Chicken Road", thème ninja : un poulet avance case par case sur une route
bitumée (ambiance manga/BD halftone, jour), évite des étoiles ninja lancées, encaisse son
gain à tout moment. Provably fair (HMAC-SHA256), calculé case par case côté serveur.

Base architecturale reprise de `/media/zephdev/Jeux/CRASH-GAME` (couches core/hooks/components
découplées), adaptée à une mécanique par étapes discrètes plutôt qu'un multiplicateur continu.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | React 19, Vite 8 |
| Rendu graphique | PixiJS v8 — sprites réels (`src/assets/`), style manga/BD halftone |
| Backend | Node.js, Express, Socket.IO |
| Temps réel | Socket.IO, **session privée par joueur** (pas de round partagé, contrairement à CRASH-GAME) |
| Fairness | HMAC-SHA256 (crypto Node.js + Web Crypto API), calculé à la demande, case par case |

## Lancer le projet

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Serveur : http://localhost:3001
- `npm run lint` avant tout commit
- `npm run rtp-sim` (ou `-- --deep`) pour valider empiriquement le RTP après toute
  modification de `src/shared/gameConfig.js` ou de `resolveStep` côté serveur —
  voir `.claude/skills/rtp-simulation/SKILL.md`

## Structure

```
Chicken-ninja/
├── server/
│   ├── index.js              # Express + Socket.IO ; identité anonyme signée, PlayerAccount
│   │                         #   (balance/wallet standalone) ; câble Round+LocalLedger par socket
│   ├── core/
│   │   ├── roundEngine.js    #   Round : state machine du round + HMAC — plateforme-agnostique,
│   │   │                     #     ne touche jamais un solde directement (voir ledger.js)
│   │   └── ledger.js          #   Interface Ledger (debit/credit/getBalance/rollback) que toute
│   │                         #     plateforme doit satisfaire pour driver roundEngine
│   └── platforms/
│       ├── standalone/localLedger.js  # Implémente Ledger via account.balance (mode démo actuel)
│       └── hub88/             # Adaptateur Hub88 — inerte tant que les env vars HUB88_* ne sont
│           ├── signature.js   #   pas TOUTES définies (voir HUB88_INTEGRATION.md § env vars)
│           ├── currency.js    #   RSA-SHA256 sign/verify (X-Hub88-Signature) ; conversion ×100000
│           ├── walletClient.js #   Client HTTP signé + mapping RS_ERROR_* → vocabulaire commun
│           ├── hub88Ledger.js  #   Implémente Ledger via walletClient (bet/win/rollback réels)
│           ├── sessions.js      #   Map token session → { hub88Token, gameCode, currency, ... }
│           └── gamesApi.js       #   Routeur Express : /game/url (+ /game/list), /game/round=501
│       # voir HUB88_INTEGRATION.md pour l'architecture complète, le piège de réentrance
│       # rencontré en rendant Round async, et l'état exact fait/pas fait de l'adaptateur Hub88
│       # (frontend pas branché, persistance des transactions pas faite — pas encore testé
│       # dans un vrai navigateur, seulement via npm run hub88-mock-test).
├── scripts/rtp-simulation.js # Monte Carlo RTP validator — npm run rtp-sim
├── src/
│   ├── shared/gameConfig.js # DIFFICULTIES + maths pures (multiplicateur, HMAC message, RNG→outcome)
│   │                         #   importé par le serveur ET le client — ne jamais dupliquer ces valeurs
│   ├── theme.js              # Tokens de couleur/police UI — frontend only, jamais importé côté serveur
│   │                         #   ni fusionné avec gameConfig.js
│   ├── assets/                # Sprites PNG découpés (chicken/, icons/, ui/, road/) — voir Conventions
│   ├── core/                # ← NE PAS TOUCHER pour changer de frontend (framework-agnostique)
│   │   ├── gameEvents.js    #   Bus d'événements (EventTarget)
│   │   ├── socketClient.js  #   socket.io → gameEvents
│   │   ├── chickenStore.js  #   État pur JS
│   │   └── gameActions.js   #   Actions joueur (wraps socket.emit)
│   ├── animation/PixiRenderer.js  # Scène route bitumée manga/BD, Sprite + TilingSprite (src/assets/)
│   ├── hooks/                # ← Spécifique React
│   │   ├── useChickenGame.js #   État + wallet localStorage + actions
│   │   ├── useSound.js       #   Web Audio API — hop/targetHit synthétisés, bust/cashout
│   │   │                     #   rejouent de vrais fichiers (src/assets/sounds/*.mp3)
│   │   └── useMediaQuery.js
│   └── components/           # ← UI React — cadre mobile fixe (voir App.jsx)
│       ├── Header.jsx, Drawer.jsx (wallet/ProvablyFair/historique, hors flux principal)
│       ├── GameCanvas.jsx, DifficultySelector.jsx, BetPanel.jsx,
│       ├── ProvablyFair.jsx, CashoutFeed.jsx (ticker "gains récents")
│       # Échelle de multiplicateurs : plus de composant dédié — badges dessinés directement
│       # sur les cases par PixiRenderer (buildMultiplierLadder dans gameConfig.js reste la
│       # seule source des valeurs)
├── PROTOCOL.md (à créer si le protocole évolue — voir tableau socket dans README.md)
```

**Pour un nouveau frontend** : conserver `core/`, `shared/` et `animation/`, réécrire
`hooks/` et `components/`.

## Mécanique de jeu

4 difficultés (`easy/medium/hard/hardcore`), chacune `{ lanes: 24, deathChance }`. Le
multiplicateur après `n` cases franchies = `RTP * (1/(1-deathChance))^n` avec `RTP = 0.97`.
Provably fair par case : `HMAC-SHA256(serverSeed, "clientSeed:nonce:step")` → `r ∈ [0,1)` →
`r < deathChance` = étoile. Détails dans `src/shared/gameConfig.js`.

**Edge progressif anti-"double facile" (`gameConfig.js`, `effectiveRTP`) :** le RTP de
97% n'est plus flat sur tous les steps. Sur les steps 2 à 7, un edge supplémentaire
(jusqu'à 15 points, proportionnel à `deathChance`) réduit le multiplicateur — sinon la
compoundée `(1/survival)^n` fait quasi doubler la mise dès le 2e saut en `hardcore`
(x1.98 avec ~49% de survie), un risque perçu trop faible pour le gain. L'edge est nul au
step 1 (le premier saut reste "gagné normalement") et retombe à 0 au step 8, donc le
end-game (haut risque réel) n'est pas touché ; `easy`/`medium` sont à peine affectés
puisque l'edge est mis à l'échelle de `deathChance`. Conséquence : l'EV n'est plus
identique quel que soit le step de cashout (c'était vrai avant, par construction) — cash
out rapide sur `hard`/`hardcore` a maintenant un edge plus élevé que jouer plus loin.
`scripts/rtp-simulation.js` valide contre `effectiveRTP(deathChance, step)` par step, pas
contre un `RTP` flat — toujours relancer `npm run rtp-sim -- --deep` après toute
modification de cette courbe.

## Conventions

- Style inline (`style={{...}}`) comme CRASH-GAME, pas de CSS Modules/Tailwind pour l'instant.
  Seule exception : `src/index.css`, un reset global minimal (importé une fois dans
  `main.jsx`) qui couvre ce que le style inline ne peut pas atteindre — `box-sizing` et
  surtout le fait que `<button>`/`<input>`/`<select>`/`<textarea>` n'héritent pas de
  `font-family`/`color` par défaut (feuille UA du navigateur), donc rendaient dans la
  police système au lieu d'Inter tant que `theme.fontBody` n'était pas répété sur chaque
  contrôle un par un. Ne pas y ajouter de styles de composant — ça reste réservé aux
  resets globaux impossibles à faire proprement en inline.
- Toute constante de jeu (lanes, deathChance, RTP) vit dans `src/shared/gameConfig.js`,
  jamais dupliquée côté serveur ou composant.
- Le socket est privé par session (`socket.emit`), sauf `cashout:feed` qui est diffusé à
  tous (`io.emit`) — feed cosmétique de gains récents, pas de round partagé.
- `balance`/`walletBalance` sont **server-authoritative** (voir section dédiée plus bas) —
  ne jamais réintroduire un `useState`/`localStorage` qui recalcule ou stocke ces valeurs
  côté client ; toujours passer par `gameActions.startRound/cashOut/deposit/withdraw` et
  lire le résultat depuis `chickenStore` (alimenté par `session:sync`/`round:started`/
  `round:cashout`/`wallet:sync`).
- Assets réels (PNG) dans `src/assets/{chicken,icons,ui,road}/`, chargés via `Assets.load()`
  (Pixi v8) dans `PixiRenderer.js` — poses de poule (idle/run/victory/ko) swappées selon
  l'état de jeu, route continue en `TilingSprite`. Toute nouvelle couleur d'UI passe par
  `src/theme.js`, jamais un hex codé en dur dans un composant.

## État actuel

Prototype fonctionnel : mise, choix de difficulté, avancée case par case, cashout,
provably fair vérifiable, historique, feed de gains, cadre mobile compact (viewport
fixe, pas de scroll de page). RTP validé empiriquement via `npm run rtp-sim`
(Monte Carlo sur le vrai chemin HMAC, cf. `.claude/skills/rtp-simulation/`).

**Fin de tour (PixiRenderer + chickenStore) :**
- `PixiRenderer.reset()` détruit le sprite shuriken en vol (et pas seulement la référence
  JS) avant de démarrer un nouveau tour — sinon il reste accroché à la scène indéfiniment.
- Le bouton "Jouer"/"Avancer" reste verrouillé (`PixiRenderer._busy` → `GameCanvas`
  `onBusyChange` → `App.roundAnimating`) tant que l'animation de bust ou de cashout
  n'est pas terminée, pour éviter qu'un nouveau tour démarre pendant l'animation
  précédente et laisse des sprites orphelins.
- `chickenStore` revient seul à `idle` 6s après un `busted`/`cashed` si le joueur ne
  relance pas de tour entre-temps (`AUTO_IDLE_MS` dans `chickenStore.js`) — la scène
  Pixi se réinitialise en conséquence dans `GameCanvas.jsx`.

**Décor route (`PixiRenderer.js`) :** `road-start-post.png` (poulailler) est affiché à 2×
sa taille de base et décalé haut-gauche pour ne montrer que la porte/les marches — donne
l'effet "la poule sort d'un grand poulailler". `path-post.png` (cibles le long de la
route) est réduit de 20% en conséquence. Ces deux proportions sont ancrées sur une
constante `POST_REF_H` fixe (indépendante de `CHICKEN_H`) pour ne pas bouger si la taille
du poulet change.

**Taille et position de la poule (`PixiRenderer.js`) :** `CHICKEN_H` a été augmenté de 20%
(66 → 66*1.2) ; la scène (route/poule/portails, conteneur `track`) est décalée vers le bas
via `TRACK_Y_EXTRA` sans toucher au fond sablé (`TilingSprite`, dessiné séparément sur
`stage`).

**Séquence de bust (`PixiRenderer.js`) :** le shuriken fatal est lancé pendant la fin du
saut (`HOP_THROW_PROGRESS`, ~70% du saut), pas après un temps d'attente séparé — il est
déjà visible en train de tomber quand la poule atterrit, ce qui réduit la latence perçue
entre la case qui devient rouge et l'impact réel. Les shurikens "presque ratés"
(`_throwMissShuriken`, un par case franchie) tombent jusqu'à la hauteur des cibles
(`_postLocalY`) : à leur disparition, la cible correspondante (`_posts`, indexée par x)
bascule sur la texture `cible-hit.png`, remise à `path-post.png` au `reset()`.

**Sons (`useSound.js` + `onSound`) :** `hop` et `targetHit` sont synthétisés à
l'oscillateur (pas de fichier) ; `bust`/`cashout` rejouent de vrais fichiers MP3
(`fetch` + `decodeAudioData`, mis en cache, joués via un `AudioBufferSourceNode` neuf à
chaque appel pour permettre le chevauchement). Le hop et l'impact du bust ne sont
**jamais** déclenchés directement sur le changement de `status` React — trop tôt par
rapport à l'animation — mais via un callback `PixiRenderer.setSoundListener()` remonté
par `GameCanvas` (`onSound`) jusqu'à `App.jsx`, déclenché exactement à la frame où
l'animation correspondante démarre/touche. Le cashout reste déclenché sur `status`
(pas de séquence multi-étapes avant le rebond).

**Redimensionnement (`PixiRenderer.resize()` + `GameCanvas.jsx`) :** le renderer PixiJS
n'est créé **qu'une seule fois** par montage de `GameCanvas` ; tout redimensionnement
ultérieur du conteneur appelle `PixiRenderer.resize()` (recalcule échelle/caméra,
repositionne sol et cibles) au lieu de `destroy()` + recréation. Détruire et recréer à
chaque correction de taille (le `ResizeObserver` en déclenche fiablement une ~200ms après
un chargement à froid, le temps que les polices web chargent) faisait repartir la scène de
zéro (poule case 0, cases non cochées) sans mémoire du tour en cours — visible comme "le
jeu se relance tout seul" juste après un cashout. Ne jamais réintroduire un
`destroy()`+`new PixiRenderer()` sur un simple resize.

**Solde server-authoritative (`server/index.js` + `src/core/`) :** `balance` (solde en
jeu) et `walletBalance` (réserve) vivent désormais côté serveur, dans une `Map` en mémoire
(`accounts`, clé = `playerId`), plus dans `localStorage` côté client. Identité anonyme :
au premier contact, le serveur mint un token signé (`HMAC-SHA256(secret_process, playerId)`)
transmis via le handshake Socket.IO (`io({ auth: { token } })`) ; le client le persiste en
`localStorage` (`chicken:playerToken`) et le renvoie à chaque reconnexion. Le secret de
signature est généré en mémoire au boot du process — un redémarrage serveur invalide donc
tous les tokens et remet les comptes à zéro par construction (cohérent avec "pas de DB").
`startRound` débite `account.balance` côté serveur (rejette avec `insufficient_balance` si
la mise dépasse le solde réel), `cashOut`/auto-cashout crédite le payout, `wallet:deposit`/
`wallet:withdraw` déplacent des fonds entre wallet et balance — toutes ces mutations sont
renvoyées au client via le payload de l'événement concerné (`round:started.balance`,
`round:cashout.balance`, `wallet:sync`), jamais recalculées côté client. Limitations
acceptées : pas de vrai compte (vider `localStorage` recrée un compte par défaut), solde
perdu au redémarrage serveur — un vrai système d'auth (Supabase) resterait à faire pour
lever ces limites. Multi-onglets sur le même token : chaque socket a sa propre `Round`
(`server/core/roundEngine.js` — round/step/status) mais partage le même `PlayerAccount`
(balance/wallet) — donc deux onglets peuvent avoir chacun un tour actif en parallèle sur
le même solde, comme deux joueurs distincts. Vérifié empiriquement sans race exploitable
(`npm run concurrency-test`, scénario "shared-token") : jamais de solde négatif, de débit
perdu ou de crédit doublé, même en tirant deux `round:start`/`round:cashout` strictement
au même instant réseau. `Round.startRound/step_/cashOut` sont `async` (le `Ledger` injecté
peut faire un vrai appel réseau pour une future plateforme non-standalone, voir
`HUB88_INTEGRATION.md`) — la garde d'état (`status === 'active'`/`'starting'`) doit donc
être posée **avant** le premier `await`, jamais après, sous peine de double-débit sur un
double `round:start` tiré dos-à-dos (piège rencontré et corrigé, voir git history de
`roundEngine.js`).

**Décor scrollant + calques (`PixiRenderer.js`) :** le sol (`background-sand-tile.png`,
remplace `path-sand-tile.png` conservé mais plus référencé) vit désormais dans `track`
(pas `stage`) — il défile avec la caméra et couvre toute la longueur du parcours, pas
seulement la largeur du canvas. `pattern-road.png` ajoute des segments de route
**non répétés** entre chaque paire de cibles consécutives (`_layoutRoadSegments`) : une
découpe verticale aléatoire de la texture source par intervalle (`Math.random() *
maxCropY`, borné pour ne jamais dépasser le bas de l'image), à une échelle réduite
(`ROAD_ZOOM = 0.75`) sur toute la hauteur de l'écran (converti en coordonnées locales
via `-trackY/sceneScale` → `(h-trackY)/sceneScale`, puisque `track` est lui-même
décalé/mis à l'échelle). Comme le sol et les segments sont reconstruits en place à
chaque `resize()`, l'empilement visuel utilise `track.sortableChildren = true` +
`zIndex` explicite (sol=0, route=1, cibles/portails=2, cases=3, poule=4) plutôt que
l'ordre d'ajout — plus fiable qu'`addChildAt`.

**Vignettage + cases (`PixiRenderer.js`) :** deux dégradés (`FillGradient`, natif Pixi
v8) sur `stage` (fixes à l'écran, ajoutés après `track`) assombrissent haut/bas en
teinte encre (`theme.textPrimary`). Les 3 états de case (`TILE_VISUALS` : prochain
saut/validée/crash) sont maintenant des **cercles** (`wash.circle`, rayon `h/2`) plutôt
que des rectangles arrondis, avec une opacité relevée (0.55/0.45/0.7) pour rester
lisibles sur la texture route/rochers — l'ancien aplat à 0.18-0.35 se noyait dedans.

**Bug de repaint Chrome dans le Drawer (`Drawer.jsx` + `ProvablyFair.jsx`) :** une fois
l'historique plein (10 entrées, cap dans `chickenStore.addHistory`), le bloc "Provably
Fair" au-dessus disparaissait visuellement — présent et correct dans le DOM/inspecteur,
juste jamais repeint, jusqu'à un rechargement complet. Cause : `overflow: hidden` sur le
conteneur Provably Fair (coins arrondis) combiné à la liste d'historique qui grossit juste
en dessous perturbait l'heuristique de promotion de calque de Chrome. Corrigé en
remplaçant par `overflow: 'clip'` (pas de conteneur de scroll implicite, contourne le
bug) sur `ProvablyFair.jsx`, plus `contain: 'paint'` sur la liste d'historique dans
`Drawer.jsx` pour isoler son propre rendu. Diagnostiqué via l'inspecteur DOM du
navigateur — invisible en lecture de code ou en test automatisé (aucune erreur console,
non reproduit par un navigateur headless piloté par script).

**Badge multiplicateur et wordmark (`PixiRenderer.js` + `Header.jsx`) :** `BADGE_SIZE`
46→54px et texte 11→12px (les chiffres à 2 décimales étaient tronqués sur le disque) ;
le wordmark "CHICKEN NINJA" du header passe de 19px à 30px — valeur reportée dans le
frontmatter `typography.display` et la section Hierarchy de `DESIGN.md`, à garder
synchronisé si retouché.

**Tests machine (`scripts/`) :** `npm run rtp-sim -- --deep` (Monte Carlo autonome, sans
serveur/réseau, réutilise le vrai chemin HMAC — voir `.claude/skills/rtp-simulation/`) et
`npm run concurrency-test` (`scripts/concurrency-test.js` — spawn un vrai `server/index.js`
et pilote plusieurs vrais clients `socket.io-client` concurrents ; vérifie qu'aucune mise
n'est acceptée deux fois sur une même session, qu'aucun cashout n'est payé deux fois, et
que le solde annoncé par le serveur colle exactement à la mise/au payout à chaque
événement — y compris le cas multi-onglets ci-dessus). Options : `--players=`, `--rounds=`,
`--port=`.

Pas encore : bordure de panneau BD (pas d'asset haute résolution fourni), logo/trophée
dédié (wordmark texte + icône étoile en stand-in), tests automatisés (aucun fichier de
test dans le repo), load testing sur `server/index.js` (mêmes gaps que CRASH-GAME, voir
son `PROTOCOL.md`).
