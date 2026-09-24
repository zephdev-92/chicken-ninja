import { theme } from '../theme';
import bgBeige from '../assets/ui/bouton-background-beige.png';
import bgBleu from '../assets/ui/bouton-background-bleu.png';
import bgJaune from '../assets/ui/bouton-background-jaune.png';
import bgVert from '../assets/ui/bouton-background-vert.png';
import bgLevel from '../assets/ui/bouton-background-level.png';

// High-res (710×153) flat backgrounds; the red outline and bottom edge are drawn in CSS
// so the border stays crisp and undistorted at any button width / device pixel ratio.
// `base` fills any transparent corner pixel of the PNG under the CSS border-radius.
const SKINS = {
  beige: { img: bgBeige, base: theme.skinBeige, text: theme.accent },
  bleu:  { img: bgBleu,  base: theme.skinBleu,  text: theme.navy },
  jaune: { img: bgJaune, base: theme.skinJaune, text: theme.accent },
  vert:  { img: bgVert,  base: theme.skinVert,  text: theme.navy },
  // Target pattern, centered rather than left-anchored so the rings stay symmetric
  level: { img: bgLevel, base: theme.skinLevel, text: theme.accent, position: 'center' },
};

export function skinStyle(variant, { round = false, disabled = false } = {}) {
  const s = SKINS[variant] ?? SKINS.beige;
  return {
    boxSizing: 'border-box',
    backgroundColor: s.base,
    backgroundImage: `url(${s.img})`,
    backgroundSize: 'cover',
    backgroundPosition: s.position ?? 'left center',
    backgroundRepeat: 'no-repeat',
    border: `3px solid ${theme.accent}`,
    borderRadius: round ? '50%' : '12px',
    boxShadow: `0 3px 0 ${theme.accentDeep}`,
    color: s.text,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    filter: disabled ? 'grayscale(0.5)' : 'none',
  };
}
