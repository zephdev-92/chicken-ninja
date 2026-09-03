---
name: Chicken Ninja
description: Step game casino ninja/manga — halftone punchy, provably fair, mobile-first
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
  accent-gold: "#f0a828"
  info-blue: "#3a6ea8"
  success-green: "#2e8b57"
  danger-red: "#a8281f"
  disabled-bg: "#e2d2ae"
  disabled-ink: "#a89070"
typography:
  display:
    fontFamily: "'Bangers', 'Inter', Arial, sans-serif"
    fontSize: "30px"
    fontWeight: 400
    lineHeight: 1
    letterSpacing: "0.02em"
  body:
    fontFamily: "'Inter', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.3
  label:
    fontFamily: "'Inter', Arial, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.05em"
  mono:
    fontFamily: "monospace"
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
components:
  button-primary:
    backgroundColor: "{colors.accent-red}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  button-primary-disabled:
    backgroundColor: "{colors.disabled-bg}"
    textColor: "{colors.disabled-ink}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  button-cashout:
    backgroundColor: "{colors.accent-gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  button-step:
    backgroundColor: "{colors.info-blue}"
    textColor: "{colors.ink-on-accent}"
    rounded: "{rounded.lg}"
    padding: "11px 14px"
  chip-quickbet:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.accent-red}"
    rounded: "{rounded.xs}"
    padding: "4px 6px"
  badge-multiplier:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "4px 3px"
  pill-balance:
    backgroundColor: "{colors.surface-alt}"
    textColor: "{colors.success-green}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
---

# Design System: Chicken Ninja

## 1. Overview

**Creative North Star: "The Halftone Dojo"**

Chicken Ninja lit comme une planche de comic imprimée sur papier crème chaud — pas un néon
de casino, pas un charcoal générique de jeu concurrent. Le fond papier (`#f5ead0`) porte des
aplats francs, des bordures encre nette (`#2a1810`, 1px) et deux accents forts, rouge et or,
utilisés comme des touches d'encre plutôt que du chrome décoratif. L'énergie vient du
contraste et de la discipline, pas du bruit : chaque case du jeu doit se lire comme une case
de BD — nette, immédiate, sans ambiguïté sur ce qui est en jeu.

