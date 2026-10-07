# PRISMA × Nextant — Plantilla de presentación por solución (v2)

Esta versión está hecha sobre la página real de una solución en PRISMA (POC Forge): cada diapositiva usa solo campos que la app ya tiene. Quité del diseño anterior lo que la app no guarda (problema, puntos de dolor, métricas de impacto).

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
| 4 | What it's built on | "At a glance" (área, madurez, industrias, client review, fecha) y "Built on" (tecnologías) |
| 5 | Walkthroughs and live demos | Demo videos (hasta 3), Interactive demos (hasta 2) y Supporting material (hasta 3), en tres columnas |
| 6 | Next step | CSM de la solución y enlace a PRISMA |

## Campos de texto

| Token | Slide | Límite | Obligatorio | Origen en la página |
|-------|-------|--------|-------------|---------------------|
| `{{area_name}}` | 1, 4 | lista | Sí | Área (AI & Automation, Data Solutions, Intelligent Business Operations) |
| `{{maturity_label}}` | 1, 4 | lista | Sí | Insignia de madurez (Live, Working prototype, Idea / Concept) |
| `{{solution_title}}` | 1 | 30 | Sí | Título |
| `{{tagline}}` | 1 | 170 | Sí | Descripción corta (completa: en la tarjeta de la app se ve cortada) |
| `{{presenter_name}}` `{{presenter_role}}` | 1 | 30 / 40 | Sí / No | Usuario que descarga (Entra ID) |
| `{{presentation_date}}` | 1 | 20 | No | Fecha de descarga |
| `{{description}}` | 2 | 520 | Sí | What the solution does |
| `{{business_value}}` | 2 | 200 | Sí | Business value |
| `{{industries}}` | 4 | 28 | No | Industries |
| `{{client_review}}` | 4 | 20 | No | Client review |
| `{{added_date}}` | 4 | 12 | No | Added |
| `{{tech_1}}` … `{{tech_8}}` | 4 | 20 c/u | Sí (mín. 1) | Built on. Los chips sin uso desaparecen |
| `{{video_1_title}}` … `_3_title`, `{{video_N_url}}` | 5 | 40 | No | Demo videos |
| `{{interactive_1_title}}`, `_2_title`, `{{interactive_N_url}}` | 5 | 40 | No | Interactive demos |
| `{{supporting_1_title}}` … `_3_title`, `{{supporting_N_url}}` | 5 | 40 | No | Supporting material |
| `{{cta_headline}}` | 6 | 60 | Sí | Texto estándar de Nextant, editable |
| `{{prisma_url}}` | 6 | 40 | Sí | Texto del enlace a PRISMA: el nombre de la solución |
| `prisma_href` | 6, notas | — | Sí | URL completa de la solución en PRISMA, detrás del enlace y en las notas. Nunca se recorta |
| `{{tech_list}}` | notas 4 | — | No | Tecnologías separadas por comas |
| `{{csm_name}}` `{{csm_email}}` | 6 | 28 / 35 | Sí | CSM (en Forge: Andres Perez) |

**Notas del orador:** cada diapositiva trae notas con los datos de la solución (qué decir, valor, tecnologías) y, en la 5, la lista de enlaces completos de los demos para pegar en el navegador. Las líneas de demos que no existen se eliminan.

Las filas de demos sin título se eliminan solas, y la tarjeta se ajusta a las filas que quedan. Una tarjeta sin filas desaparece y las que quedan se reparten todo el ancho (una, dos o tres columnas). Los botones dicen **Play** (videos) y **Open** (interactivos y material de apoyo).

## Imágenes

Cada imagen llena su marco con esquinas redondeadas (recorte centrado). Las capturas sobrantes (`shot_N`) desaparecen.

| Clave | Slide | Proporción | Tamaño recomendado |
|-------|-------|------------|--------------------|
| `cover_image` | 1 | 1.6:1 | 1600 × 1000 px |
| `feature_image` | 2 | 1.2:1 | 1500 × 1250 px |
| `shot_1` … `shot_6` | 3 | 1.9:1 | 1500 × 800 px |

## Lo que dejé fuera a propósito

- **Built by & effort** (nombres de consultores y horas) y **Total effort**: es información interna. No aparece en ninguna diapositiva. Propongo que no se exporte nunca.
- **Client review**: sí se muestra (estado "Cleared"). Sugiero que el botón de descarga solo esté activo cuando una solución esté *Cleared*.

## Cosas a resolver en la app

1. **Títulos de demos:** hoy la app muestra nombres de archivo (`prisma-hosted.webm`, `index.html`). Para la presentación hace falta un título legible por demo.
2. **Descripción corta:** la de la tarjeta se corta a mitad de frase. Hay que pasar el texto completo.
3. **Videos y demos protegidos:** viven en el almacenamiento protegido de PRISMA, así que el enlace pide inicio de sesión de Nextant; sirve para que el CSM presente en vivo. Si quieren una presentación que funcione sin conexión, se puede incrustar un video en el `.pptx` (el de 50 MB pesaría mucho).
4. **Material de apoyo:** la diapositiva 5 enlaza hasta 3 materiales de apoyo de la solución (el `.pptx` o PDF "client-ready", por ejemplo), que se abren en PRISMA como los demos. La plantilla genera la presentación a partir de los datos, sin que el builder la arme a mano.

## Estilo

- Colores y fondos son los de PRISMA, en versión Dark y Light. El logo de Nextant es blanco en Dark y azul Nextant en Light. La insignia de área toma el color de su área y la de madurez el de su estado.
- Fuentes: Arial y Calibri, que vienen con Office. Las fuentes de PRISMA no están en los equipos de los clientes. Si Nextant las distribuye, se cambian en un solo lugar (Diseño → Fuentes).
- Los títulos son marcadores reales de PowerPoint (vista de esquema y lectores de pantalla funcionan).

## Developer Kit

`kit/fill_prisma_template.py` (requiere `pip install python-pptx`) y `kit/forge_sample/` con el JSON de entrada y las imágenes de ejemplo. Las plantillas viven solo en `app/src/assets/deck/` (las usa la app); no hay copias aquí.

Desde `tools/pptx-template/kit`:

`python3 fill_prisma_template.py ../../../app/src/assets/deck/PRISMA_Template_Dark.potx forge_sample/forge_solution.json salida.pptx`
