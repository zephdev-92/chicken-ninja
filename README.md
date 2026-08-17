# Chicken Ninja

Jeu casino type **Chicken Road**, thème ninja : le poulet avance case par case sur une route
de tatamis, esquive des étoiles ninja, et peut encaisser à tout moment. **Provably Fair**
(HMAC-SHA256), rendu **PixiJS v8** (placeholders `Graphics` pour l'instant).

Base architecturale reprise de [`CRASH-GAME`](../../CRASH-GAME), adaptée à une mécanique
par étapes discrètes (solo contre la maison, pas de round partagé).

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | React 19, Vite 8 |
| Rendu graphique | PixiJS v8 (WebGL/WebGPU) — sprites placeholder |
| Backend | Node.js, Express, Socket.IO |
| Temps réel | Socket.IO — session privée par joueur |
| Fairness | HMAC-SHA256, calculé case par case, à la demande |

## Lancer le projet

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Serveur : http://localhost:3001

## Règles du jeu

1. Choisissez une difficulté (`Facile`, `Moyen`, `Difficile`, `Extrême`) — plus c'est risqué,
   plus le multiplicateur grimpe vite.
2. Misez, puis avancez case par case. Chaque case franchie augmente le multiplicateur.
3. Encaissez à tout moment (dès la 1ère case franchie), ou continuez pour un gain plus élevé.
4. Une étoile ninja met fin au tour — la mise est perdue.
5. Chaque tour est vérifiable indépendamment via le panneau **Provably Fair**.
6. Après un crash ou un encaissement, la table revient seule à l'écran de mise au bout
   de 6 secondes si vous ne relancez pas de tour entre-temps.

## Provably fair

```
issue_case = HMAC-SHA256(serverSeed, "clientSeed:nonce:step") → r ∈ [0,1)
r < deathChance(difficulté) → étoile ninja
```

Le `serverSeedHash` est publié avant le tour, le `serverSeed` brut révélé à l'encaissement
ou à la défaite — n'importe qui peut recalculer l'issue de chaque case.

## Paramètres de jeu

| Difficulté | Cases | Risque / case |
|-----------|-------|----------------|
| Facile    | 24    | 3 %  |
| Moyen     | 24    | 7 %  |
| Difficile | 24    | 15 % |
| Extrême   | 24    | 30 % |

RTP théorique : 97 % (house edge 3 %), identique sur toutes les difficultés.

Voir `CLAUDE.md` pour l'architecture détaillée.
