// @ts-nocheck
import { ASSET_BALL } from './asset_ball';

const asSvg = (markup: string): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
const defs = `
<defs>
  <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#d99752"/><stop offset=".48" stop-color="#a65c2d"/><stop offset="1" stop-color="#542812"/></linearGradient>
  <linearGradient id="wood2" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2a363"/><stop offset=".5" stop-color="#9a5127"/><stop offset="1" stop-color="#4b2411"/></linearGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#101518"/><stop offset=".18" stop-color="#7f898d"/><stop offset=".35" stop-color="#d8ddde"/><stop offset=".52" stop-color="#555e62"/><stop offset=".72" stop-color="#c4cbcd"/><stop offset="1" stop-color="#111619"/></linearGradient>
  <linearGradient id="darkSteel" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#59646a"/><stop offset=".3" stop-color="#20272b"/><stop offset=".72" stop-color="#090d0f"/><stop offset="1" stop-color="#555f64"/></linearGradient>
  <radialGradient id="wheel"><stop offset="0" stop-color="#d89635"/><stop offset=".13" stop-color="#4a2c16"/><stop offset=".18" stop-color="#aeb7ba"/><stop offset=".34" stop-color="#242b2f"/><stop offset=".56" stop-color="#7b8589"/><stop offset=".72" stop-color="#111619"/><stop offset=".9" stop-color="#3b454a"/><stop offset="1" stop-color="#080b0d"/></radialGradient>
  <filter id="shadow" x="-35%" y="-35%" width="170%" height="170%"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#000" flood-opacity=".48"/></filter>
  <filter id="soft" x="-25%" y="-25%" width="150%" height="150%"><feDropShadow dx="0" dy="4" stdDeviation="3" flood-color="#000" flood-opacity=".35"/></filter>
</defs>`;

