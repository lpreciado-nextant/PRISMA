# PRISMA × Nextant — Plantilla de presentación por solución (v3)

**v3 (2026-10-22):** el diseño es la presentación que Juliana rehízo en PowerPoint sobre una descarga de PRISMA APP (Aptos, fondo con aurora, listas con puntos en vez de tarjetas). La versión Light se deriva de la Dark con la paleta, el fondo y los logos de la Light anterior. Cada diapositiva sigue usando solo campos que la app ya tiene.

## Flujo

1. El CSM abre una solución y pulsa **Download presentation**.
2. La app arma un JSON con los campos de la tabla de abajo y las rutas de sus imágenes.
3. Un servicio rellena la plantilla `.potx` del tema elegido (Dark o Light) y entrega un `.pptx`. El script `fill_prisma_template.py` del Developer Kit hace este paso y sirve de referencia.
4. El `.pptx` se abre con F5 (pantalla completa, sin menús), el equivalente en PowerPoint del Present mode. Guardado como `.ppsx` abre directo en ese modo.

## Las 6 diapositivas y de dónde sale cada dato

| # | Slide | Datos de la página de la solución |
|---|-------|-----------------------------------|
| 1 | Portada | Área, madurez, nombre, descripción corta, primera captura |
| 2 | What it does | "What the solution does", "Business value", una captura |
| 3 | See it in action | Hasta 6 capturas |
| 4 | What it's built on | Áreas de especialización, capability, industrias, contexto de cliente anonimizado y tecnologías |
| 5 | Walkthroughs and live demos | Demo videos (hasta 3), Interactive demos (hasta 2) y Supporting material (hasta 3), en filas por tipo |
| 6 | Next step | Tres pasos fijos, enlace a la biblioteca de PRISMA y el contacto (CSM) |

## Campos de texto

| Token | Slide | Límite | Obligatorio | Origen en la página |
|-------|-------|--------|-------------|---------------------|
| `{{area_name}}` | 1 | lista | Sí | Área principal (AI & Automation, Data Solutions, Intelligent Business Operations): la insignia de la portada |
| `{{area_names}}` | 4 | 90 | Sí | Todas las áreas, la principal primero, separadas por " · " |
| `{{capability}}` | 4 | 40 | Sí | Capability |
| `{{client_context}}` | 4 | 60 | No | Contexto de cliente **anonimizado** (`nx_clientcontextredacted`); nunca el nombre del cliente. Vacío: desaparece con su etiqueta |
| `{{maturity_label}}` | 1 | lista | Sí | Insignia de madurez (Live, Working prototype, Idea / Concept) |
| `{{solution_title}}` | 1 | 60 | Sí | Título (dos líneas como máximo; un nombre largo achica la letra) |
| `{{tagline}}` | 1 | 170 | Sí | Descripción corta (completa: en la tarjeta de la app se ve cortada) |
| `{{presenter_name}}` | 1 | 30 | Sí | Usuario que descarga (Entra ID) |
| `{{presentation_date}}` | 1 | 20 | No | Fecha de descarga |
| `{{description}}` | 2 | 520 | Sí | What the solution does |
| `{{business_value}}` | 2 | 200 | Sí | Business value |
| `{{industries}}` | 4 | 60 | No | Industries, separadas por " · ". Vacío: desaparece con su etiqueta |
| `{{tech_1}}` … `{{tech_8}}` | 4 | 30 c/u | Sí (mín. 1) | Tecnologías. Las que no se usan desaparecen con su punto |
| `{{video_1_title}}` … `_3_title`, `{{video_N_url}}` | 5 | 40 | No | Demo videos |
| `{{interactive_1_title}}`, `_2_title`, `{{interactive_N_url}}` | 5 | 40 | No | Interactive demos |
| `{{supporting_1_title}}` … `_3_title`, `{{supporting_N_url}}` | 5 | 40 | No | Supporting material |
| `{{cta_headline}}` | 6 | 60 | Sí | Título de la diapositiva: "Let's build this together" |
| `library_href` | 6 | — | Sí | Enlace detrás de "Explore the Library" (la biblioteca de PRISMA; si falta, la solución) |
| `prisma_href` | notas | — | Sí | URL completa de la solución en PRISMA, en las notas. Nunca se recorta |
| `{{tech_list}}` | notas 4 | — | No | Tecnologías separadas por comas |
| `{{csm_name}}` `{{csm_email}}` `{{csm_initials}}` | 6 | 28 / 35 / 2 | Sí | Contacto: el CSM, el colaborador cuyo nivel en el directorio de consultores (`cr6b0_consultantlevel`) dice Customer Success (en Forge: Andres Perez); si no hay, quien descarga. Las iniciales van en el círculo |

**Acomodo automático (solo en la app):** en la portada, cada insignia mide lo que su texto, el título usa dos líneas como máximo (un nombre largo achica la letra) y la descripción corta y la línea de acento van justo debajo. En la diapositiva 2, el valor de negocio va debajo de la descripción y cada barra mide lo que su bloque; si no caben, los dos textos se achican juntos. Las capturas se reparten según cuántas haya (1 grande, 2 lado a lado, 3 con una principal, 4 en 2×2, 5–6 en 3×2). Las tecnologías fluyen de izquierda a derecha y saltan de fila; sin industria ni contexto de cliente suben al lugar de "Business context". Si la solución no tiene CSM, el contacto es quien descarga.

