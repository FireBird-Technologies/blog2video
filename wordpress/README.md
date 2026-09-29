# Blog2Video WordPress plugin

The installable plugin lives in `wordpress/blog2video`. During development, symlink or copy that directory into a WordPress installation's `wp-content/plugins/blog2video` directory, then activate it in **Plugins**.

To build an uploadable artifact from the repository root:

```sh
cd wordpress && zip -r blog2video.zip blog2video -x '*.DS_Store'
```

The plugin runs on the WordPress host as PHP and JavaScript. Video generation remains in the existing FastAPI/worker/Remotion deployment; WordPress calls the site-scoped integration API over HTTPS. Define `B2V_API_URL` in `wp-config.php` when targeting a different backend:

```php
define( 'B2V_API_URL', 'https://api.example.com' );
```

## React UI development

The post editor and settings interfaces are authored in React + TypeScript under
`wordpress/blog2video/ui`. WordPress supplies React through `wp-element`; the
build emits standalone JavaScript and compiled Tailwind CSS into the plugin's
`assets` directory.

```sh
cd wordpress/blog2video/ui
npm run build
```

The build uses the repository frontend's pinned esbuild and Tailwind binaries so
the plugin UI and website share the same toolchain and purple design tokens.
