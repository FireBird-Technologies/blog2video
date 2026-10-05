=== Blog2Video ===
Contributors: arslans1997, humera12
Tags: video, ai, blog, embed, gutenberg
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 0.14.14
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Turn WordPress posts and articles into narrated videos, edit every scene, render, download, and embed them.

== Description ==

Blog2Video connects WordPress to the hosted Blog2Video service. Editors can generate a video from the current saved post or a public article URL, select an existing project, edit scenes and project settings, render and download the video, and embed one Blog2Video video in the post.

A Blog2Video account and internet connection are required. Video generation and some editing operations use the connected account's quota or credits. Current service options are listed at https://blog2video.app/pricing/.

== External service ==

This plugin connects to Blog2Video, a hosted service operated by FireBird Technologies, at https://api-staging.blog2video.app. The service provides site authorization, account and project libraries, script and scene generation, narration, video rendering, storage, previews, downloads, and embeds.

The service is contacted when an administrator connects or disconnects the site; when an editor opens the Blog2Video panel to load account, project, template, voice, music, or status information; and when an editor explicitly generates, edits, regenerates, renders, downloads, embeds, replaces, or removes a video or uploaded image.

Depending on the requested action, the plugin may send the site URL, post ID, post title, canonical URL and saved content, an editor-supplied source URL, video and project settings, scene text and narration, template and voice choices, uploaded logo or scene-image files, and the site's revocable access token. Blog2Video processes and may store projects, uploaded media, generated narration, previews, and rendered videos to provide the service.

The plugin stores a revocable, site-limited token in WordPress options and stores project IDs, project names, content hashes, job status, and video or embed URLs in post metadata. It does not store the user's Blog2Video password or payment-card information.

Service policies and support:

* Privacy Policy: https://blog2video.app/privacy/
* Terms of Service: https://blog2video.app/terms
* Pricing and quotas: https://blog2video.app/pricing/
* Contact and support: https://blog2video.app/contact/

Users can delete their account from the Account section at https://blog2video.app/subscription or request assistance through the contact page. Disconnecting or uninstalling the plugin removes local WordPress connection data but does not delete the Blog2Video account or remote projects.

== Installation ==

1. Upload and activate Blog2Video.
2. Open Settings > Blog2Video and connect a Blog2Video account.
3. Complete approval in Blog2Video.
4. Open or create a post and use the Blog2Video editor panel.

Save the post before generating a video so its latest content is available.

== Frequently Asked Questions ==

= Is a Blog2Video account required? =

Yes. This plugin connects WordPress to the hosted Blog2Video service, so an account and internet connection are required.

= Does the plugin send post content automatically? =

No. Saved post content is sent when an authorized editor explicitly starts video generation from the current post. Opening the Blog2Video panel contacts the service to load account, project, template, voice, and status information.

= What happens when the plugin is disconnected or uninstalled? =

Disconnecting revokes this WordPress site's connection. Uninstalling removes locally stored connection settings and Blog2Video post metadata. Neither action deletes the Blog2Video account or projects stored by the hosted service.

= Where can I find the service policies? =

See https://blog2video.app/privacy/ and https://blog2video.app/terms.


== Screenshots ==

1. Start a video from the current post: pick the content source, video format, duration, and an optional logo.
2. Choose a template and video style, with a live gallery of available designs and colors.
3. Pick a narration language and preview voices before generating.
4. Open Project settings to change the template, voiceover, logo, colors, captions, and background music.
5. Browse and switch between existing Blog2Video projects, or open one already linked to the post.
6. A post with a video already embedded: the Gutenberg block plays inline, with the linked project shown in the sidebar for quick editing.

== Changelog ==

= 0.14.14 =

* Security and compatibility: all global functions, classes, constants, options, post meta keys, hooks, script and style handles, and JavaScript objects now use the unique `blog2video_` / `Blog2Video_` prefix.
* Security: every REST route now declares its own permission check that requires the user to be able to edit the post.
* Added the Blog2Video WordPress settings and post-editor interfaces.
* Added project selection, scene editing, project settings, rendering, downloading, and single-video embedding.
* Added site-scoped authorization and quota-related error handling.
* Added stricter validation for logo and scene-image uploads.

== Upgrade Notice ==

= 0.14.14 =

Upgrade for a smoother WordPress experience, improved video creation and editing features, better output quality, stronger upload validation, and important reliability and bug fixes.

== Source code ==

The human-readable React and TypeScript source for the compiled admin interface is maintained at https://github.com/FireBird-Technologies/blog2video/tree/main/wordpress/blog2video/ui and is also included in the plugin's `ui` directory.

To rebuild the browser assets, run `npm install` and then `npm run build` inside `wordpress/blog2video/ui`. The build writes `react-admin.js`, `react-settings.js`, and `react-ui.css` to the plugin's `assets` directory. WordPress supplies React through `wp-element`.
