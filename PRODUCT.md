# Product

## Register

product

## Users

Large audience de joueurs casino en ligne, mobile-first (cadre fixe portrait, pas de scroll
de page). Deux profils qui se recoupent : joueurs casual qui ouvrent l'app pour quelques
rounds rapides, et habitués des crash/step games (type Chicken Road) qui comparent
implicitement à ce qu'ils connaissent déjà. Pas de persona unique — optimiser pour la
clarté et la rapidité de compréhension plutôt qu'un profil précis. Le joueur doit
comprendre son état (mise, palier atteint, gain potentiel, risque) en un coup d'œil,
sans lire de texte.

## Product Purpose

Chicken Ninja est un jeu casino "step game" (type Chicken Road) : le joueur mise, avance
case par case sur une route, encaisse à tout moment ou perd sa mise s'il tombe sur une
étoile ninja. Le design sert cette mécanique — chaque écran doit rendre la décision
"avancer ou encaisser" évidente et le résultat de chaque case immédiatement lisible.
Succès = le joueur comprend son risque/gain sans effort cognitif, fait confiance au
caractère provably fair du jeu, et l'expérience reste fluide sur mobile en session courte.

## Brand Personality

Punchy comic-manga : énergie BD/manga, contrastes forts, halftone, accents rouge/or,
sensation d'action (étoiles ninja, coups, avancée). Pas discret, pas feutré — le jeu doit
donner envie de continuer, sans jamais sacrifier la lisibilité des chiffres (mise,
multiplicateur, gain).

Structurellement, on s'inspire de l'UX des step games concurrents établis (organisation
du bet panel : stepper min/max, chips de mise rapide, sélecteur de difficulté, ticker de
gains live, disques de multiplicateur le long de la route) — mais l'habillage visuel reste
100% Chicken Ninja, jamais un skin du concurrent.

## Anti-references

- **Chicken Road 2 visuellement** : on reprend des patterns UX (structure du bet panel,
  ticker, disques multiplicateur), jamais leur identité visuelle neutre/charcoal, leur
  logo, ou leur mascotte. Doit rester immédiatement reconnaissable comme Chicken Ninja.
- **Casino générique or/noir/velours** : pas de feutrine verte, pas d'or clinquant, pas de
  codes "machine à sous vintage".

## Design Principles

- **La décision avant tout** : à chaque instant, le joueur voit son gain actuel, le gain au
  palier suivant, et le risque — sans avoir à chercher l'info.
- **Le fairness est un argument de confiance visible**, pas une page cachée dans un menu :
  le calcul HMAC par case doit rester vérifiable et mis en avant (Drawer/ProvablyFair).
  Voir aussi le protocole HMAC dans `src/shared/gameConfig.js`.
- **Énergie manga sans bruit** : contraste fort et halftone au service de la lisibilité,
  jamais au détriment d'elle — un chiffre de mise ou un multiplicateur ne doit jamais être
  noyé dans la décoration.
- **Mobile-first, cadre fixe** : pas de scroll de page, tout tient dans le viewport fixe
  portrait ; chaque ajout structurel doit d'abord se prouver sur ce format avant desktop.
- **S'inspirer sans cloner** : reprendre des patterns UX éprouvés du genre "step game" est
  légitime, copier l'identité visuelle d'un concurrent nommé ne l'est pas.

## Accessibility & Inclusion

WCAG AA : contraste ≥4.5:1 texte normal / ≥3:1 texte large, jamais de couleur seule pour
porter un état gagné/perdu (icône ou texte en complément), cibles tactiles ≥44px (mise,
avancer, encaisser), `prefers-reduced-motion` respecté pour les animations Pixi et CSS.
