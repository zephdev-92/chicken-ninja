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
  voir `.agents/skills/rtp-simulation/SKILL.md`

## Structure

```
Chicken-ninja/
├── server/index.js          # Express + Socket.IO, une PlayerSession par socket
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
│   │   ├── useSound.js       #   Web Audio API (hop / bust / cashout)
│   │   └── useMediaQuery.js
│   ├── i18n/                 # Langues/devises : Translator, LocaleDetector, NumberFormats,
│   │                         #   I18nService, locales/*.js, react/ (useI18n, RichText)
│   └── components/           # ← UI React — plein écran responsive (voir App.jsx)
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

## Conventions

- Style inline (`style={{...}}`) comme CRASH-GAME, pas de CSS Modules/Tailwind pour l'instant.
- Toute constante de jeu (lanes, deathChance, RTP) vit dans `src/shared/gameConfig.js`,
  jamais dupliquée côté serveur ou composant.
- Le socket est privé par session (`socket.emit`), sauf `cashout:feed` qui est diffusé à
  tous (`io.emit`) — feed cosmétique de gains récents, pas de round partagé.
- Assets réels (PNG) dans `src/assets/{chicken,icons,ui,road}/`, chargés via `Assets.load()`
  (Pixi v8) dans `PixiRenderer.js` — poses de poule (idle/run/victory/ko) swappées selon
  l'état de jeu, route continue en `TilingSprite`. Toute nouvelle couleur d'UI passe par
  `src/theme.js`, jamais un hex codé en dur dans un composant.

**Langues et devises (`src/i18n/`) :** jamais de texte joueur ni de montant formaté en dur
dans un composant. Classes framework-agnostiques : `Translator` (clés pointées, `{param}`,
`{param:money|moneyShort|percent|multiplier}`, pluriels `{ one, other }`, repli anglais),
`NumberFormats` (Intl, devise), `LocaleDetector` (langue : `?lang=` de lancement → choix
mémorisé `chicken:lang` → navigateur → anglais ; pays : `?country=` → région du navigateur ;
devise : `?currency=` → devise du pays → EUR ; les paramètres de lancement sont gardés en
`sessionStorage` car `socketClient.js` les retire de l'URL), `I18nService` (état + snapshot
immuable pour `useSyncExternalStore` — nouveau snapshot à chaque changement, requis par le
React Compiler). Côté React : `useI18n()` et `RichText` (**gras**, *italique*, `code` dans les
traductions). `core/` n'émet que des descripteurs `{ key, params }` (messages, erreurs de mise),
traduits à l'affichage. Ajouter une langue = un fichier `locales/xx.js` (mêmes clés que `en.js`)
+ une ligne dans `locales/index.js`. Hub88 : `gamesApi.js` passe `lang`, `currency` (sauf `XXX`)
et `country` (sauf `XX`) dans l'URL de lancement. Les soldes démo ne sont pas convertis : seule
l'unité affichée change selon la devise détectée.

## État actuel

Prototype fonctionnel : mise, choix de difficulté, avancée case par case, cashout,
provably fair vérifiable, historique, feed de gains, interface plein écran responsive
(pas de scroll de page), skin bois, 6 langues avec détection langue/pays/devise, panneau
Information (mentions obligatoires). RTP validé empiriquement via `npm run rtp-sim`
(Monte Carlo sur le vrai chemin HMAC, cf. `.agents/skills/rtp-simulation/`).

**Interface plein écran responsive (`App.jsx`, `components/`) :** plus de cadre mobile
480×860 — le jeu occupe tout le viewport et la scène Pixi prend la hauteur que les commandes
laissent. Trois media queries pilotent la disposition : `compact` (téléphone ≤760px de haut ou
fenêtre ≤600px de haut ou ≤380px de large : bandeau 52px, ticker « gains récents » masqué,
tuiles/compteur/planches réduits), `rowTray` (≥900px de large ou téléphone en paysage :
panneau à gauche, planches à droite) et `boardRow` (≥1400px, portable ≥1260px peu haut, ou
paysage : difficultés et mise côte à côte dans le panneau). Toutes les grilles sont en
`minmax(0, …)` : un bouton rétrécit dans son bloc, il ne déborde jamais. Côté Pixi,
`sceneScale` va de `MIN_SCENE_SCALE` 0,5 (écrans courts : route/poule/cibles restent
entières) à 2,4 (plafond relevé avec la largeur), et le sol couvre les deux bords d'écran à
toute position de caméra. Test de référence : ≈360×560 (Firefox Android), la scène doit rester
visible.

**Skin bois (`components/woodSkin.js`, `src/assets/ui/*.png`) :** commandes en bois
illustré — `BOARD-WOOD` (panneau), `LEVEL-ON/OFF` + `BTN-CHECK-*` (difficultés),
`MISE-COUNTER` + `BTN-UP/DOWN-*` + `MISE-BTN` (mise, menu ☰), `PLAY-BTN-ACTIVE/CLICK/OFF`
(Jouer/Avancer en rouge, Encaisser en bois patiné `OFF`), `CARTOUCHE-*` (solde, message),
`EDGE-TOP-BOTTOM` (moulures de la scène), `BG-HEADER.jpg` (bandeau, logo peint dedans ; `h1`
vide `aria-label="CHICKEN NINJA"` superposé). Les assets à coins/rivets passent par
`frame()` (neuf-tranches `border-image`), jamais un `background-size: 100% 100%`. Lettrage
Alegreya 800 (`theme.fontWood`). Détails visuels : `DESIGN.md`.

**Panneau Information (`components/InfoPanel.jsx`, `src/legalInfo.js`) :** mentions
obligatoires — règles, RTP, équité, jeu responsable, mentions légales, données — ouvertes par
la pastille « i » (bas droite de la scène) ou le menu ☰. Textes dans `src/i18n/locales/*.js`
(`info.*`), chiffres (probabilités, multiplicateurs, RTP, limites de mise) calculés depuis
`gameConfig.js` au rendu. Éditeur/hébergeur dans `legalInfo.js` (`null` → « À compléter »
affiché ; l'hébergeur reste à remplir). Pas de mentions propres à la réglementation française
(ANJ, Joueurs Info Service, CNIL) : choix produit, le jeu vise l'international.

**Devises crypto :** non gérées volontairement (BTC/ETH s'affichent avec 2 décimales,
USDT/mBTC retombent sur la devise du pays ; limites de mise 1–200 quelle que soit la devise).
À faire seulement si un provider le demande : registre crypto (symbole, décimales,
sous-unités) dans `NumberFormats` + limites de mise par devise côté `roundEngine.js`.

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

Pas encore : hébergeur à renseigner dans `legalInfo.js`, relecture native des traductions,
devises crypto, sons avancés, tests automatisés (aucun
fichier de test dans le repo), load testing sur `server/index.js` (mêmes gaps que
CRASH-GAME, voir son `PROTOCOL.md`).
