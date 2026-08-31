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
- Toute constante de jeu (lanes, deathChance, RTP) vit dans `src/shared/gameConfig.js`,
  jamais dupliquée côté serveur ou composant.
- Le socket est privé par session (`socket.emit`), sauf `cashout:feed` qui est diffusé à
  tous (`io.emit`) — feed cosmétique de gains récents, pas de round partagé.
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

Pas encore : bordure de panneau BD (pas d'asset haute résolution fourni), logo/trophée
dédié (wordmark texte + icône étoile en stand-in), tests automatisés (aucun fichier de
test dans le repo), load testing sur `server/index.js` (mêmes gaps que CRASH-GAME, voir
son `PROTOCOL.md`).
