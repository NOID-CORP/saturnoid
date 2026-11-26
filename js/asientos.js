// Clases, códigos de asiento y vecinos. Lo usan la web (navegador) y los scripts de admin/ (Node):
// un solo lugar decide cómo se llama cada asiento y quién queda al lado de quién.

export const CLASES = {
  cabina: { nombre: 'Cabina de mando', corto: 'Cabina', letra: 'C', tag: 'cabina' },
  anillo: { nombre: 'Clase Anillo', corto: 'Anillo', letra: 'A', tag: 'oro' },
  orbita: { nombre: 'Clase Órbita', corto: 'Órbita', letra: 'O', tag: 'plata', porFila: 4, letras: 'ABCD' },
  luna: { nombre: 'Clase Luna', corto: 'Luna', letra: 'L', tag: 'lavanda', porFila: 5, letras: 'ABCDE' },
  turista: { nombre: 'Turista', corto: 'Turista', letra: 'T', tag: 'turista', porFila: 6, letras: 'ABCDEF' },
};
export const ORDEN_CLASES = ['cabina', 'anillo', 'orbita', 'luna', 'turista'];

const pad = (n, k) => String(n).padStart(k, '0');

// i empieza en 0. Cabina C-01 es la investigadora (personaje, no está en la base); la tripulación va de C-02 a C-10.
export function codigoAsiento(clase, i) {
  if (clase === 'cabina') return `C-${pad(i + 1, 2)}`;
  if (clase === 'anillo') return `A-${pad(i + 1, 2)}`;
  const c = CLASES[clase];
  const fila = Math.floor(i / c.porFila) + 1;
  return `${c.letra}-${pad(fila, clase === 'turista' ? 3 : 2)}${c.letras[i % c.porFila]}`;
}

// 'O-12B' → { clase: 'orbita', i: 45, fila: 12, col: 1 }
export function leerAsiento(codigo) {
  const m = /^([CAOLT])-(\d+)([A-F]?)$/.exec(String(codigo || '').toUpperCase());
  if (!m) return null;
  const clase = { C: 'cabina', A: 'anillo', O: 'orbita', L: 'luna', T: 'turista' }[m[1]];
  const n = parseInt(m[2], 10);
  if (clase === 'cabina' || clase === 'anillo') return { clase, i: n - 1, fila: n, col: 0 };
  const c = CLASES[clase];
  const col = c.letras.indexOf(m[3]);
  if (col < 0) return null;
  return { clase, i: (n - 1) * c.porFila + col, fila: n, col };
}

// Asientos alrededor (los que se ven desde el asiento). En cabina, toda la tripulación.
export function vecinos(codigo, filas = 1) {
  const a = leerAsiento(codigo);
  if (!a) return [];
  const out = [];
  if (a.clase === 'cabina') {
    for (let i = 0; i < 10; i++) out.push(codigoAsiento('cabina', i));
  } else if (a.clase === 'anillo') {
    for (let d = -2; d <= 2; d++) if (a.i + d >= 0) out.push(codigoAsiento('anillo', a.i + d));
  } else {
    const c = CLASES[a.clase];
    for (let f = -filas; f <= filas; f++) {
      const fila = a.fila + f;
      if (fila < 1) continue;
      for (let col = 0; col < c.porFila; col++) out.push(codigoAsiento(a.clase, (fila - 1) * c.porFila + col));
    }
  }
  return out.filter((x) => x !== codigo.toUpperCase());
}

// Usuario de Instagram como lo guarda la base: sin @, en minúsculas, sin espacios. Acepta enlaces de perfil.
export function normalizarUsuario(texto) {
  let s = String(texto || '').trim();
  const url = /instagram\.com\/([^/?#\s]+)/i.exec(s);
  if (url) s = url[1];
  s = s.replace(/^@+/, '').replace(/\s+/g, '').toLowerCase();
  return s;
}
export const USUARIO_VALIDO = /^[a-z0-9._]{1,30}$/;

// Nivel de la nave según los pasajeros (sin contar la tripulación) y las metas [motor 1, motor 2, despegue].
export const NIVELES = [
  { nombre: 'Esperando pasajeros', corto: 'En espera' },
  { nombre: 'Motor 1 encendido', corto: 'Motor 1' },
  { nombre: 'Motor 2 encendido', corto: 'Motor 2' },
  { nombre: 'Despegue', corto: 'Despegue' },
];
export function nivelDe(pasajeros, metas) {
  let n = 0;
  for (const m of metas) if (pasajeros >= m) n++;
  return n;
}

// Lo que cada pasajero lleva en las manos en el 3D (escena/objetos.js). La clave va en la columna `objeto`.
export const OBJETOS = {
  fuego: 'Fuego', gato: 'Gato', perro: 'Perro', celular: 'Celular', audifonos: 'Audífonos', computador: 'Computador',
  carro: 'Carro', cama: 'Cama', corazon: 'Corazón (lleva a alguien)', libro: 'Libro', comida: 'Comida', planta: 'Planta',
  musica: 'Guitarra', balon: 'Balón', bucaros: 'Balón del Atlético Bucaramanga', maleta: 'Maleta',
  mundo: 'El mundo entero', herramientas: 'Caja de herramientas', microfono: 'Micrófono dorado (cantantes)', piano: 'Piano de cola',
};
// Dos claves con + (p. ej. «balon+fuego»): el objeto en llamas. La segunda solo puede ser fuego.
export const OBJETO_VALIDO = /^[a-z]{1,20}(\+fuego)?$/;

// Adivina el objeto a partir del comentario. Si puso 🔥, lleva fuego (pedido de DON, 26-nov). Si no se reconoce
// nada, maleta. Siempre se puede corregir a mano en el CSV (columna objeto) antes de subir.
export function adivinarObjeto(texto = '') {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const reglas = [
    ['fuego', /🔥|fuego|candela/u],
    ['gato', /gat[oia]|michi|🐱|🐈/u],
    ['perro', /perr[oia]|mascota|lomito|🐕|🐶/u],
    ['celular', /celu|telefono|movil|iphone|📱/u],
    ['audifonos', /audifono|aud[ií]fonos|airpods|cascos|🎧/u],
    ['computador', /computa|portatil|laptop|pc\b|💻/u],
    ['carro', /carro|auto\b|moto\b|🚗|🏍/u],
    ['cama', /cama|almohada|cobija|🛏/u],
    ['piano', /piano|🎹/u],
    ['herramientas', /herramienta|martillo|taladro|🔧|🛠/u],
    ['mundo', /mundo|la tierra|planeta|🌍|🌎|🌏/u],
    ['microfono', /microfono|cantar|maluma|karol|feid|shakira|🎤/u],
    ['libro', /libro|📚|📖/u],
    ['musica', /guitarra|musica|🎸|🎶|🎵/u],
    ['balon', /balon|pelota|futbol|⚽|🏀/u],
    ['planta', /planta|flor|🌱|🌻|🌹/u],
    ['comida', /comida|pizza|cafe|arepa|empanada|chocolate|🍕|☕/u],
    ['corazon', /\b(llevo|me llevo|traigo) a\b|novi[oa]|mama|papa|herman|amig|❤|💕/u],
  ];
  for (const [clave, re] of reglas) if (re.test(t)) return clave;
  return 'maleta';
}
