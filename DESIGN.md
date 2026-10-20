---
name: Chicken Ninja
description: Step game casino ninja/manga — scène illustrée, interface en bois sculpté, provably fair, plein écran responsive
colors:
  bg: "#f5ead0"
  bg-deep: "#e9d8ae"
  surface: "#fffaf0"
  surface-alt: "#f2e4c4"
  border: "#2a1810"
  ink: "#1a0e0a"
  ink-muted: "#7a5a3a"
  ink-on-accent: "#fff8e8"
  accent-red: "#c0392b"
  accent-deep: "#8e2a1f"
  accent-gold: "#f0a828"
  info-blue: "#3a6ea8"
  success-green: "#2e8b57"
  danger-red: "#a8281f"
  disabled-bg: "#e2d2ae"
  disabled-ink: "#a89070"
  wood-text: "#fbeed2"
  wood-ink: "#3a1f0e"
  wood-dark: "#3b2414"
typography:
  wood:
    fontFamily: "'Alegreya', Georgia, serif"
    fontWeight: 800
    note: "tous les libellés gravés sur le bois (planches, tuiles, compteur, solde)"
  body:
    fontFamily: "'Inter', Arial, sans-serif"
    fontSize: "13-14px"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "'Inter', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.05em"
  display:
    fontFamily: "'Bangers', 'Inter', Arial, sans-serif"
    note: "écran de chargement uniquement — le logo du bandeau est peint dans BG-HEADER.jpg"
  mono:
    fontFamily: "'JetBrains Mono', 'Courier New', monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
---

# Design System: Chicken Ninja

## 1. Overview

**Creative North Star: "The Wooden Dojo"**

