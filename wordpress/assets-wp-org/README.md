# WordPress.org directory assets (not part of the plugin zip)

Drop the plugin's directory-listing images here using WordPress.org's exact
filenames. These are never bundled into `blog2video-customer.zip` and never
installed on a WordPress site — they only get uploaded to the plugin's SVN
`assets/` folder after WordPress.org approval:

```
svn co https://plugins.svn.wordpress.org/blog2video/ svn-checkout
cp wordpress/assets-wp-org/*.png svn-checkout/assets/
cd svn-checkout && svn add assets/*.png && svn commit -m "Add plugin directory assets"
```

## Filenames expected

- `icon-128x128.png` / `icon-256x256.png` — present, sourced from
  `frontend/public/b2v-logo.png`.
- `banner-772x250.png` (optionally `banner-1544x500.png` for retina) — not
  yet added.
- `screenshot-1.png` through `screenshot-6.png` — present. Captions are
  already written in `wordpress/blog2video/readme.txt` under
  `== Screenshots ==`, matched by number:
  1. Start a video from the current post: content source, format, duration, logo.
  2. Choose a template and video style, with a live gallery and colors.
  3. Pick a narration language and preview voices before generating.
  4. Project settings: template, voiceover, logo, colors, captions, music.
  5. Browse and switch between existing Blog2Video projects.
  6. A post with a video already embedded, linked project shown in the sidebar.

  The original screenshot-6 and screenshot-7 (embedded-video post view) were
  removed for showing a `localhost:5173` preview URL from local dev.
  screenshot-6 has now been retaken against production (blog2video.app) with a
  real embedded video. screenshot-7 is still pending.

The image files themselves are gitignored (see repo root `.gitignore`) — only
this README and the folder structure are tracked.
