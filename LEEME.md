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
- Va **quien escribió el comentario**, no los @ que etiquetó: la persona etiquetada sube solo si comenta ella misma
  (así lo dice el video: «quien etiquetes sube si también comenta»).

**2. Asignar asientos** (por orden de llegada: Anillo hasta llenar su cupo, luego Órbita, luego Luna, luego Turista; si la nave se llena, el script avisa quiénes no caben y no los sube):

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
| Cambiar metas o cupos | `node admin/estado.mjs metas=50,200,1000 anillo=100 orbita=300 luna=200 turista=400` |
| Poner el «DÍA» si no es el número del episodio | `node admin/estado.mjs dia=3` (`dia=-` vuelve a usar el episodio) |
| Cambiar el nombre de la investigadora | `node admin/estado.mjs investigadora="Mery Orión"` |
| Cambiar la tripulación de la cabina (9, con su permiso) | `node admin/tripulacion.mjs u1 u2 … u9` |
| Datos de ejemplo para probar | `node admin/prueba.mjs crear 700` (llega hasta Turista) / `node admin/prueba.mjs borrar` |

**Antes de publicar el episodio 1: `node admin/prueba.mjs borrar`.** Mientras haya datos de prueba, la web lo dice
arriba ("Datos de prueba · N de ejemplo").

Las tablas se crearon con `admin/sql/esquema.sql` (sin datos). **Clase Luna (23-nov):** una base creada antes se pone
al día una sola vez con `admin/sql/clase-luna.sql` (Supabase → SQL Editor → pegar → Run): agrega `luna` a las clases,
`cupo_luna` (200), `dia_actual`, deja Turista en 400 y el contador de Luna en `saturnoid_resumen`. Mientras no se corra,
la web ya muestra las 4 clases (parte Turista en 200 + 400), pero `asignar.mjs` y `prueba.mjs` no escriben nada. Columnas extra a las del encargo: `numero`
(pasajero nº, orden de llegada), `es_prueba` y `ascendido_en` (episodio en que subió de Turista a Anillo).

## Asientos