Chicken Ninja se joue comme sur l'étal en bois d'un dojo de campagne : une scène illustrée
(désert, poulailler, cibles d'archerie, étoiles ninja) encadrée de moulures, et en dessous un
panneau de bois sculpté qui porte toutes les commandes — tuiles de difficulté, compteur de
mise, planches d'action. Le bandeau du haut est une estampe japonaise (Fuji, torii, cerisier)
qui porte le logo. L'énergie vient de la matière (bois, rivets, ferrures, papier) et du
contraste rouge/crème, pas du chrome ni du néon.

Le système rejette le charcoal neutre et l'identité visuelle des step games concurrents
établis (structure UX empruntée, jamais l'habillage), et les codes casino traditionnels (or
clinquant, feutrine verte, machine à sous vintage).

**Key Characteristics:**
- Commandes en bois illustré (assets `src/assets/ui/*.png`), jamais des boutons CSS plats
- Rouge planche pour l'action et la sélection, bois patiné pour l'encaissement, bois brut pour le reste
- Lettrage serif gravé (Alegreya 800) crème sur bois foncé, brun sur bois clair
- Plein écran responsive : la scène prend toute la place que les commandes lui laissent
- Fond papier chaud autour (`#e9d8ae`), jamais sombre ni neutre-froid

## 2. Colors

Les couleurs des commandes viennent surtout des textures bois elles-mêmes ; les tokens
ci-dessous (tous dans `src/theme.js`) couvrent le reste de l'interface et le texte posé sur le bois.

### Bois (texte sur les assets)
- **Crème gravé** (`wood-text`, `#fbeed2`) : libellés sur bois foncé et planches rouges, avec ombre portée sombre.
- **Encre bois** (`wood-ink`, `#3a1f0e`) : libellés sur bois clair (tuiles non sélectionnées, compteur, cartouche du solde).
- **Bois sombre** (`wood-dark`, `#3b2414`) : fond de secours derrière le panneau, en-tête du panneau Information.

### Accents
- **Encre Rouge** (`#c0392b`) : onglet actif, liens, erreurs ; la planche rouge porte Jouer/Avancer.
- **Or Dojo** (`#f0a828`) : liseré de la tuile de difficulté sélectionnée, compteur « X restantes », erreurs de mise sur bois.
- **Bleu Info** (`#3a6ea8`) : boutons secondaires du menu (dépôt, vérificateur provably fair) uniquement.

### Neutres
- **Papier** (`#f5ead0`) : fond de la scène pendant le chargement.
- **Papier Profond** (`#e9d8ae`) : fond de la zone de commandes, autour du panneau bois.
- **Surface Ivoire** (`#fffaf0`) / **Surface Alt** (`#f2e4c4`) : bandeau (au-delà de l'estampe), menu ☰, panneau Information.
- **Encre** (`#1a0e0a`) / **Encre Sourde** (`#7a5a3a`) : texte des panneaux non-bois.
- **Vert Succès** / **Rouge Danger** : états gagné/perdu dans l'historique et le vérificateur, toujours doublés d'un texte.

### Named Rules
**The Plank Rule.** Une action de jeu = une planche `PLAY-BTN-*`. Rouge (`ACTIVE`) pour Jouer
et Avancer, bois patiné (`OFF`) pour Encaisser, orange (`CLICK`) à l'appui. Pas de bouton CSS
coloré pour une action de jeu.

## 3. Typography

**Wood Font:** 'Alegreya' 700-800 (fallback Georgia, serif)
**Body Font:** 'Inter' (fallback Arial, sans-serif)
**Mono Font:** 'JetBrains Mono', pour les hash HMAC et seeds provably fair

**Character:** Alegreya donne l'effet « gravé au fer » sur toutes les commandes en bois
(petites capitales sur les planches) ; Inter reste la police des panneaux de lecture (menu ☰,
panneau Information) où la lisibilité de texte long prime.

### Hierarchy
- **Planche** (Alegreya 800, small-caps, 17px compact → 22px mobile → `clamp(15px, 1.35vw, 26px)` grand écran) : Jouer / Avancer / Encaisser.
- **Tuile / compteur** (Alegreya 800, 12-20px) : difficultés, mise, Min/½/2×/Max, solde du bandeau.
- **Titres de panneau** (Alegreya 800, 18-20px, `accent-deep`) : sections du panneau Information.
- **Body** (Inter 400-700, 13-14px) : texte du menu et du panneau Information.
- **Mono** (12px) : hash serveur, seed client, nonce.

### Named Rules
**The Fit-The-Wood Rule.** Un libellé ne déborde jamais de son asset : les tailles se
réduisent en mode compact, l'étiquette du compteur rétrécit selon la longueur du mot traduit
(« Einsatz », « Puntata »), les tuiles tronquent avec une ellipse en dernier recours.

## 4. Elevation

La profondeur est portée par les textures (rivets, cadres, planches en relief), pas par des
ombres CSS. Ombres autorisées :
- **scene-edge** (`0 0 6px rgba(20,8,2,0.5)`) : sous les deux moulures `EDGE-TOP-BOTTOM.png` qui encadrent la scène.
- **wood-text-shadow** : sous le lettrage crème gravé, pour le détacher du bois.
- **scene-vignette** (dégradés encre haut/bas, `PixiRenderer.js`) : cadre l'attention sur la route.
- **dialog-shadow** : sous le panneau Information, seul composant flottant.
- **info-button** : légère ombre sous la pastille « i » posée sur la scène.

## 5. Components

### Panneau de commandes (`BOARD-WOOD.png`)
Neuf-tranches CSS (`border-image`, helper `frame()` de `src/components/woodSkin.js`) : coins
et rivets à taille native, centre étiré — le même PNG couvre toutes les largeurs. Contient
les difficultés, le message d'état et la mise ; empilés sur téléphone et jusqu'à 1400px,
côte à côte sur grand écran, en paysage téléphone et sur portable peu haut.

### Difficultés (`LEVEL-ON/OFF.png` + `BTN-CHECK-ON/OFF.png`)
Tuile rouge pour la sélection (liseré or), bois brut sinon, pastille radio cochée ✓ sur la
sélection. En mode compact (téléphone, écran court) : tuiles de 46px, pastille masquée.

### Mise (`MISE-COUNTER.png`, `BTN-UP/DOWN-*`, `MISE-BTN.png`)
Compteur : étiquette sur la partie bois clair, champ sur la partie papier, symbole de devise
du côté attendu par la locale (« 10 € », « $10 »), flèches ±1 dorées au survol/appui. Min / ½ /
2× / Max en blocs `MISE-BTN`. Une seule grille `minmax(0, …)` : la rangée rétrécit toujours
dans son bloc.

### Planches d'action (`PLAY-BTN-ACTIVE/CLICK/OFF.png`)
Voir The Plank Rule. Encaisser indisponible (avant la 1ʳᵉ case) = planche patinée pâlie et
grisée. Montant lié au symbole par espace insécable.

### Bandeau (`BG-HEADER.jpg`, `CARTOUCHE-WHITE.png`)
Estampe calée à gauche, ajustée à la hauteur du bandeau (84px grand écran, 64px mobile,
52px compact), logo peint dedans ; son bord droit se fond dans `surface`. Sur téléphone
l'image est décalée vers la gauche pour que le logo dégage le solde. Solde dans un cartouche
papier, menu ☰ sur un bloc `MISE-BTN`. Le titre accessible « CHICKEN NINJA » est un `h1`
vide superposé au logo peint.

### Scène (PixiJS)
Encadrée par deux moulures `EDGE-TOP-BOTTOM.png` (23px, 12px en compact). L'échelle suit la
hauteur (0,5 à 2,4 selon la largeur) pour que route, poule et cibles restent entières.
Pastille « i » (`BTN-CHECK-OFF.png`) en bas à droite, à l'opposé de la poule.
- **État de case** : cercle plein centré — prochain saut (or, 0.55), validée (vert, 0.45),
  crash (rouge, 0.7 + icône X). Le crash reste le seul état doublé d'une icône.

### Écrans de fin de tour (`BOARD-WIN.png`, `BOARD-LOOSE.png`)
Panneau bois rouge centré sur la scène, apparition en rebond (280 ms) une fois l'animation de
la poule terminée, voile sombre léger derrière. Gain : poule au katana à gauche, « Gagné ! »,
montant en or (Alegreya, grand), détail multiplicateur/case. Perte : poule KO en bas à
gauche, texte aligné à droite, relance en or (« Prêt pour un nouveau tour ? »). Planche
« Rejouer » `PLAY-BTN-*` dans les deux cas, croix ✕ sur une pastille `BTN-CHECK-OFF` dans le
coin libre de l'illustration. Taille en unités de conteneur : le panneau et son texte suivent
la taille de la scène.

### Musique (bouton ♪)
Bloc `MISE-BTN` à gauche du menu ☰ dans le bandeau ; note barrée et bloc pâli quand la
musique est coupée (l'état ne repose pas sur la couleur).

### Poule au repos
Respiration et balancement très légers en pose d'attente (`PixiRenderer`, constantes
`IDLE_*`), jamais de sautillement ; immobile si « réduire les animations » est activé.

### Menu ☰ (Drawer) et panneau Information
Panneaux de lecture en Inter sur `surface`/`surface-alt` (cartes radius 10-16px, bordures
`borderSoft`). Menu : langue, devise, portefeuille, Provably Fair, historique, lien vers
Information. Panneau Information : en-tête bois sombre, onglets en pastilles (actif rouge),
corps défilant ; fermeture par ✕, clic hors panneau ou Échap.

### Named Rules
**The Color-Plus-Marker Rule.** Un état (case, tuile, résultat) n'est jamais porté par la
seule couleur : icône X du crash, ✓ de la tuile sélectionnée, texte « Perdu/Encaissé » dans
l'historique.

## 6. Do's and Don'ts

### Do:
- **Do** passer par les assets bois et `frame()` (`woodSkin.js`) pour toute nouvelle commande de jeu.
- **Do** vérifier chaque ajout sur un téléphone court (≈360×560) avant le desktop : la scène doit rester visible.
- **Do** tester les libellés dans la langue la plus longue (allemand) — voir The Fit-The-Wood Rule.
- **Do** formater tout montant via `fmt` (`useI18n()`), jamais un « € » codé en dur.
- **Do** doubler tout état gagné/perdu d'un texte ou d'une icône.

### Don't:
- **Don't** étirer un asset bois avec `background-size: 100% 100%` quand il a des coins/rivets — utiliser le neuf-tranches.
- **Don't** cloner visuellement un concurrent nommé (palette charcoal neutre, logo, mascotte).
- **Don't** utiliser les codes casino génériques : or clinquant, feutrine verte, machine à sous vintage.
- **Don't** faire porter un état de jeu par la seule couleur.