**Notas del orador:** cada diapositiva trae notas con los datos de la solución (qué decir, valor, tecnologías) y, en la 5, la lista de enlaces completos de los demos para pegar en el navegador. Las líneas de demos que no existen se eliminan.

Las filas de demos sin título se eliminan solas, igual que el encabezado de un tipo sin filas. Si caben, todas las filas van en una columna con el espaciado del diseño; si no, cada tipo ocupa su columna (títulos a 15 pt, en dos líneas). Sin ningún demo, la nota invita a pedir una demostración en vivo. El botón de cada fila dice lo que hace (`{kind}_N_action` desde la app): **PLAY ↗** para videos, **OPEN ↗** para HTML y enlaces, **DOWNLOAD ↓** para archivos (PDF, PowerPoint, Word…); el título también enlaza. Un archivo no se descarga directo desde la presentación: el enlace abre PRISMA (con sesión de Nextant) y la descarga empieza sola al llegar; los archivos protegidos nunca quedan expuestos en el `.pptx`.

## Imágenes

Cada imagen llena su marco con esquinas redondeadas (recorte centrado). Las capturas sobrantes (`shot_N`) desaparecen.

| Clave | Slide | Proporción | Tamaño recomendado |
|-------|-------|------------|--------------------|
| `cover_image` | 1 | 1.6:1 | 1600 × 1000 px |
| `feature_image` | 2 | 1.4:1 | 1500 × 1050 px |
| `shot_1` … `shot_6` | 3 | 1.9:1 | 1500 × 800 px |

## Lo que dejé fuera a propósito

- **Built by & effort** (nombres de consultores y horas) y **Total effort**: es información interna. No aparece en ninguna diapositiva. Propongo que no se exporte nunca.
- **Client review**: ya no se muestra; la descarga solo existe para soluciones *Cleared*.

## Cosas a resolver en la app

1. **Títulos de demos:** hoy la app muestra nombres de archivo (`prisma-hosted.webm`, `index.html`). Para la presentación hace falta un título legible por demo.
2. **Descripción corta:** la de la tarjeta se corta a mitad de frase. Hay que pasar el texto completo.
3. **Videos y demos protegidos:** viven en el almacenamiento protegido de PRISMA, así que el enlace pide inicio de sesión de Nextant; sirve para que el CSM presente en vivo. Si quieren una presentación que funcione sin conexión, se puede incrustar un video en el `.pptx` (el de 50 MB pesaría mucho).
4. **Material de apoyo:** la diapositiva 5 enlaza hasta 3 materiales de apoyo de la solución (el `.pptx` o PDF "client-ready", por ejemplo), que se abren en PRISMA como los demos. La plantilla genera la presentación a partir de los datos, sin que el builder la arme a mano.

## Estilo

- Colores y fondos son los de PRISMA, en versión Dark y Light. El logo de Nextant es blanco en Dark y azul Nextant en Light. El punto y el texto de la insignia de área toman el color de su área, y los de madurez el de su estado.
- Fuentes: **Aptos Display** (títulos), **Aptos** (texto) y Courier New (etiquetas), las del diseño. Aptos es la fuente por defecto de Microsoft 365; en versiones de Office sin ella, PowerPoint la descarga o la sustituye. El cálculo de cuánto texto cabe está medido sobre Aptos (las mayúsculas cuentan más anchas).
- Los títulos son marcadores reales de PowerPoint (vista de esquema y lectores de pantalla funcionan).

## Nombres de formas (el contrato con la app)

La app encuentra cada pieza por su nombre (Selection Pane de PowerPoint). Para cambiar el diseño, edita las dos `.potx` en PowerPoint y conserva estos nombres; no dejes enlaces en la plantilla (la app pone los suyos).

| Diapositiva | Formas |
|---|---|
| 1 | `area_dot` `badge_area_text` `maturity_dot` `badge_maturity_text` `Text 1` (título) `tagline` `cover_accent_rule` `presenter` `presentation_date` `img_cover_image` |
| 2 | `description_label` `description` `description_accent` `value_label` `business_value` `value_accent` `img_feature_image` |
| 3 | `img_shot_1` … `img_shot_6` |
| 4 | `overview_dot` `overview_value` `capability_dot` `capability_value` `context_eyebrow` `industry_label` `industry_dot` `industry_value` `client_label` `client_dot` `client_value` `right_section_rule` `tech_eyebrow` `tech_dot_N` `tech_N` (1–8) |
| 5 | `video_label` `interactive_label` `supporting_label`; por fila `row_{kind}_{N}_icon` `_play` `_title` `_btn_text` `_rule`; `demo_note` |
| 6 | `Text 1` (título) `library_link` `contact_initials` `csm_name` `csm_email` |

La plantilla trae las filas de demo en tres columnas y las tecnologías en una grilla; la app las reacomoda en cada descarga.

## Developer Kit

`kit/fill_prisma_template.py` (requiere `pip install python-pptx`; sin el acomodo automático: filas y tecnologías quedan donde las trae la plantilla) y `kit/forge_sample/` con el JSON de entrada y las imágenes de ejemplo. Las plantillas viven solo en `app/src/assets/deck/` (las usa la app); no hay copias aquí.

Desde `tools/pptx-template/kit`:

`python3 fill_prisma_template.py ../../../app/src/assets/deck/PRISMA_Template_Dark.potx forge_sample/forge_solution.json salida.pptx`