| Clase | Código | Cómo se reparte |
|---|---|---|
| Cabina de mando | `C-01` (Mery Orión, personaje) y `C-02`…`C-10` (tripulación) | Fija |
| Clase Anillo | `A-01`… (los ascensos toman la siguiente suite y no cuentan en el cupo) | Los primeros 100 (comentarios nº 1–100) |
| Clase Órbita | `O-01A`…`O-75D` (filas de 4) | Los siguientes 300 (comentarios nº 101–400) |
| Clase Luna | `L-01A`…`L-40E` (filas de 5: 2 junto a la ventana, pasillo y 3) | Los siguientes 200 (nº 401–600) |
| Turista | `T-001A`…`T-067D` (filas de 6) | Los últimos 400 (nº 601–1.000) |

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
node pruebas/probar.mjs       # celular 390×844: portada, clases, pase de Anillo/Órbita/Luna/Turista, usuario sin asiento → pruebas/capturas/
node pruebas/probar.mjs --escritorio prueba_0007
node pruebas/probar.mjs --sin3d prueba_0120     # plan B sin WebGL
node pruebas/carga.mjs        # tiempos con 4G simulado
node pruebas/respuesta.mjs    # del toque en "Buscar" al vuelo, con procesador de celular simulado
node pruebas/mirada.mjs       # mirar desde el asiento: dedo, segundo dedo, inercia, topes, doble toque, giroscopio y fluidez
node pruebas/pisos.mjs        # un asiento por clase mirando al frente, a los lados y atrás → pruebas/capturas/pisos/
node pruebas/afuera.mjs [u]   # la nave por fuera y el vuelo hasta el asiento, en cuadros
node pruebas/tarjeta.mjs      # minimizar la tarjeta del asiento y "Verme sentado" en cada clase
node pruebas/fotos.mjs        # regenera las imágenes de portada (assets/img/) desde la escena
```

Parámetros de la URL: `?u=usuario` abre directo en su asiento; `?calidad=baja|media|alta` fuerza la calidad del 3D;
`?foto&nivel=0` deja solo la escena (para capturas).

## Mirar desde el asiento (`js/mirada.js`)

- **Dedo**: la escena se queda pegada al dedo (como Street View); al soltar sigue con la velocidad del dedo y se frena
  sola. Solo manda un dedo (un segundo dedo no hace saltar la vista). Doble toque: vuelve a mirar al frente.
- **Celular (giroscopio)**: en Android se enciende solo con la primera lectura del sensor; en iPhone hay que tocar
  «Mirar con el celular» (el sistema pide permiso, solo se puede dentro de un toque). Solo gira a los lados y arriba/abajo,
  nunca inclina el horizonte. El mismo botón lo apaga.
- **Teclado**: flechas (con Mayúscula, pasos largos).
- **Verme sentado** (botón sobre la tarjeta): la cámara sale de tu cabeza y gira alrededor de tu pasajero, que aparece
  sentado con el nametag «TÚ»; el mismo dedo y el mismo celular lo giran. La tarjeta se minimiza con la flecha de
  arriba a la derecha (queda una línea: clase · asiento y usuario) y el navegador recuerda cómo la dejó.
- Todo se suaviza por tiempo (igual de fluido a 30, 60 o 120 Hz). Con «reducir movimiento» del sistema no hay recorrido
  automático, ni inercia, ni el giroscopio se enciende solo.
- La conversión del sensor a yaw/pitch está en `escena/camara.js` (`miradaSensor`), junto a `recorridoPOV` y `limitesPOV`.

## La escena 3D (también para los videos con HyperFrames)

`escena/` son módulos de Three.js deterministas: nada de azar sin semilla y el tiempo entra como parámetro, así un
video puede pedir el cuadro exacto `t`. Three.js 0.181.2 va dentro de `lib/three` (la misma versión de los videos).

| Módulo | Qué hace |
|---|---|
| `mundo.js` | Arma todo: `crearMundo({ canvas, calidad })` → `mundo.cuadro(t, { nivel, cam, adentro })`, `prepararAsiento(clase, …)`, `capturar(cam)` |
| `cielo.js` | Estrellas y el planeta Saturnoid (océanos, bosques, nubes, atmósfera, anillo en colores NOID) |
| `nave.js` | La nave por secciones (Turista, Luna, Órbita, Anillo con cúpulas, Cabina), motores por nivel, vapor |
| `plataforma.js` | Suelo, plataforma, torre, reflectores y montañas |
| `interiores.js` | El piso completo de cada clase, con todos sus asientos (ocupados según la base) y los vecinos con nombre |
| `nametags.js` | Nametags estilo Minecraft y los pasajeros (casco con visor, sin caras) |
| `camara.js` | Cámaras: portada, vuelo hasta el asiento y vista desde el asiento |

### Por qué caben los 1.000

Por fuera la nave mide 10 unidades de ancho, pero adentro una unidad son 2,5 m (`ESCALA_INTERIOR` = 0,4 en `nave.js`):
la nave real tiene 25 m de ancho. Cada clase es un piso circular que da la vuelta completa alrededor del núcleo
(ascensor y escaleras), alineado con las ventanas que se ven por fuera:

| Clase | Cómo caben | Piso |
|---|---|---|
| Turista | 67 filas × 6 = 400, a 0,78 m entre filas; ocupan 292° de la vuelta y el resto es el baño (1 para 200) | 1, sin ventanas |
| Clase Luna | 40 filas × 5 = 200, la vuelta completa (1,6 m entre filas) | 1, la fila de ojos de buey |
| Clase Órbita | 75 filas × 4 = 300 en 2 pisos de 38 filas (1,7 m: el asiento se vuelve cama) | 2, las 2 filas de ventanas |
| Clase Anillo | una cúpula de 2,9 m por suite sobre el anillo: 114 (las 100 del cupo + los que suben de Turista) | el anillo |
| Cabina | la investigadora y 9 tripulantes en un puente de 24 m | 1, el ventanal |

Al buscar a alguien, la web trae qué asientos de su clase están ocupados (solo los códigos, sin nombres): el piso se
dibuja tal como está, con la gente donde hay gente. Solo los vecinos de al lado llevan nametag. Las multitudes van
instanciadas (una malla por pieza) y las lejanas con menos detalle; en calidad baja se dibujan 16 filas a cada lado.

`nivel` va de 0 a 3 y puede ser decimal (0 en espera, 1 motor 1, 2 motor 2, 3 despegue): así un video anima el encendido.
