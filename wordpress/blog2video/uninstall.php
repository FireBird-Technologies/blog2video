<?php
/** Remove credentials and generated references when the plugin is deleted. */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'blog2video_connection' );
delete_option( 'blog2video_pending_connection' );
delete_option( 'blog2video_auto_embed' );

foreach ( array( '_blog2video_project_id', '_blog2video_project_name', '_blog2video_content_hash', '_blog2video_editor_url', '_blog2video_last_status', '_blog2video_video_url', '_blog2video_embed_url' ) as $blog2video_meta_key ) {
	delete_post_meta_by_key( $blog2video_meta_key );
}
