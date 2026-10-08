import { theme } from '../theme';
import board from '../assets/ui/BOARD-WOOD.png';
import levelOn from '../assets/ui/LEVEL-ON.png';
import levelOff from '../assets/ui/LEVEL-OFF.png';
import checkOn from '../assets/ui/BTN-CHECK-ON.png';
import checkOff from '../assets/ui/BTN-CHECK-OFF.png';
import miseBtn from '../assets/ui/MISE-BTN.png';
import miseCounter from '../assets/ui/MISE-COUNTER.png';
import upOn from '../assets/ui/BTN-UP-ON.png';
import upOff from '../assets/ui/BTN-UP-OFF.png';
import downOn from '../assets/ui/BTN-DOWN-ON.png';
import downOff from '../assets/ui/BTN-DOWN-OFF.png';
import playActive from '../assets/ui/PLAY-BTN-ACTIVE.png';
import playClick from '../assets/ui/PLAY-BTN-CLICK.png';
import playOff from '../assets/ui/PLAY-BTN-OFF.png';
import cartoucheWhite from '../assets/ui/CARTOUCHE-WHITE.png';
import cartoucheWood from '../assets/ui/CARTOUCHE-WOOD.png';
import edge from '../assets/ui/EDGE-TOP-BOTTOM.png';
import headerBg from '../assets/ui/BG-HEADER.jpg';

export const WOOD = {
  board, levelOn, levelOff, checkOn, checkOff, miseBtn, miseCounter,
  upOn, upOff, downOn, downOff, playActive, playClick, playOff,
  cartoucheWhite, cartoucheWood, edge, headerBg,
};

// Nine-slice framing via CSS border-image: corners (rivets, metal brackets) keep
// their native size while the plank/panel centre stretches, so one PNG fits any
// element width without the corners smearing. `slice` is in source pixels,
// `width` is the on-screen thickness of the framed edge.
export function frame(img, slice, width) {
  return {
    boxSizing: 'border-box',
    borderStyle: 'solid',
    borderColor: 'transparent',
    borderWidth: width,
    borderImage: `url(${img}) ${slice} fill / ${width} stretch`,
    background: 'none',
  };
}

// Engraved cream lettering used on every dark/red wood surface.
export const woodText = {
  fontFamily: theme.fontWood,
  fontWeight: 800,
  color: theme.woodText,
  textShadow: `0 2px 0 ${theme.woodShadow}, 0 0 4px ${theme.woodShadow}`,
};

// Dark-brown lettering for light wood/paper surfaces (LEVEL-OFF, counter, cartouche).
export const inkText = {
  fontFamily: theme.fontWood,
  fontWeight: 800,
  color: theme.woodInk,
};
