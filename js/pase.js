// Pase de abordar para historias (1080×1920). Funciona sin WebGL: si hay foto del asiento (3D), va arriba;
// si no, se dibuja el planeta en 2D. Nunca dice "oficial", "propiedad" ni "certificado".
import { CLASES } from './asientos.js';

const W = 1080, H = 1920;
const COL = { cafe: '#362011', osc: '#1e1209', noche: '#0b0a10', tinto: '#4D0C10', azul: '#C7D8EE', mant: '#FAECB2', texto: '#F4ECDD', oro: '#F2C14E', plata: '#D9DEE6' };
const COLOR_CLASE = { cabina: COL.azul, anillo: COL.oro, orbita: COL.plata, luna: '#CDBCFF', turista: '#F2E6C8' };
const MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function fechaCorta(iso) {
  if (!iso) return '—';
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000); // hora de Colombia
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function semilla(texto) { let h = 2166136261; for (const ch of String(texto)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rnd(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

function planeta2D(x, cx, cy, r) {
  x.save();
  x.lineCap = 'round';
  const anillo = (desde, hasta) => {
    [[COL.tinto, 1.0], ['#8a2a2e', 0.92], [COL.mant, 0.8], [COL.azul, 0.66]].forEach(([c, k]) => {
      x.strokeStyle = c; x.lineWidth = r * 0.09; x.globalAlpha = 0.9;
      x.beginPath(); x.ellipse(cx, cy, r * 2.3 * k, r * 0.52 * k, -0.32, desde, hasta); x.stroke();
    });
    x.globalAlpha = 1;
  };
  anillo(Math.PI, Math.PI * 2);
  const g = x.createRadialGradient(cx - r * 0.4, cy - r * 0.4, r * 0.05, cx, cy, r);
  g.addColorStop(0, '#7fb2d3'); g.addColorStop(0.5, '#2c6386'); g.addColorStop(1, '#091a2b');
  x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.clip();
  const rr = rnd(42);
  for (let i = 0; i < 7; i++) { x.fillStyle = i % 3 ? 'rgba(66,110,52,.85)' : 'rgba(140,105,64,.8)'; x.beginPath(); x.ellipse(cx + (rr() - 0.5) * r * 1.4, cy + (rr() - 0.5) * r * 1.4, r * (0.12 + rr() * 0.25), r * (0.08 + rr() * 0.15), rr() * 3, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(cx + (rr() - 0.5) * r * 1.6, cy + (rr() - 0.5) * r * 1.6, r * (0.15 + rr() * 0.3), r * 0.04, -0.3, 0, Math.PI * 2); x.fill(); }
  const sombra = x.createLinearGradient(cx + r, cy - r, cx - r, cy + r);
  sombra.addColorStop(0.35, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,.75)');
  x.fillStyle = sombra; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  x.restore();
  anillo(0, Math.PI);
  x.restore();
}

function ajustarTexto(x, texto, maxAncho, px, peso, familia) {
  let s = px;
  do { x.font = `${peso} ${s}px ${familia}`; s -= 4; } while (x.measureText(texto).width > maxAncho && s > 30);
  return s + 4;
}

// pasajero: fila de la base. info: { investigadora }. foto: canvas con la vista del asiento (opcional).
export async function crearPase(pasajero, { foto = null } = {}) {
  await Promise.all(['800 40px Panchang', '500 40px "DM Mono"', '600 40px Switzer', '900 40px Switzer'].map((f) => document.fonts.load(f).catch(() => {})));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const color = COLOR_CLASE[pasajero.clase] || COL.texto;
  const clase = CLASES[pasajero.clase];

  // fondo
  const fondo = x.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, COL.noche); fondo.addColorStop(1, COL.osc);
  x.fillStyle = fondo; x.fillRect(0, 0, W, H);
  const r = rnd(semilla(pasajero.usuario));
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(244,236,221,${0.15 + r() * 0.6})`; const s = r() < 0.92 ? 2 : 4; x.fillRect(r() * W, r() * 900, s, s); }

  // imagen de arriba: la vista desde el asiento (3D) o el planeta (2D)
  const FOTO_H = 860;
  if (foto) {
    const k = Math.max(W / foto.width, FOTO_H / foto.height);
    const fw = foto.width * k, fh = foto.height * k;
    x.save(); x.beginPath(); x.rect(0, 0, W, FOTO_H); x.clip();
    x.drawImage(foto, (W - fw) / 2, (FOTO_H - fh) / 2, fw, fh);
    x.restore();
  } else {
    planeta2D(x, W * 0.52, 470, 210);
  }
  const vel = x.createLinearGradient(0, FOTO_H - 380, 0, FOTO_H + 10);
  vel.addColorStop(0, 'rgba(30,18,9,0)'); vel.addColorStop(1, COL.osc);
  x.fillStyle = vel; x.fillRect(0, FOTO_H - 380, W, 390);
  const velArriba = x.createLinearGradient(0, 0, 0, 460);
  velArriba.addColorStop(0, 'rgba(11,10,16,.92)'); velArriba.addColorStop(0.6, 'rgba(11,10,16,.7)'); velArriba.addColorStop(1, 'rgba(11,10,16,0)');
  x.fillStyle = velArriba; x.fillRect(0, 0, W, 460);

  // encabezado (debajo de la zona que tapa Instagram arriba)
  x.textBaseline = 'alphabetic';
  x.fillStyle = COL.mant; x.font = '800 54px Panchang'; x.fillText('SATURNOID', 80, 300);
  x.fillStyle = COL.azul; x.font = '500 28px "DM Mono"'; x.fillText('PASE DE ABORDAR', 82, 346);
  x.textAlign = 'right'; x.fillStyle = 'rgba(244,236,221,.7)'; x.fillText('UNA SERIE DE NOID', W - 80, 346); x.textAlign = 'left';

  // tarjeta
  const top = FOTO_H - 40, izq = 60, ancho = W - 120, alto = 760;
  x.fillStyle = 'rgba(54,32,17,.94)';
  x.beginPath(); x.roundRect(izq, top, ancho, alto, 36); x.fill();
  x.strokeStyle = color; x.globalAlpha = 0.6; x.lineWidth = 3; x.stroke(); x.globalAlpha = 1;

  x.fillStyle = color; x.font = '500 30px "DM Mono"';
  x.fillText(clase.nombre.toUpperCase(), izq + 50, top + 80);
  if (pasajero.ascendido_en) { x.textAlign = 'right'; x.fillText(`ASCENDIDO · EP. ${pasajero.ascendido_en}`, izq + ancho - 50, top + 80); x.textAlign = 'left'; }
  const usuario = `@${pasajero.usuario}`;
  const px = ajustarTexto(x, usuario, ancho - 100, 96, 900, 'Switzer');
  x.fillStyle = COL.texto; x.font = `900 ${px}px Switzer`; x.fillText(usuario, izq + 50, top + 120 + px);

  const celda = (et, val, cx, cy, grande = false) => {
    x.fillStyle = 'rgba(244,236,221,.6)'; x.font = '500 24px "DM Mono"'; x.fillText(et, cx, cy);
    x.fillStyle = grande ? color : COL.texto; x.font = grande ? '800 64px Panchang' : '500 40px "DM Mono"'; x.fillText(val, cx, cy + (grande ? 76 : 54));
  };
  const y1 = top + 300, col2 = izq + ancho / 2 + 10;
  celda('ASIENTO', pasajero.asiento, izq + 50, y1, true);
  celda(pasajero.es_tripulacion ? 'TRIPULACIÓN' : 'PASAJERO Nº', pasajero.es_tripulacion ? 'FUNDADORA' : String(pasajero.numero ?? '—').padStart(4, '0'), col2, y1, !pasajero.es_tripulacion);
  const y2 = y1 + 150;
  celda('ABORDÓ', pasajero.es_tripulacion ? 'DESDE EL INICIO' : fechaCorta(pasajero.comentado_en), izq + 50, y2);
  celda('EPISODIO', pasajero.episodio ? String(pasajero.episodio) : '—', col2, y2);
  const y3 = y2 + 120;
  celda('DESDE', (pasajero.ciudad || 'LA TIERRA').toUpperCase().slice(0, 18), izq + 50, y3);
  celda('DESTINO', 'SATURNOID', col2, y3);

  // perforación y talón con código de barras (dibujo, sale igual siempre para el mismo usuario)
  const yp = top + alto + 10;
  x.strokeStyle = 'rgba(244,236,221,.35)'; x.setLineDash([14, 12]); x.lineWidth = 3;
  x.beginPath(); x.moveTo(izq + 20, yp + 20); x.lineTo(izq + ancho - 20, yp + 20); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(54,32,17,.94)'; x.beginPath(); x.roundRect(izq, yp + 40, ancho, 170, 30); x.fill();
  let bx = izq + 50; const br = rnd(semilla(pasajero.usuario + pasajero.asiento));
  x.fillStyle = COL.texto;
  while (bx < izq + 470) { const w = 3 + Math.floor(br() * 4) * 3; x.fillRect(bx, yp + 75, w, 100); bx += w + 4 + Math.floor(br() * 3) * 3; }
  x.fillStyle = COL.mant; x.font = '500 30px "DM Mono"'; x.fillText('noidcorp.com/saturnoid', izq + 510, yp + 118);
  x.fillStyle = 'rgba(244,236,221,.6)'; x.font = '500 22px "DM Mono"'; x.fillText('BUSCA TU ASIENTO', izq + 510, yp + 160);
  x.fillStyle = 'rgba(244,236,221,.45)'; x.font = '400 22px Switzer'; x.textAlign = 'center';
  x.fillText('Saturnoid es una serie de ficción de NOID · @noidd.corp', W / 2, H - 70);
  return cv;
}

export function aBlob(cv) { return new Promise((ok) => cv.toBlob((b) => ok(b), 'image/png')); }
