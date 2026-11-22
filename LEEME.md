# Saturnoid · noidcorp.com/saturnoid

La web de la serie participativa de @noidd.corp: la nave a Saturnoid, el buscador de asientos con vista desde
el asiento (3D) y el pase de abordar para historias. Repo `NOID-CORP/saturnoid` (público, GitHub Pages).

- **La web solo lee** de Supabase (proyecto `czycgwhcdexmfvvywzsv`, tablas `saturnoid_pasajeros` y `saturnoid_estado`)
  con la clave pública. Las reglas RLS no dejan escribir desde la web y nunca muestran a quien está `oculto`.
- **Se escribe solo con los scripts de `admin/`**, que usan el token de `~/.config/noid/supabase-token`
  (solo en el Mac de DON; nunca se muestra ni se sube).
- **Las listas de comentarios no van a GitHub**: guárdalas en `datos/` (está en `.gitignore`).
- Los contadores de la portada se calculan en vivo desde las filas (función `saturnoid_resumen`): no se pueden desfasar.

## Después de cada episodio (en este orden)

Todo se corre desde esta carpeta (`~/Documents/03 NOID/saturnoid`). Cada script muestra un resumen y pregunta
`(s/n)` antes de escribir: si algo se ve raro, responde `n` y no pasa nada.

**1. Pasar los comentarios del reel a un CSV**, del **más viejo al más nuevo** (el primero que comentó, arriba),
en `datos/ep2.csv`:

```
usuario,ciudad,hora
juanita.perez,Bucaramanga,2026-11-24 10:01
@Pedro_88,"Girón, Santander",2026-11-24 10:03
```

- El usuario puede ir con o sin `@`, en mayúsculas o como enlace de perfil: el script lo limpia.
- La ciudad es la que la persona escribió (puede ir vacía). La hora puede ser solo `10:03` si pasas `--fecha`.
- Si alguien comentó dos veces, cuenta el primer comentario. Quien ya tenía asiento se salta solo.

**2. Asignar asientos** (por orden de llegada: Anillo hasta llenar su cupo, luego Órbita, luego Turista; si la nave se llena, el script avisa quiénes no caben y no los sube):

```
node admin/asignar.mjs datos/ep2.csv --episodio 2
node admin/asignar.mjs datos/ep2.csv --episodio 2 --fecha 2026-11-24   # si las horas no traen fecha
```

**3. Los 3 de Turista que suben a Clase Anillo** (van a suites aparte, no le quitan cupo a nadie):

```
node admin/ascender.mjs --sorteo --episodio 2                 # 3 al azar entre los de Turista
node admin/ascender.mjs usuario1 usuario2 usuario3 --episodio 2  # o los que escojan
```

**4. Actualizar el episodio y el enlace del reel nuevo** (los botones de la web llevan ahí):

```
node admin/estado.mjs episodio=2 reel=https://www.instagram.com/reel/XXXXXXXX/
```

**5. Revisar** en noidcorp.com/saturnoid que el contador y un par de usuarios salgan bien.

## Otros comandos

| Para | Comando |
|---|---|
| Ver el estado y los contadores reales | `node admin/estado.mjs` |
| Alguien pide salir (mensaje directo) | `node admin/ocultar.mjs usuario` (deshacer: `--mostrar`) |
| Cambiar metas o cupos | `node admin/estado.mjs metas=50,200,1000 anillo=100 orbita=300 turista=600` |
| Cambiar el nombre de la investigadora | `node admin/estado.mjs investigadora="Mery Orión"` |
| Cambiar la tripulación de la cabina (9, con su permiso) | `node admin/tripulacion.mjs u1 u2 … u9` |
| Datos de ejemplo para probar | `node admin/prueba.mjs crear 300` / `node admin/prueba.mjs borrar` |

**Antes de publicar el episodio 1: `node admin/prueba.mjs borrar`.** Mientras haya datos de prueba, la web lo dice
arriba ("Datos de prueba · N de ejemplo").

Las tablas se crearon con `admin/sql/esquema.sql` (sin datos). Columnas extra a las del encargo: `numero`
(pasajero nº, orden de llegada), `es_prueba` y `ascendido_en` (episodio en que subió de Turista a Anillo).

## Asientos

