-- Equipaje (26-nov-2026): lo que cada pasajero comentó y el objeto que lleva en las manos en el 3D.
-- Se corre una sola vez (ya está corrido en czycgwhcdexmfvvywzsv). La lectura pública ya cubre las columnas nuevas.
-- objeto: una clave de OBJETOS (js/asientos.js) o dos con + (p. ej. «balon+fuego»: el balón en llamas).
alter table public.saturnoid_pasajeros
  add column if not exists lleva  text check (char_length(lleva) <= 140),   -- el comentario, tal cual
  add column if not exists objeto text;
alter table public.saturnoid_pasajeros drop constraint if exists saturnoid_pasajeros_objeto_check;
alter table public.saturnoid_pasajeros add constraint saturnoid_pasajeros_objeto_check
  check (objeto ~ '^[a-z]{1,20}(\+[a-z]{1,20})?$');
