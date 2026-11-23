-- Saturnoid · Clase Luna (23-nov-2026): pone al día una base creada con la versión anterior de esquema.sql.
-- Pasa de 3 a 4 clases de pasajeros, como lo dice el ep. 1:
--   Anillo 100 (comentarios nº 1–100) · Órbita 300 (101–400) · Luna 200 (401–600) · Turista 400 (601–1.000) = 1.000.
-- Turista 600 se parte en Luna 200 + Turista 400; Anillo y Órbita no cambian. Agrega también el «DÍA N» del viaje.
-- Se corre una vez (repetirlo no hace daño): Supabase → SQL Editor → pegar todo → Run.
-- Después, `node admin/estado.mjs` debe decir: luna 0 y cupos 100/300/200/400.

alter table public.saturnoid_pasajeros drop constraint if exists saturnoid_pasajeros_clase_check;
alter table public.saturnoid_pasajeros add constraint saturnoid_pasajeros_clase_check
  check (clase in ('cabina', 'anillo', 'orbita', 'luna', 'turista'));

alter table public.saturnoid_estado add column if not exists cupo_luna int not null default 200;
alter table public.saturnoid_estado add column if not exists dia_actual int; -- «DÍA N»; vacío = el número del episodio
alter table public.saturnoid_estado alter column cupo_turista set default 400;
update public.saturnoid_estado set cupo_turista = 400, actualizado_en = now() where id = 1 and cupo_turista = 600;

-- El resumen de la portada, ahora con el contador de Luna (igual que en esquema.sql).
create or replace function public.saturnoid_resumen()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'pasajeros',    (select count(*) from saturnoid_pasajeros where not es_tripulacion),
    'tripulacion',  (select count(*) from saturnoid_pasajeros where es_tripulacion),
    'anillo',       (select count(*) from saturnoid_pasajeros where clase = 'anillo' and ascendido_en is null),
    'ascendidos',   (select count(*) from saturnoid_pasajeros where ascendido_en is not null),
    'orbita',       (select count(*) from saturnoid_pasajeros where clase = 'orbita'),
    'luna',         (select count(*) from saturnoid_pasajeros where clase = 'luna'),
    'turista',      (select count(*) from saturnoid_pasajeros where clase = 'turista'),
    'prueba',       (select count(*) from saturnoid_pasajeros where es_prueba),
    'ultimos_ascensos', coalesce((
      select json_agg(json_build_object('usuario', usuario, 'asiento', asiento, 'episodio', ascendido_en) order by asiento)
      from saturnoid_pasajeros
      where not oculto and ascendido_en = (select max(ascendido_en) from saturnoid_pasajeros)
    ), '[]'::json),
    'estado', (select row_to_json(e) from saturnoid_estado e where id = 1)
  );
$$;
revoke all on function public.saturnoid_resumen() from public;
grant execute on function public.saturnoid_resumen() to anon, authenticated;
