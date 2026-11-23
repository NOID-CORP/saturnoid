#!/usr/bin/env node
// Datos de ejemplo para probar la web (usuarios "prueba_0001"…, marcados es_prueba = true).
//   node admin/prueba.mjs crear [300]
//   node admin/prueba.mjs borrar
// Mientras existan, la web muestra el aviso "DATOS DE PRUEBA". Borrarlos SIEMPRE antes de publicar el episodio.
import { sql, preguntar, leerEstado, leerOcupacion, planificar, insertarSQL } from './lib.mjs';

const [accion, cuantos = '300'] = process.argv.slice(2);
const CIUDADES = ['Bucaramanga', 'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Pereira', 'Cúcuta',
  'Floridablanca', 'Girón', 'Manizales', 'Santa Marta', 'Villavicencio', 'Ibagué', 'Pasto', null];

if (accion === 'crear') {
  const n = parseInt(cuantos, 10);
  const estado = await leerEstado();
  const ocup = await leerOcupacion();
  const base = Date.parse('2026-11-23T10:00:00-05:00');
  const nuevos = [];
  for (let i = 1; i <= n; i++) {
    const usuario = `prueba_${String(i).padStart(4, '0')}`;
    if (ocup.usados.has(usuario)) continue;
    nuevos.push({ usuario, ciudad: CIUDADES[(i * 7) % CIUDADES.length], hora: new Date(base + i * 41_000).toISOString() });
  }
  const { plan, cuenta } = planificar(nuevos, ocup, estado);
  console.log(`Crear ${plan.length} pasajeros de prueba → anillo ${cuenta.anillo}, órbita ${cuenta.orbita}, luna ${cuenta.luna}, turista ${cuenta.turista}`);
  if (!(await preguntar('¿Crear? (s/n) '))) process.exit(0);
  for (let i = 0; i < plan.length; i += 400) await sql(insertarSQL(plan.slice(i, i + 400), estado.episodio_actual || 1, true));
  console.log('Listo.');
} else if (accion === 'borrar') {
  const [{ n }] = await sql('select count(*)::int as n from public.saturnoid_pasajeros where es_prueba');
  if (!n) { console.log('No hay datos de prueba.'); process.exit(0); }
  if (!(await preguntar(`¿Borrar ${n} pasajeros de prueba? (s/n) `))) process.exit(0);
  await sql('delete from public.saturnoid_pasajeros where es_prueba');
  console.log('Borrados.');
} else {
  console.log('Uso: node admin/prueba.mjs crear [300] | borrar');
}