Le système rejette explicitement le charcoal neutre et l'identité visuelle des step games
concurrents établis (structure UX empruntée, jamais l'habillage), et rejette les codes
casino traditionnels (or clinquant, feutrine verte, machine à sous vintage).

**Key Characteristics:**
- Fond papier chaud, jamais sombre ni neutre-froid
- Deux accents forts (rouge encre, or) utilisés avec parcimonie sur les actions qui comptent
- Aplats et paliers de teinte pour la profondeur, pas d'ombres douces
- Bordures encre nettes (1px, `#2a1810`) plutôt que des séparateurs discrets
- Bangers en display, Inter en corps — contraste franc entre énergie BD et lisibilité utilitaire

## 2. Colors

Palette chaude papier/encre avec deux accents ninja (rouge, or) et un accent fonctionnel bleu
réservé à l'action "avancer".

### Primary
- **Encre Rouge** (`#c0392b`): action principale (miser/jouer), labels de mise, alertes d'erreur inline sur `betError`.

### Secondary
- **Or Dojo** (`#f0a828`): action d'encaisser, badges de warning ("X restantes"), accent doré secondaire du logo.

### Tertiary
- **Bleu Info** (`#3a6ea8`): réservé exclusivement au bouton "Avancer" — seule occurrence de bleu dans le système, pour distinguer sans ambiguïté l'action de progression de celle de mise/encaissement.

### Neutral
- **Papier** (`#f5ead0`): fond principal de l'app.
- **Papier Profond** (`#e9d8ae`): fond du cadre externe (derrière le viewport mobile fixe).
- **Surface Ivoire** (`#fffaf0`): cartes, inputs, panneaux au-dessus du fond papier.
- **Surface Alt** (`#f2e4c4`): bandeau du bet panel, badges secondaires, chips.
- **Encre** (`#1a0e0a`): texte principal, bordures fortes.
- **Encre Sourde** (`#7a5a3a`): texte muet, sous-labels.
- **Encre sur Accent** (`#fff8e8`): texte sur fonds rouge/bleu saturés.
- **Vert Succès** (`#2e8b57`) / **Rouge Danger** (`#a8281f`): états gagné/perdu, toujours doublés d'un texte ou icône (jamais la couleur seule, cf. PRODUCT.md accessibilité).

### Named Rules
**The Two-Accent Rule.** Rouge et or portent toutes les actions et tous les états de jeu. Le bleu n'existe que pour "Avancer" — s'il apparaît ailleurs, c'est une erreur de composition, pas une variation stylistique.

## 3. Typography

**Display Font:** 'Bangers' (fallback 'Inter', Arial, sans-serif)
**Body Font:** 'Inter' (fallback Arial, sans-serif)
**Label/Mono Font:** monospace (system), pour les hash HMAC et seeds provably fair

**Character:** Bangers porte l'énergie BD sur le wordmark et les moments d'impact ; Inter en
weight 600-700 porte tout le reste — l'utilitaire (mise, multiplicateurs, boutons) reste
toujours lisible en priorité sur l'expressif.

### Hierarchy
- **Display** (400, 30px, Bangers, letter-spacing 0.02em): wordmark du header, uniquement.
- **Body** (600-700, 13-14px): boutons, valeurs de mise, labels d'action.
- **Label** (700, 11px, letter-spacing 0.05em, souvent uppercase): badges, chips de difficulté, en-têtes de section dans le Drawer.
- **Mono** (400, 12px, monospace): hash serveur, seed client, nonce — tout ce qui doit être copié/vérifié en provably fair.

### Named Rules
**The Bangers-Once Rule.** Bangers n'apparaît qu'au wordmark. Aucun autre texte du jeu — pas même les gros multiplicateurs — n'utilise le display font ; l'utilitaire reste en Inter pour ne jamais sacrifier la lisibilité des chiffres qui comptent.

## 4. Elevation

Le système est plat par choix : aucune ombre douce type Material. La profondeur est portée
par des paliers de teinte (papier profond → papier → surface ivoire → surface alt) et par des
bordures encre nettes (1px, parfois `borderSoft` en 25% d'opacité pour les séparations
discrètes). Une seule ombre existe dans tout le système : celle du cadre mobile externe,
qui détache le viewport du fond de page — pas une ombre de composant.

### Shadow Vocabulary
- **frame-shadow** (`box-shadow: 0 0 60px rgba(26,14,10,0.35)`): uniquement sur le cadre mobile fixe (`App.jsx`), pour le détacher visuellement du fond `bg-deep`.
- **text-impact** (`text-shadow: 0 1px 2px rgba(0,0,0,0.5)`): sur le texte du bouton d'action principal actif, pour rester lisible sur l'image de fond du bouton.
- **scene-vignette** (deux dégradés linéaires teinte encre `#1a0e0a`, 70px, alpha 0.45 au bord → 0 au centre): haut et bas de la scène PixiJS uniquement (`PixiRenderer.js`), pas un composant UI — cadre l'attention sur la route sans assombrir les contrôles.

### Named Rules
**The Flat-By-Default Rule.** Aucun composant interne (carte, bouton, badge, input) ne porte d'ombre. Seul le cadre externe de l'app en a une, pour le détacher du fond de page — jamais pour "faire flotter" un composant interne.

## 5. Components

Costauds et tactiles : coins bien marqués, bordures nettes, feedback de pression physique
(scale 0.97 au press) plutôt que des transitions douces.

### Buttons
- **Shape:** coins arrondis 12px (`rounded.lg`) sur les boutons d'action pleine largeur ; 7-8px sur les boutons secondaires compacts (min/max de mise).
- **Primary (Jouer):** fond `accent-red` avec image `button-play.png` en blend multiply, texte `ink-on-accent` + `text-shadow` pour la lisibilité, padding 11px 14px.
- **Step (Avancer):** fond `info-blue`, seule occurrence de bleu du système.
- **Cashout (Encaisser):** fond `accent-gold`, texte `ink` (pas `ink-on-accent` — l'or est trop clair pour du texte clair dessus).
- **Disabled:** fond `disabled-bg` (#e2d2ae), texte `disabled-ink` (#a89070), opacity 0.5 sur les chips.
- **Press feedback:** `transform: scale(0.97)` au pointerdown, transition 160ms ease-out — jamais de bounce/elastic (cf. règle Ease-Out du framework impeccable).

### Chips (quick-bet, difficulty)
- **Style:** fond `surface-alt`, bordure 1px `border`, radius 7-9px, texte `accent-red` en 11px/600.
- **State:** opacity 0.5 + `cursor: not-allowed` quand désactivé (hors phase idle).

### Cards / Containers
- **Corner Style:** 12px (bet panel, chips container) à 16px (Drawer sections, ProvablyFair panel).
- **Background:** `surface` (#fffaf0) sur fond `surface-alt`, ou l'inverse selon l'imbrication — jamais de carte sur carte de même teinte.
- **Shadow Strategy:** aucune (cf. Elevation) — la séparation vient de la bordure `borderSoft` et du changement de teinte de fond.
- **Border:** 1px `borderSoft` (rgba(42,24,16,0.25)) par défaut, 1px `border` plein (#2a1810) pour les éléments interactifs (inputs, chips).
- **Internal Padding:** 7-8px (compact, bet panel) à 14-16px (Drawer, ProvablyFair).

### Inputs / Fields
- **Style:** fond `surface-alt`, bordure 1px `border`, radius 8px, texte `ink` 13px/600.
- **Focus:** pas de traitement dédié observé — à définir si un focus-visible clavier est ajouté (WCAG AA).
- **Error:** texte `danger-red` 12px sous le champ, pas de bordure rouge sur l'input lui-même actuellement.

### Navigation (Header + Drawer)
- Header : wordmark Bangers à gauche, pill de solde (`surface-alt`, radius 999px, texte `success-green`) au centre-droit, bouton menu carré 34×34px radius 10px à droite.
- Drawer : panneau latéral plein hauteur, sections en cartes `surfaceAlt`/`surface` imbriquées avec labels uppercase `accent-red` 12px.

### Route de jeu (PixiJS — signature component)
Plus une bande de badges séparée : chaque case affiche son multiplicateur directement sur
le disque `badge-multiplier.png`, posé sur une route scrollante (sable + segments de
route/cibles qui défilent avec la caméra, non répétés à l'identique d'un intervalle à
l'autre — cf. `CLAUDE.md`).
- **État de case** : cercle plein (pas de rectangle) centré sur la case — prochain saut
  (`warning`/or, alpha 0.55), validée (`success`/vert, alpha 0.45), crash (`danger`/rouge,
  alpha 0.7 + icône X, pas de badge). Le crash reste seul état doublé d'une icône ; pending
  n'a aucun aplat (juste le badge).
- **Pourquoi un cercle opaque plutôt qu'un aplat léger** : le fond est maintenant une
  texture route/rochers illustrée, pas un sable uni — un aplat à 0.18-0.35 (valeur
  d'origine, pensée pour un fond plat) s'y noie presque entièrement.

### Named Rules
**The Color-Plus-Marker Rule.** Un état de case (prochain saut/validée/crash) porte
toujours au moins une différence de forme/icône en plus de la couleur — le crash a son
icône X, la disparition du badge signale déjà un état différent des deux autres. Voir
accessibilité (§ Accessibility & Inclusion, PRODUCT.md).

## 6. Do's and Don'ts

### Do:
- **Do** garder le fond papier chaud (`#f5ead0`) comme neutre de base — jamais de dérive vers un charcoal/gris froid.
- **Do** réserver le bleu (`#3a6ea8`) exclusivement au bouton "Avancer".
- **Do** utiliser des bordures encre nettes (1px, `#2a1810` ou `borderSoft`) pour toute séparation, jamais de `border-left` coloré en accent.
- **Do** doubler tout état gagné/perdu d'un texte ou d'une icône, jamais la seule couleur (vert/rouge).
- **Do** garder Bangers réservé au wordmark ; tout le reste en Inter 600-700.
- **Do** s'inspirer de la structure UX des step games concurrents établis (bet panel, ticker, disques de multiplicateur) sans jamais reprendre leur identité visuelle.

### Don't:
- **Don't** ajouter d'ombres douces Material sur les composants internes — seul le cadre externe de l'app en a une.
- **Don't** cloner visuellement un concurrent nommé (palette charcoal neutre, logo, mascotte) — seuls les patterns UX sont empruntables.
- **Don't** utiliser les codes casino génériques : or clinquant, feutrine verte, machine à sous vintage.
- **Don't** utiliser de gradient text ou de glassmorphism décoratif — hors du vocabulaire du système.
- **Don't** faire porter un état de jeu (gagné/perdu/risque) par la seule couleur.
