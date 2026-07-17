# Chicken Ninja

Jeu casino type "Chicken Road", thème ninja : un poulet avance case par case sur une route
de tatamis, évite des étoiles ninja lancées, encaisse son gain à tout moment. Provably fair
(HMAC-SHA256), calculé case par case côté serveur.

Base architecturale reprise de `/media/zephdev/Jeux/CRASH-GAME` (couches core/hooks/components
découplées), adaptée à une mécanique par étapes discrètes plutôt qu'un multiplicateur continu.

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | React 19, Vite 8 |
| Rendu graphique | PixiJS v8 — **placeholders `Graphics`**, pas de spritesheet pour l'instant |
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
│   ├── core/                # ← NE PAS TOUCHER pour changer de frontend (framework-agnostique)
│   │   ├── gameEvents.js    #   Bus d'événements (EventTarget)
│   │   ├── socketClient.js  #   socket.io → gameEvents
│   │   ├── chickenStore.js  #   État pur JS
│   │   └── gameActions.js   #   Actions joueur (wraps socket.emit)
│   ├── animation/PixiRenderer.js  # Scène "route de tatamis", Graphics uniquement
│   ├── hooks/                # ← Spécifique React
│   │   ├── useChickenGame.js #   État + wallet localStorage + actions
│   │   ├── useSound.js       #   Web Audio API (hop / bust / cashout)
│   │   └── useMediaQuery.js
│   └── components/           # ← UI React — cadre mobile fixe (voir App.jsx)
│       ├── Header.jsx, Drawer.jsx (wallet/ProvablyFair/historique, hors flux principal)
│       ├── GameCanvas.jsx, DifficultySelector.jsx, BetPanel.jsx,
│       ├── MultiplierLadder.jsx, ProvablyFair.jsx, CashoutFeed.jsx (ticker "gains récents")
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
- Assets actuels = `Graphics` Pixi (pas de fichiers image). À remplacer par un vrai
  spritesheet (TexturePacker, cf. `ASSETS.md` de CRASH-GAME) une fois le gameplay validé.

## État actuel

Prototype fonctionnel : mise, choix de difficulté, avancée case par case, cashout,
provably fair vérifiable, historique, feed de gains, cadre mobile compact (viewport
fixe, pas de scroll de page). RTP validé empiriquement via `npm run rtp-sim`
(Monte Carlo sur le vrai chemin HMAC, cf. `.claude/skills/rtp-simulation/`).

Pas encore : vrais sprites (placeholders `Graphics` uniquement), sons avancés, tests
automatisés (aucun fichier de test dans le repo), load testing sur `server/index.js`
(mêmes gaps que CRASH-GAME, voir son `PROTOCOL.md`).
