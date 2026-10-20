# Chicken Ninja

Jeu casino type **Chicken Road**, thème ninja : la poule avance case par case sur une route
du désert, esquive des étoiles ninja, et peut encaisser à tout moment. **Provably Fair**
(HMAC-SHA256), rendu **PixiJS v8** avec sprites illustrés, interface en bois sculpté,
**plein écran responsive** (téléphone, paysage, portable, grand écran), **multilingue**, avec
écrans de gain/perte et musique d'ambiance japonaise synthétisée (bouton ♪ pour la couper).

Base architecturale reprise de [`CRASH-GAME`](../../CRASH-GAME), adaptée à une mécanique
par étapes discrètes (solo contre la maison, pas de round partagé).

## Stack

| Couche | Techno |
|--------|--------|
| Frontend | React 19, Vite 8 |
| Rendu graphique | PixiJS v8 (WebGL/WebGPU) — sprites réels (`src/assets/`) |
| Backend | Node.js, Express, Socket.IO |
| Temps réel | Socket.IO — session privée par joueur |
| Fairness | HMAC-SHA256, calculé case par case, à la demande |
| Langues / devises | `src/i18n/` maison (Intl) — EN (défaut), FR, ES, DE, IT, PT |
| Agrégateur | Adaptateur Hub88 (`server/platforms/hub88/`, voir `HUB88_INTEGRATION.md`) |

## Lancer le projet

```bash
npm install
npm run dev
```

- Frontend : http://localhost:5173
- Serveur : http://localhost:3001

Tests : `npm run lint`, `npm run rtp-sim` (ou `-- --deep`), `npm run concurrency-test`,
`npm run hub88-mock-test`.

## Règles du jeu

1. Choisissez une difficulté (Easy/Facile, Medium/Moyen, Hard/Difficile, Extreme/Extrême) —
   plus c'est risqué, plus le multiplicateur grimpe vite.
2. Misez (1 à 200 unités), puis avancez case par case. Chaque case franchie augmente le multiplicateur.
3. Encaissez à tout moment dès la 1ʳᵉ case franchie, ou continuez pour un gain plus élevé.
4. Une étoile ninja met fin au tour — la mise est perdue.
5. Une déconnexion avant la 1ʳᵉ case rembourse la mise ; après, la mise est perdue (pas
   d'encaissement automatique).
6. Chaque tour est vérifiable via **Provably Fair** (menu ☰).
7. À la fin du tour, un écran de gain (montant gagné) ou de perte (message de relance)
   s'affiche, avec un bouton « Rejouer » ; la table revient seule à l'écran de mise au bout
   de 6 secondes si vous ne relancez pas de tour.

Les règles complètes, le RTP, l'équité, le jeu responsable, les mentions légales et la
politique de données sont dans le panneau **Information** (bouton « i » sur la scène, ou
menu ☰), traduit dans toutes les langues et calculé à partir de `src/shared/gameConfig.js`.

## Provably fair

```
issue_case = HMAC-SHA256(serverSeed, "clientSeed:nonce:step") → r ∈ [0,1)
r < deathChance(difficulté) → étoile ninja
```

Le `serverSeedHash` est publié avant le tour, le `serverSeed` brut révélé à l'encaissement
ou à la défaite — n'importe qui peut recalculer l'issue de chaque case.

## Paramètres de jeu

| Difficulté | Cases | Risque / case | RTP case 1 et case 8+ | RTP minimum (case 2) |
|-----------|-------|----------------|------|------|
| Easy      | 200   | 3 %  | 97 % | 95,7 % |
| Medium    | 200   | 7 %  | 97 % | 94,0 % |
| Hard      | 200   | 15 % | 97 % | 90,6 % |
| Extreme   | 200   | 30 % | 97 % | 84,1 % |

RTP théorique de 97 %, réduit entre les cases 2 et 7 (edge progressif anti-« double facile »,
voir `CLAUDE.md`). Les 200 cases sont un plafond, pas un objectif : la dernière case déclenche
un encaissement automatique.

## Langues et devises

Langue : `?lang=` du lancement → choix du joueur (menu ☰) → navigateur → anglais.
Devise : `?currency=` du lancement → devise du pays détecté → EUR. Les soldes de démonstration
ne sont pas convertis, seule l'unité affichée change. Pas de devises crypto pour l'instant.
Ajouter une langue : `src/i18n/locales/xx.js` + une ligne dans `src/i18n/locales/index.js`.

## Mentions légales

Éditeur et hébergeur se renseignent dans `src/legalInfo.js` ; un champ laissé à `null`
s'affiche « À compléter » dans le panneau Information. L'hébergeur reste à compléter.

Voir `CLAUDE.md` pour l'architecture détaillée et `DESIGN.md` pour le système visuel.
