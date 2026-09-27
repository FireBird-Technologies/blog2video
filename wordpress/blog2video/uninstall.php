<?php
/** Remove credentials and generated references when the plugin is deleted. */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'b2v_connection' );
delete_option( 'b2v_pending_connection' );
delete_option( 'b2v_auto_embed' );

foreach ( array( '_b2v_project_id', '_b2v_project_name', '_b2v_content_hash', '_b2v_editor_url', '_b2v_last_status', '_b2v_video_url', '_b2v_embed_url' ) as $meta_key ) {
	delete_post_meta_by_key( $meta_key );
}
