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
