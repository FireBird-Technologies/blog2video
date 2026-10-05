<?php
/**
 * Plugin Name: Blog2Video
 * Plugin URI: https://blog2video.app/wordpress-plugin
 * Description: Turn WordPress posts into narrated videos and embed them back into the post.
 * Version: 0.14.14
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: Blog2Video
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: blog2video
 */

defined( 'ABSPATH' ) || exit;

define( 'BLOG2VIDEO_VERSION', '0.14.14' );
define( 'BLOG2VIDEO_FILE', __FILE__ );
define( 'BLOG2VIDEO_DIR', plugin_dir_path( __FILE__ ) );
define( 'BLOG2VIDEO_URL', plugin_dir_url( __FILE__ ) );

require_once BLOG2VIDEO_DIR . 'includes/class-blog2video-api-client.php';
require_once BLOG2VIDEO_DIR . 'includes/class-blog2video-post-extractor.php';
require_once BLOG2VIDEO_DIR . 'includes/class-blog2video-settings.php';
require_once BLOG2VIDEO_DIR . 'includes/class-blog2video-rest-controller.php';
require_once BLOG2VIDEO_DIR . 'includes/class-blog2video-block.php';

/** Boot after WordPress has loaded pluggable APIs. */
function blog2video_boot_plugin() {
	$api = new Blog2Video_API_Client();
	new Blog2Video_Settings( $api );
	new Blog2Video_REST_Controller( $api );
	new Blog2Video_Block();
}
add_action( 'plugins_loaded', 'blog2video_boot_plugin' );

register_activation_hook(
	__FILE__,
	static function () {
		add_option( 'blog2video_auto_embed', '1' );
	}
);

add_action(
	'admin_init',
	static function () {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'Blog2Video',
				wp_kses_post(
					'<p>Blog2Video is an external service operated by FireBird Technologies. When an administrator connects this site, WordPress stores a revocable, site-limited access token. The plugin contacts <code>https://api-staging.blog2video.app</code> to authenticate the site, load the connected account&rsquo;s projects and media options, and perform requested video operations.</p>' .
					'<p>When an authorized editor starts video generation, the plugin sends the post title and canonical URL plus either the saved post content or a source URL selected by the editor. When the editor uses the corresponding features, the plugin also sends video settings, scene edits, and uploaded logo or scene-image files. Blog2Video processes and may store this information, generated projects, media, and rendered videos to provide the service.</p>' .
					'<p>The plugin stores the connected-site token in WordPress options and project identifiers, project name, generation status, and video or embed URLs in post metadata. Disconnecting or uninstalling the plugin removes local connection data but does not delete the user&rsquo;s Blog2Video account or remote projects.</p>' .
					'<p>For service data retention and deletion details, see the <a href="https://blog2video.app/privacy/">Blog2Video Privacy Policy</a>. Users can delete their account from the Account section at <a href="https://blog2video.app/subscription">Blog2Video account settings</a> or request help through the <a href="https://blog2video.app/contact/">contact page</a>. Use of the service is also governed by the <a href="https://blog2video.app/terms">Blog2Video Terms of Service</a>.</p>'
				)
			);
		}
	}
);