| Clase | Código | Cómo se reparte |
|---|---|---|
| Cabina de mando | `C-01` (Mery Orión, personaje) y `C-02`…`C-10` (tripulación) | Fija |
| Clase Anillo | `A-01`… (los ascensos toman la siguiente suite y no cuentan en el cupo) | Los primeros 100 |
| Clase Órbita | `O-01A`…`O-75D` (filas de 4) | Los siguientes 300 |
| Turista | `T-001A`…`T-100F` (filas de 6) | Los siguientes 600 |

En total, 1.000 pasajeros (más la tripulación). Motor 1 enciende con 50, motor 2 con 200 y el despegue es con 1.000: la nave llena.

La lógica está en `js/asientos.js` (la usan la web y los scripts).

## Después de tocar el código (js/, escena/ o estilos.css)

La web publicada no carga esos archivos directamente: carga `dist/` y los estilos que van dentro de `index.html`.
Después de cambiar cualquiera de ellos, antes de subir a GitHub:

```
npm install                   # una vez (esbuild y Three.js 0.181.2, solo para armar)
npm run construir             # arma dist/ y actualiza el bloque marcado de index.html
```

Sube también `dist/` e `index.html`. Los textos de `index.html` fuera del bloque `construir:inicio … construir:fin`
se editan a mano como siempre. Lo que hace (`herramientas/construir.mjs`), sin cambiar nada de lo que se ve:

- Junta `js/app.js`, `escena/` y Three.js en pocos archivos minificados, sin el código de Three.js que no se usa
  (de ~40 pedidos a 15 y de 735 KB a 551 KB de Three.js); la escena 3D se descarga en paralelo desde el `<head>`.
- Mete `estilos.css` minificado dentro de `index.html` (un pedido menos antes de la primera pintura).
- Pide el contador a Supabase desde el `<head>`, sin esperar al JavaScript. Las lecturas van por GET con la clave
  pública en la URL: así el navegador no hace la consulta previa de CORS (un viaje de ida y vuelta menos en cada una).

Además, las sombras de la escena solo se recalculan cuando la nave se mueve (con la nave quieta son las mismas).

## Probar en local

```
npm run local                 # http://127.0.0.1:8080 (después de npm run construir)
cd pruebas && npm install     # una vez (playwright-core, usa el Chrome instalado)
node pruebas/probar.mjs       # celular 390×844: portada, las 4 clases, pase, usuario sin asiento → pruebas/capturas/
node pruebas/probar.mjs --escritorio prueba_0007
node pruebas/probar.mjs --sin3d prueba_0120     # plan B sin WebGL
node pruebas/carga.mjs        # tiempos con 4G simulado
node pruebas/respuesta.mjs    # del toque en "Buscar" al vuelo, con procesador de celular simulado
node pruebas/fotos.mjs        # regenera las imágenes de portada (assets/img/) desde la escena
```

Parámetros de la URL: `?u=usuario` abre directo en su asiento; `?calidad=baja|media|alta` fuerza la calidad del 3D;
`?foto&nivel=0` deja solo la escena (para capturas).

## La escena 3D (también para los videos con HyperFrames)

`escena/` son módulos de Three.js deterministas: nada de azar sin semilla y el tiempo entra como parámetro, así un
video puede pedir el cuadro exacto `t`. Three.js 0.181.2 va dentro de `lib/three` (la misma versión de los videos).

| Módulo | Qué hace |
|---|---|
| `mundo.js` | Arma todo: `crearMundo({ canvas, calidad })` → `mundo.cuadro(t, { nivel, cam, adentro })`, `prepararAsiento(clase, …)`, `capturar(cam)` |
| `cielo.js` | Estrellas y el planeta Saturnoid (océanos, bosques, nubes, atmósfera, anillo en colores NOID) |
| `nave.js` | La nave por secciones (Turista, Órbita, Anillo con cúpulas, Cabina), motores por nivel, vapor |
| `plataforma.js` | Suelo, plataforma, torre, reflectores y montañas |
| `interiores.js` | El interior de cada clase alrededor de un asiento, con los vecinos reales |
| `nametags.js` | Nametags estilo Minecraft y los pasajeros (casco con visor, sin caras) |
| `camara.js` | Cámaras: portada, vuelo hasta el asiento y vista desde el asiento |

`nivel` va de 0 a 3 y puede ser decimal (0 en espera, 1 motor 1, 2 motor 2, 3 despegue): así un video anima el encendido.