const bucket = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="230" viewBox="0 0 180 230">${defs}<g filter="url(#shadow)"><path d="M38 64 Q90 2 142 64" fill="none" stroke="#222a2e" stroke-width="10"/><path d="M30 64 H150 L132 205 Q90 222 48 205 Z" fill="url(#steel)" stroke="#151a1d" stroke-width="7"/><ellipse cx="90" cy="66" rx="61" ry="15" fill="#20272a" stroke="#abb4b7" stroke-width="4"/><path d="M49 88 Q90 76 131 88" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="4"/><path d="M55 102 L47 185" stroke="#fff" stroke-opacity=".22" stroke-width="5"/></g></svg>`);
const pulley = (orange: string) => asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">${defs}<g filter="url(#shadow)"><circle cx="60" cy="60" r="53" fill="url(#wheel)" stroke="#101416" stroke-width="7"/><circle cx="60" cy="60" r="37" fill="none" stroke="#b9c1c3" stroke-opacity=".45" stroke-width="4"/><circle cx="60" cy="60" r="12" fill="${orange}" stroke="#39200f" stroke-width="4"/><circle cx="55" cy="53" r="4" fill="#fff" fill-opacity=".38"/></g></svg>`);
const gateFrame = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="365" viewBox="0 0 200 365">${defs}<g filter="url(#soft)"><rect x="25" y="20" width="28" height="320" rx="7" fill="url(#darkSteel)" stroke="#101416" stroke-width="5"/><rect x="147" y="20" width="28" height="320" rx="7" fill="url(#darkSteel)" stroke="#101416" stroke-width="5"/><rect x="13" y="10" width="174" height="37" rx="5" fill="url(#wood)" stroke="#342013" stroke-width="5"/><rect x="7" y="323" width="186" height="30" rx="5" fill="url(#darkSteel)" stroke="#101416" stroke-width="5"/><g fill="#c0c7c9" stroke="#333" stroke-width="2"><circle cx="39" cy="30" r="7"/><circle cx="161" cy="30" r="7"/><circle cx="39" cy="334" r="7"/><circle cx="161" cy="334" r="7"/></g></g></svg>`);
const gatePanel = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="130" height="215" viewBox="0 0 130 215">${defs}<g filter="url(#shadow)"><rect x="8" y="5" width="114" height="202" rx="8" fill="url(#darkSteel)" stroke="#090c0e" stroke-width="7"/><rect x="28" y="37" width="74" height="142" rx="5" fill="url(#wood)" stroke="#3a1e10" stroke-width="5"/><path d="M39 74 Q67 61 91 75 M39 111 Q67 98 91 113 M39 148 Q67 136 91 149" fill="none" stroke="#613218" stroke-width="3" opacity=".65"/><g fill="#c1c8ca"><circle cx="26" cy="24" r="6"/><circle cx="104" cy="24" r="6"/><circle cx="26" cy="190" r="6"/><circle cx="104" cy="190" r="6"/></g></g></svg>`);
const lever = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="430" height="130" viewBox="0 0 430 130">${defs}<g filter="url(#shadow)"><path d="M12 56 L418 56 L418 101 L12 101 Z" fill="#171d20" stroke="#090d0f" stroke-width="6"/><path d="M24 62 H406 V92 H24 Z" fill="url(#wood2)" stroke="#492412" stroke-width="4"/><path d="M55 77 Q155 65 260 81 T380 75" fill="none" stroke="#6b3519" stroke-width="3" opacity=".65"/><g fill="#c1c7c9" stroke="#333" stroke-width="2"><circle cx="30" cy="78" r="8"/><circle cx="400" cy="78" r="8"/></g></g></svg>`);
const leverStand = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="240" height="220" viewBox="0 0 240 220">${defs}<g filter="url(#shadow)"><path d="M120 22 L205 188 H35 Z" fill="url(#darkSteel)" stroke="#111619" stroke-width="8"/><rect x="16" y="181" width="208" height="31" rx="5" fill="url(#darkSteel)" stroke="#111619" stroke-width="7"/><circle cx="120" cy="48" r="27" fill="#171c1f" stroke="#919b9f" stroke-width="8"/><circle cx="120" cy="48" r="10" fill="#0b0f11"/></g></svg>`);
const latch = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="150" height="330" viewBox="0 0 150 330">${defs}<g filter="url(#shadow)"><rect x="54" y="55" width="34" height="250" rx="8" fill="url(#darkSteel)" stroke="#101416" stroke-width="6"/><rect x="34" y="285" width="75" height="30" rx="5" fill="url(#darkSteel)" stroke="#101416" stroke-width="6"/><rect x="43" y="112" width="82" height="34" rx="9" fill="#a93b2b" stroke="#5a1b13" stroke-width="6"/><rect x="73" y="124" width="60" height="17" rx="6" fill="url(#steel)"/><circle cx="71" cy="185" r="19" fill="#20272a" stroke="#a3adb0" stroke-width="6"/></g></svg>`);
const hammer = asSvg(`<svg xmlns="http://www.w3.org/2000/svg" width="220" height="380" viewBox="0 0 220 380">${defs}<g filter="url(#shadow)"><circle cx="66" cy="34" r="23" fill="#11171a" stroke="#a0aaad" stroke-width="7"/><path d="M60 49 L82 55 L136 280 L103 289 Z" fill="url(#wood2)" stroke="#40200f" stroke-width="6"/><path d="M75 79 L83 82 L126 261" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="4"/><g transform="rotate(-14 130 300)"><rect x="48" y="270" width="157" height="82" rx="12" fill="url(#steel)" stroke="#0c1012" stroke-width="8"/><rect x="36" y="278" width="28" height="66" rx="7" fill="#b63d2c" stroke="#661b13" stroke-width="5"/><rect x="190" y="278" width="28" height="66" rx="7" fill="#b63d2c" stroke="#661b13" stroke-width="5"/></g></g></svg>`);

export const PROCEDURAL_MECHANISM_ASSETS = {
  ball2: ASSET_BALL.ball,
  bucket,
  pulley: pulley('#d78a2f'),
  pulley2: pulley('#e49a36'),
  gate_frame: gateFrame,
  gate_panel: gatePanel,
  lever,
  lever_stand: leverStand,
  latch,
  hammer
} as const;
