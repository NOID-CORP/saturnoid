-- Saturnoid: tablas y permisos en Supabase (proyecto czycgwhcdexmfvvywzsv). Sin datos.
-- Una base creada antes de la Clase Luna se pone al día con clase-luna.sql (no hace falta correr esto otra vez).
-- La web solo LEE (clave pública + RLS de select). Escriben únicamente los scripts de admin/ con el token de administración.

create table if not exists public.saturnoid_pasajeros (
  id             bigint generated always as identity primary key,
  usuario        text not null unique check (usuario ~ '^[a-z0-9._]{1,30}$'),
  clase          text not null check (clase in ('cabina', 'anillo', 'orbita', 'luna', 'turista')),
  asiento        text not null unique,
  numero         int unique,                 -- pasajero nº (orden de llegada); null en la tripulación
  ciudad         text check (char_length(ciudad) <= 60),
  comentado_en   timestamptz,
  episodio       int,
  es_tripulacion boolean not null default false,
  oculto         boolean not null default false, -- pidió que lo quitaran: no sale en la web
  es_prueba      boolean not null default false, -- datos de ejemplo; se borran con admin/prueba.mjs borrar
  ascendido_en   int,                        -- episodio en que subió de turista a Clase Anillo
  creado_en      timestamptz not null default now()
);

create table if not exists public.saturnoid_estado (
  id                     int primary key default 1 check (id = 1),
  episodio_actual        int not null default 0,
  dia_actual             int,                -- «DÍA N» del viaje; vacío = el número del episodio
  reel_url               text,               -- último reel; si está vacío, la web enlaza al perfil
  metas                  int[] not null default '{50,200,1000}', -- motor 1, motor 2, despegue (nave llena)
  cupo_anillo            int not null default 100,
  cupo_orbita            int not null default 300,
  cupo_luna              int not null default 200,
  cupo_turista           int not null default 400,  -- 100 + 300 + 200 + 400 = 1000 pasajeros
  ascensos_por_episodio  int not null default 3,
  investigadora          text not null default 'Mery Orión',
  actualizado_en         timestamptz not null default now()
);
insert into public.saturnoid_estado (id) values (1) on conflict (id) do nothing;

alter table public.saturnoid_pasajeros enable row level security;
alter table public.saturnoid_estado enable row level security;

drop policy if exists "saturnoid: lectura publica" on public.saturnoid_pasajeros;
create policy "saturnoid: lectura publica" on public.saturnoid_pasajeros
  for select to anon, authenticated using (not oculto);

drop policy if exists "saturnoid: lectura publica" on public.saturnoid_estado;
create policy "saturnoid: lectura publica" on public.saturnoid_estado
  for select to anon, authenticated using (true);

revoke all on public.saturnoid_pasajeros, public.saturnoid_estado from anon, authenticated;
grant select on public.saturnoid_pasajeros, public.saturnoid_estado to anon, authenticated;

-- Resumen en vivo para la portada. Se calcula siempre desde las filas: los contadores no se pueden desfasar.
-- Cuenta también a los ocultos (siguen a bordo y ocupan su asiento), pero nunca devuelve sus usuarios.
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
