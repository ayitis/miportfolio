# Probar el editor de portada en Vercel

La prueba usa un proyecto de Supabase propio. Los botones del editor afectan únicamente al sitio que lee ese proyecto. Deja las variables de Production vacías y mantén la prueba en la rama `preview/editor-supabase`.

## 1. Crear Supabase para la prueba

1. Entra en [Supabase](https://supabase.com/dashboard) y elige **New project**. Selecciona tu organización, ponle un nombre como `miportfolio-preview`, elige una región y guarda la contraseña de la base de datos en tu gestor de contraseñas.
2. En el proyecto, entra en **Authentication → Sign In / Providers → Email**. Deja habilitado el inicio de sesión por correo. En los ajustes de autenticación, desactiva **Allow new users to sign up**.
3. En **Authentication → Users**, pulsa **Add user → Create new user**. Introduce el correo y una contraseña propia para el editor. Marca **Auto Confirm User** si aparece y crea el usuario. Abre el usuario y copia su **User UID**. El UID identifica la cuenta. La contraseña de este usuario es la que usarás para entrar en `/editor`.
4. En **SQL Editor → New query**, pega todo el contenido de [la migración](../supabase/migrations/20261118000000_portfolio_editor.sql) y pulsa **Run** una sola vez. Si ya se ejecutó correctamente en este proyecto, sigue con el paso siguiente.
5. Abre **New query**, pega la consulta de abajo, sustituye `PEGA_AQUI_EL_USER_UID` por el UID del paso 3, conserva las comillas simples y pulsa **Run**. Esta consulta habilita una sola cuenta.

```sql
insert into public.portfolio_owner (user_id)
values ('PEGA_AQUI_EL_USER_UID');
```

6. Pulsa **Connect** en Supabase y copia **Project URL** y la **Publishable key**. También puedes encontrar la clave en **Project Settings → API Keys**. La clave que usa el editor empieza por `sb_publishable_`. Guarda la contraseña de la base de datos y las claves secretas fuera de Vercel y GitHub.

## 2. Preparar el Preview en Vercel

1. En [Vercel](https://vercel.com/dashboard), abre el proyecto del portfolio y entra en **Settings → Environment Variables → Add**.
2. Añade `SUPABASE_URL` con la URL del proyecto Supabase de prueba. Añade `SUPABASE_PUBLISHABLE_KEY` con la clave publicable. En las dos variables, selecciona solo **Preview**. Si Vercel te ofrece limitar la variable a una rama, elige `preview/editor-supabase`. Pulsa **Save**.
3. En **Settings → Environments**, comprueba qué rama usa **Production**. Si el proyecto ya está vinculado a GitHub, enviar la rama de prueba a GitHub genera un Preview cuando están habilitados los despliegues automáticos. Si ya existe ese despliegue, entra en **Deployments**, abre el despliegue de la rama de prueba, verifica que indique **Preview** y elige **⋯ → Redeploy** para que lea las variables nuevas. Deja desactivada cualquier opción para promoverlo a Production.
4. En **Deployments**, abre la URL que indica **Preview** y añade `/editor` al final. Introduce el correo y la contraseña que configuraste en **Authentication → Users**.

## 3. Comprobar el flujo

- Cambia un texto y pulsa **Guardar borrador**. Recarga el editor y confirma que el cambio sigue ahí. Abre la portada del **Preview** en otra pestaña y comprueba que conserva la versión publicada.
- Pulsa **Publicar cambios** en el editor y recarga la portada del **Preview**. Comprueba los ajustes en una ventana ancha y otra de 700 píxeles o menos.
- En **Historial de versiones**, selecciona una versión y pulsa **Restaurar como borrador**. Pulsa **Guardar borrador** para conservar la restauración en privado. Pulsa **Publicar cambios** cuando quieras que se vea en la portada de prueba.
- Con **Descargar copia** puedes guardar un archivo JSON. **Importar copia** admite también las copias del editor de prueba original. La importación carga los datos en el editor para revisarlos antes de guardar o publicar.

## Mantener las ediciones en futuros cambios de código

Los identificadores permanentes de la portada están en `portfolio/home-design.js`. Mantén las claves, como `hero.title` y `card.nuptias.title`, si cambias el HTML. Actualiza el selector asociado si se mueve o cambia el elemento. El editor y la portada usan el mismo registro. Los campos sin ajustes usan el HTML y CSS originales. Un cambio de estructura en el documento guardado necesita una migración de datos y compatibilidad con las copias anteriores.

## Ampliar un Preview existente a NUPTIAS

1. Abre en Supabase el proyecto que usa tu **Preview** actual. En **SQL Editor → New query**, pega todo el contenido de [la migración de NUPTIAS](../supabase/migrations/20261119000000_portfolio_nuptias.sql) y pulsa **Run** una vez. Esta migración se aplica después de la migración inicial y conserva los borradores, publicaciones, historial y cuenta administradora de la portada.
2. En Vercel conserva las dos variables de **Preview** que ya tienes. La rama actualizada usa el mismo proyecto, usuario y enlace de Preview.
3. Abre `/editor` en Preview y elige **NUPTIAS** en **Página**. Guarda un borrador y comprueba que la página pública del Preview sigue mostrando su versión anterior. Pulsa **Publicar cambios** y abre `/nuptias.html` en el Preview para comprobar la publicación.
4. Si quieres ajustar el título **FORM & FEELING.**, selecciona el título completo para moverlo o elige sus partes por separado para editar su contenido. Las copias de seguridad y el historial corresponden a la página seleccionada.

## Gestionar las fotos de NUPTIAS en Preview

1. En el Supabase de **Preview**, abre **SQL Editor → New query**. Después de las dos migraciones anteriores, copia [la migración de Storage](../supabase/migrations/20261119010000_nuptias_photo_storage.sql), pégala y pulsa **Run** una vez. Crea el bucket privado `portfolio-nuptias` y sus permisos. Conserva el borrador, la publicación y el historial existentes. En Vercel se siguen usando las mismas variables de Preview.
2. Abre **/editor → NUPTIAS → Fotografías de NUPTIAS**. Haz clic en una foto de la galería o elígela en la lista. Puedes pausar el carrusel, arrastrar la foto sobre otra o usar **Adelantar** y **Atrasar**.
3. Usa **Ocultar** o **Quitar de la galería** para retirarla de la vista. Sigue disponible en la lista, donde puedes elegir **Restaurar fotografía**. El ancho, el alto y el recorte se ajustan por separado en **Escritorio** y **Móvil**.
4. Usa **Subir fotografía** para elegir un JPG, PNG, WebP o AVIF de hasta 10 MB. La foto se sube de forma privada. Pulsa **Guardar borrador** para conservar las ediciones de textos y fotos, o **Publicar cambios** para mostrarlas en la página de Preview.

Los originales del repositorio se identifican por su nombre de archivo. Mantén sus nombres al editar el HTML para conservar sus ajustes. La copia JSON y el historial contienen el orden, los ajustes y las referencias a las subidas. Las imágenes subidas siguen en el Storage del proyecto, incluido cuando se ocultan o se retiran, para que las versiones anteriores puedan restaurarlas. Mantén una copia de los archivos si vas a usar otro proyecto de Supabase.

## Guías y movimiento preciso

- Arrastra un texto en la vista previa. Las líneas rosas señalan bordes y centros coincidentes con otros textos, las fotos o el centro de la página. En **Guías de alineación** puedes desmarcar **Ajuste magnético** para moverlo libremente y activar o desactivar **Mostrar distancias**.
- Selecciona un texto haciendo clic en la vista previa. Las flechas lo mueven 1 px y **Mayús + flecha** lo mueve 10 px. Estos pasos son exactos aunque esté activo el ajuste magnético.
- Activa **Reglas y guías manuales** y pulsa la regla de arriba para poner una guía vertical, o la de la izquierda para poner una horizontal. Las guías manuales son independientes por página y vista durante la sesión del editor. **Borrar guías de esta vista** retira las de la vista actual.
- Pulsa **Guardar borrador** o **Publicar cambios** para conservar la posición. Las líneas, las reglas y las medidas son herramientas del editor.

## Textos nuevos, acciones y diseño de la cinta

- **Añadir texto** crea un cuadro en la página actual. Escribe en **Contenido** y ajusta su posición, espaciado y capa en la vista seleccionada.
- Selecciona un texto en el lienzo para usar **Cmd/Ctrl + C**, **V** o **X**. También puedes usar **Copiar**, **Pegar** y **Duplicar** en el panel. **Suprimir** o **Retroceso** retira la selección. Dentro de un campo, el navegador mantiene sus atajos normales.
- **Deshacer** y **Rehacer** recorren los cambios de la página abierta durante la sesión. Guarda o publica para hacer persistente el resultado. El historial de versiones sigue disponible por separado.
- En NUPTIAS, elige **Galería · Cinta completa** o arrastra el control **Mover cinta** del lienzo. Reduce el ancho antes de desplazarla en horizontal. El alto cambia el marco de la cinta. **Restablecer cinta** devuelve su geometría original en la vista actual. Haz clic sobre las fotos para seguir editándolas individualmente.

Si duplicas una foto subida a Storage, aplica una vez en el Supabase de Preview la [migración de permisos para copias](../supabase/migrations/20261119020000_nuptias_photo_copies.sql). En **SQL Editor → New query**, pega el archivo completo y pulsa **Run** después de la migración de Storage. Así, cada copia conserva sus propios ajustes y comparte el archivo de origen. Los visitantes pueden abrir ese archivo solo mientras al menos una de sus instancias esté publicada y visible.
