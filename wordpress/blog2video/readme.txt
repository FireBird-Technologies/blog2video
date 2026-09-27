=== Blog2Video ===
Contributors: blog2video
Tags: video, ai, blog, embed, gutenberg
Requires at least: 6.2
Tested up to: 6.6
Requires PHP: 7.4
Stable tag: 0.14.5
License: GPLv2 or later

Turn a WordPress post into a narrated Blog2Video project, render it, and embed the result.

== Installation ==

1. Copy the `blog2video` folder to `/wp-content/plugins/` or upload its ZIP in Plugins > Add New.
2. Activate Blog2Video.
3. Open Settings > Blog2Video and connect your Blog2Video account.
4. Open a post and use the Blog2Video editor panel.

For local or self-hosted API development, set `B2V_API_URL` in wp-config.php or use the `b2v_api_url` filter.

== Security and privacy ==

The connection uses a short-lived approval code. WordPress stores a revocable site token, not your Blog2Video password. Post content is transmitted only after an editor with permission to edit that post starts generation.
