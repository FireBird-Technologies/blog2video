<?php
/**
 * Plugin Name: Blog2Video
 * Plugin URI: https://blog2video.app
 * Update URI: https://blog2video.app/wordpress
 * Description: Turn WordPress posts into narrated videos and embed them back into the post.
 * Version: 0.14.5
 * Requires at least: 6.2
 * Requires PHP: 7.4
 * Author: Blog2Video
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: blog2video
 */

defined( 'ABSPATH' ) || exit;

define( 'B2V_VERSION', '0.14.5' );
define( 'B2V_FILE', __FILE__ );
define( 'B2V_DIR', plugin_dir_path( __FILE__ ) );
define( 'B2V_URL', plugin_dir_url( __FILE__ ) );

require_once B2V_DIR . 'includes/class-b2v-api-client.php';
require_once B2V_DIR . 'includes/class-b2v-post-extractor.php';
require_once B2V_DIR . 'includes/class-b2v-settings.php';
require_once B2V_DIR . 'includes/class-b2v-rest-controller.php';
require_once B2V_DIR . 'includes/class-b2v-block.php';

/** Boot after WordPress has loaded pluggable APIs. */
function b2v_boot_plugin() {
	$api = new B2V_API_Client();
	new B2V_Settings( $api );
	new B2V_REST_Controller( $api );
	new B2V_Block();
}
add_action( 'plugins_loaded', 'b2v_boot_plugin' );

register_activation_hook(
	__FILE__,
	static function () {
		add_option( 'b2v_auto_embed', '1' );
	}
);

add_action(
	'admin_init',
	static function () {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'Blog2Video',
				wp_kses_post(
					'<p>When an authorized editor clicks Generate, the Blog2Video plugin sends the current post title and canonical URL plus either the saved post content or a source URL selected by the editor to the connected Blog2Video account. Blog2Video processes that data to create the requested video. The plugin stores the resulting project identifiers and embed URL in post metadata.</p>'
				)
			);
		}
	}
);
