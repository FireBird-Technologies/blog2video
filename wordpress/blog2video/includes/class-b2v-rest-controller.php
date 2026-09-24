<?php

defined( 'ABSPATH' ) || exit;

class B2V_REST_Controller {
	private $api;

	public function __construct( B2V_API_Client $api ) {
		$this->api = $api;
		add_action( 'rest_api_init', array( $this, 'routes' ) );
		add_action( 'add_meta_boxes', array( $this, 'meta_box' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );
	}

	public function routes() {
		$args = array( 'permission_callback' => array( $this, 'permission' ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/generate', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'generate' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/status', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'status' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/render', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'render' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/render-status', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'render_status' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/embed', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'embed' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/embed', array_merge( $args, array( 'methods' => 'DELETE', 'callback' => array( $this, 'remove_embed' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/catalog', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'catalog' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/account', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'account' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/projects/library', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'project_library' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/projects/select', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'select_project' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/editor', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'editor_data' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/layouts', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'layouts' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/logo', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'upload_logo' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/logo', array_merge( $args, array( 'methods' => 'DELETE', 'callback' => array( $this, 'delete_logo' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/logo', array_merge( $args, array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_logo' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/settings', array_merge( $args, array( 'methods' => 'PATCH', 'callback' => array( $this, 'update_settings' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/music-tracks', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'music_tracks' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/(?P<scene_id>\d+)', array_merge( $args, array( 'methods' => 'PUT', 'callback' => array( $this, 'update_scene' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/(?P<scene_id>\d+)/image', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'update_scene_image' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/(?P<scene_id>\d+)', array_merge( $args, array( 'methods' => 'DELETE', 'callback' => array( $this, 'delete_scene' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/reorder', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'reorder_scenes' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/(?P<scene_id>\d+)/regenerate', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'regenerate_scene' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/add', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'add_scene' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/scenes/add-status', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'add_scene_status' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/script/regenerate', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'regenerate_script' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/script/status', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'script_status' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/script/preview', array_merge( $args, array( 'methods' => 'GET', 'callback' => array( $this, 'script_preview' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/script/verify', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'verify_script' ) ) ) );
		register_rest_route( 'blog2video/v1', '/posts/(?P<id>\d+)/script/retry', array_merge( $args, array( 'methods' => 'POST', 'callback' => array( $this, 'retry_script' ) ) ) );
	}

	public function permission( WP_REST_Request $request ) {
		return current_user_can( 'edit_post', absint( $request['id'] ) );
	}

	private function response( $value ) {
		if ( is_wp_error( $value ) ) {
			$status = isset( $value->get_error_data()['status'] ) ? absint( $value->get_error_data()['status'] ) : 502;
			return new WP_Error( $value->get_error_code(), $value->get_error_message(), array( 'status' => $status ?: 502 ) );
		}
		return rest_ensure_response( $value );
	}

	private function project_id( $post_id ) {
		$id = absint( get_post_meta( $post_id, '_b2v_project_id', true ) );
		return $id ?: new WP_Error( 'b2v_no_project', __( 'Generate the video first.', 'blog2video' ), array( 'status' => 409 ) );
	}

	public function generate( WP_REST_Request $request ) {
		$post_id  = absint( $request['id'] );
		$source_type = 'url' === $request->get_param( 'source_type' ) ? 'url' : 'post';
		$source_url  = esc_url_raw( (string) $request->get_param( 'source_url' ), array( 'http', 'https' ) );
		$snapshot = 'url' === $source_type
			? B2V_Post_Extractor::url_snapshot( $post_id, $source_url )
			: B2V_Post_Extractor::snapshot( $post_id );
		if ( is_wp_error( $snapshot ) ) {
			return $this->response( $snapshot );
		}
		$allowed = array(
			'template'               => 'sanitize_key',
			'video_style'            => 'sanitize_key',
			'video_length'           => 'sanitize_key',
			'aspect_ratio'           => 'sanitize_key',
			'voice_gender'           => 'sanitize_key',
			'voice_accent'           => 'sanitize_key',
			'custom_voice_id'        => 'sanitize_text_field',
			'content_language'       => 'sanitize_text_field',
			'captions_enabled'       => 'rest_sanitize_boolean',
			'stock_footage_enabled'  => 'rest_sanitize_boolean',
		);
		$payload = $snapshot;
		$payload['source_type'] = $source_type;
		if ( 'url' === $source_type ) {
			$payload['source_url'] = $source_url;
		}
		foreach ( $allowed as $key => $sanitize ) {
			if ( null !== $request->get_param( $key ) ) {
				$payload[ $key ] = call_user_func( $sanitize, $request->get_param( $key ) );
			}
		}
		$payload += array( 'template' => 'default', 'video_style' => 'auto', 'video_length' => 'auto', 'aspect_ratio' => 'landscape', 'voice_gender' => 'female', 'voice_accent' => 'american', 'captions_enabled' => false, 'stock_footage_enabled' => false );
		$payload['idempotency_key'] = hash( 'sha256', home_url() . '|' . $post_id . '|' . $payload['content_hash'] . '|' . wp_json_encode( array_diff_key( $payload, $snapshot ) ) );
		$result = $this->api->request( 'POST', 'projects', $payload, true, array( 'Idempotency-Key' => $payload['idempotency_key'] ) );
		if ( ! is_wp_error( $result ) && ! empty( $result['project_id'] ) ) {
			$previous_project_id = absint( get_post_meta( $post_id, '_b2v_project_id', true ) );
			if ( $previous_project_id && $previous_project_id !== absint( $result['project_id'] ) ) {
				delete_post_meta( $post_id, '_b2v_embed_url' );
				delete_post_meta( $post_id, '_b2v_video_url' );
			}
			update_post_meta( $post_id, '_b2v_project_id', absint( $result['project_id'] ) );
			update_post_meta( $post_id, '_b2v_project_name', sanitize_text_field( $payload['title'] ) );
			update_post_meta( $post_id, '_b2v_content_hash', $payload['content_hash'] );
			$result['project_name'] = sanitize_text_field( $payload['title'] );
		}
		return $this->response( $result );
	}

	public function status( WP_REST_Request $request ) {
		$post_id = absint( $request['id'] );
		$id      = $this->project_id( $post_id );
		if ( is_wp_error( $id ) ) { return $this->response( $id ); }
		$result = $this->api->request( 'GET', "projects/{$id}/status" );
		if ( ! is_wp_error( $result ) ) { update_post_meta( $post_id, '_b2v_last_status', sanitize_key( $result['status'] ?? '' ) ); }
		return $this->response( $result );
	}

	public function render( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/render" ) );
	}

	public function render_status( WP_REST_Request $request ) {
		$post_id = absint( $request['id'] );
		$id      = $this->project_id( $post_id );
		$result  = is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/render-status" );
		if ( ! is_wp_error( $result ) && ! empty( $result['r2_video_url'] ) ) { update_post_meta( $post_id, '_b2v_video_url', esc_url_raw( $result['r2_video_url'] ) ); }
		return $this->response( $result );
	}

	public function embed( WP_REST_Request $request ) {
		$post_id = absint( $request['id'] );
		$id      = $this->project_id( $post_id );
		$result  = is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/embed" );
		if ( ! is_wp_error( $result ) && ! empty( $result['preview_url'] ) ) { update_post_meta( $post_id, '_b2v_embed_url', esc_url_raw( $result['preview_url'] ) ); }
		return $this->response( $result );
	}

	public function remove_embed( WP_REST_Request $request ) {
		$post_id = absint( $request['id'] );
		delete_post_meta( $post_id, '_b2v_embed_url' );
		return $this->response( array( 'removed' => true ) );
	}

	public function catalog() {
		return $this->response( $this->api->request( 'GET', 'catalog' ) );
	}

	public function account() {
		return $this->response( $this->api->request( 'GET', 'account' ) );
	}

	public function project_library( WP_REST_Request $request ) {
		$page = max( 1, absint( $request->get_param( 'page' ) ) ?: 1 );
		$per_page = absint( $request->get_param( 'per_page' ) ) ?: 20;
		$query = add_query_arg( array( 'page' => $page, 'per_page' => $per_page ), 'library/projects' );
		return $this->response( $this->api->request( 'GET', $query ) );
	}

	public function select_project( WP_REST_Request $request ) {
		$post_id = absint( $request['id'] );
		$project_id = absint( $request->get_param( 'project_id' ) );
		if ( ! $project_id ) {
			return $this->response( new WP_Error( 'b2v_project_required', __( 'Choose a project.', 'blog2video' ), array( 'status' => 400 ) ) );
		}
		$result = $this->api->request( 'POST', "library/projects/{$project_id}/link", array( 'external_post_id' => (string) $post_id ) );
		if ( ! is_wp_error( $result ) ) {
			update_post_meta( $post_id, '_b2v_project_id', $project_id );
			update_post_meta( $post_id, '_b2v_project_name', sanitize_text_field( $result['name'] ?? '' ) );
			delete_post_meta( $post_id, '_b2v_embed_url' );
			delete_post_meta( $post_id, '_b2v_video_url' );
		}
		return $this->response( $result );
	}

	public function editor_data( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/editor" ) );
	}

	public function layouts( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/layouts" ) );
	}

	public function upload_logo( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		if ( is_wp_error( $id ) ) { return $this->response( $id ); }
		$files = $request->get_file_params();
		$file  = isset( $files['logo'] ) && is_array( $files['logo'] ) ? $files['logo'] : null;
		if ( ! $file || ! empty( $file['error'] ) || empty( $file['tmp_name'] ) ) {
			return $this->response( new WP_Error( 'b2v_logo_missing', __( 'Choose a logo image to upload.', 'blog2video' ), array( 'status' => 400 ) ) );
		}
		if ( ! empty( $file['size'] ) && (int) $file['size'] > 2 * MB_IN_BYTES ) {
			return $this->response( new WP_Error( 'b2v_logo_too_large', __( 'Logo file too large. Maximum size is 2 MB.', 'blog2video' ), array( 'status' => 400 ) ) );
		}
		$result = $this->api->upload( "projects/{$id}/logo", 'file', $file );
		return $this->response( $result );
	}

	public function delete_logo( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'DELETE', "projects/{$id}/logo" ) );
	}

	public function update_logo( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'PATCH', "projects/{$id}/logo", is_array( $body ) ? $body : array() ) );
	}

	public function update_settings( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'PATCH', "projects/{$id}/settings", is_array( $body ) ? $body : array() ) );
	}

	public function music_tracks( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "background-music/tracks" ) );
	}

	public function update_scene( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'PUT', "projects/{$id}/scenes/" . absint( $request['scene_id'] ), is_array( $body ) ? $body : array() ) );
	}

	public function update_scene_image( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		if ( is_wp_error( $id ) ) { return $this->response( $id ); }
		$files = $request->get_file_params();
		$file  = isset( $files['image'] ) && is_array( $files['image'] ) ? $files['image'] : null;
		if ( ! $file || ! empty( $file['error'] ) || empty( $file['tmp_name'] ) ) {
			return $this->response( new WP_Error( 'b2v_image_missing', __( 'Choose an image to upload.', 'blog2video' ), array( 'status' => 400 ) ) );
		}
		if ( ! empty( $file['size'] ) && (int) $file['size'] > 5 * MB_IN_BYTES ) {
			return $this->response( new WP_Error( 'b2v_image_too_large', __( 'Image file too large. Maximum size is 5 MB.', 'blog2video' ), array( 'status' => 400 ) ) );
		}
		$result = $this->api->upload( "projects/{$id}/scenes/" . absint( $request['scene_id'] ) . '/image', 'image', $file );
		return $this->response( $result );
	}

	public function delete_scene( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'DELETE', "projects/{$id}/scenes/" . absint( $request['scene_id'] ) ) );
	}

	public function reorder_scenes( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/scenes/reorder", is_array( $body ) ? $body : array() ) );
	}

	public function regenerate_scene( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/scenes/" . absint( $request['scene_id'] ) . '/regenerate', is_array( $body ) ? $body : array() ) );
	}

	public function add_scene( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/scenes/add", is_array( $body ) ? $body : array() ) );
	}

	public function add_scene_status( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/scenes/add-status" ) );
	}

	public function regenerate_script( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/script/regenerate", is_array( $body ) ? $body : array() ) );
	}

	public function script_status( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/script/status" ) );
	}

	public function script_preview( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'GET', "projects/{$id}/script/preview" ) );
	}

	public function verify_script( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/script/verify" ) );
	}

	public function retry_script( WP_REST_Request $request ) {
		$id = $this->project_id( absint( $request['id'] ) );
		$body = $request->get_json_params();
		return $this->response( is_wp_error( $id ) ? $id : $this->api->request( 'POST', "projects/{$id}/script/retry", is_array( $body ) ? $body : array() ) );
	}

	public function meta_box() {
		foreach ( get_post_types( array( 'show_ui' => true ), 'names' ) as $type ) {
			if ( post_type_supports( $type, 'editor' ) ) { add_meta_box( 'b2v-video', 'Blog2Video', array( $this, 'box' ), $type, 'side', 'high' ); }
		}
	}

	public function box( $post ) {
		if ( ! $this->api->is_connected() ) {
			echo '<p>' . wp_kses_post( sprintf( __( '<a href="%s">Connect Blog2Video</a> to generate a video.', 'blog2video' ), esc_url( admin_url( 'options-general.php?page=blog2video' ) ) ) ) . '</p>';
			return;
		}
		echo '<div id="b2v-react-root"><p style="padding:16px;margin:0">' . esc_html__( 'Loading Blog2Video…', 'blog2video' ) . '</p></div>';
		return;
		?>
		<div id="b2v-panel">
		<div class="b2v-intro"><img class="b2v-logo" src="<?php echo esc_url( B2V_URL . 'assets/b2v-logo.png' ); ?>" alt="<?php esc_attr_e( 'Blog2Video', 'blog2video' ); ?>"><div><strong><?php esc_html_e( 'Create your video', 'blog2video' ); ?></strong><span><?php esc_html_e( 'Turn this post or any article into a ready-to-share video.', 'blog2video' ); ?></span></div></div>
		<div class="b2v-project-context" id="b2v-project-context"><div class="b2v-project-context-copy"><span><?php esc_html_e( 'Active video project', 'blog2video' ); ?></span><strong id="b2v-active-project-name"><?php echo esc_html( get_post_meta( $post->ID, '_b2v_project_name', true ) ?: __( 'No project selected', 'blog2video' ) ); ?></strong><small id="b2v-active-project-id"><?php $active_project_id = absint( get_post_meta( $post->ID, '_b2v_project_id', true ) ); echo $active_project_id ? esc_html( 'Project #' . $active_project_id ) : esc_html__( 'Choose an existing video or create a new one below.', 'blog2video' ); ?></small></div><button type="button" class="b2v-project-switch" id="b2v-browse-projects"><?php esc_html_e( 'Browse videos', 'blog2video' ); ?><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 6 6-6 6"></path></svg></button></div>

		<?php $b2v_has_project = (bool) get_post_meta( $post->ID, '_b2v_project_id', true ); ?>
		<div class="b2v-section" id="b2v-source-section" <?php echo $b2v_has_project ? 'hidden' : ''; ?>>
			<label class="b2v-label" for="b2v-source-type"><?php esc_html_e( 'Content source', 'blog2video' ); ?></label>
			<select data-b2v="source_type" id="b2v-source-type"><option value="post"><?php esc_html_e( 'Current post content', 'blog2video' ); ?></option><option value="url"><?php esc_html_e( 'Web page URL', 'blog2video' ); ?></option></select>
			<div id="b2v-source-url-wrap" hidden><label class="b2v-label" for="b2v-source-url"><?php esc_html_e( 'Article URL', 'blog2video' ); ?></label><input type="url" data-b2v="source_url" id="b2v-source-url" placeholder="https://example.com/article"><span class="b2v-help"><?php esc_html_e( 'The video will be attached to this WordPress post.', 'blog2video' ); ?></span></div>
			<span class="b2v-help" id="b2v-post-source-help"><?php esc_html_e( 'Save the post first so its latest text is used.', 'blog2video' ); ?></span>
		</div>

		<div class="b2v-section b2v-settings-grid" id="b2v-settings-grid" <?php echo $b2v_has_project ? 'hidden' : ''; ?>>
			<div class="b2v-field b2v-field-wide"><span class="b2v-label"><?php esc_html_e( 'Template', 'blog2video' ); ?></span><select data-b2v="template" id="b2v-template" class="b2v-data-field" tabindex="-1" aria-hidden="true"><option value="default">Geometric Explainer</option><option value="newspaper">Newspaper</option><option value="magazine">Magazine</option><option value="nightfall">Nightfall</option><option value="whiteboard">Stick Man</option><option value="matrix">Matrix</option><option value="spotlight">Spotlight</option><option value="newscast">Newscast</option></select><button type="button" class="b2v-choice-button" id="b2v-browse-templates"><svg class="b2v-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M8 4v16M8 10h13"></path></svg><span class="b2v-choice-copy"><small><?php esc_html_e( 'Selected template', 'blog2video' ); ?></small><strong id="b2v-selected-template"><?php esc_html_e( 'Geometric Explainer', 'blog2video' ); ?></strong></span><svg class="b2v-choice-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"></path></svg></button></div>
			<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Style', 'blog2video' ); ?></span><select data-b2v="video_style"><option value="auto">Auto</option><option value="explainer">Explainer</option><option value="promotional">Promotional</option><option value="storytelling">Storytelling</option></select></label>
			<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Length', 'blog2video' ); ?></span><select data-b2v="video_length"><option value="auto">Auto</option><option value="short">Short</option><option value="medium">Medium</option><option value="detailed">Detailed</option></select></label>
			<label class="b2v-field b2v-field-wide"><span class="b2v-label"><?php esc_html_e( 'Format', 'blog2video' ); ?></span><select data-b2v="aspect_ratio"><option value="landscape">Landscape (16:9)</option><option value="portrait">Portrait (9:16)</option></select></label>
			<div class="b2v-field b2v-field-wide"><span class="b2v-label"><?php esc_html_e( 'Voiceover', 'blog2video' ); ?></span><input type="hidden" data-b2v="voice_gender" id="b2v-voice-gender" value="female"><input type="hidden" data-b2v="voice_accent" id="b2v-voice-accent" value="american"><input type="hidden" data-b2v="custom_voice_id" id="b2v-custom-voice-id" value=""><button type="button" class="b2v-choice-button" id="b2v-browse-voices"><svg class="b2v-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"></path></svg><span class="b2v-choice-copy"><small><?php esc_html_e( 'Selected voice', 'blog2video' ); ?></small><strong id="b2v-selected-voice"><?php esc_html_e( 'No voice selected', 'blog2video' ); ?></strong></span><svg class="b2v-choice-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"></path></svg></button><span class="b2v-help"><?php esc_html_e( 'Open the gallery to preview and choose a voice.', 'blog2video' ); ?></span></div>
			<div class="b2v-toggles b2v-field-wide"><label><input type="checkbox" data-b2v="captions_enabled"><span><?php esc_html_e( 'Captions', 'blog2video' ); ?></span></label><label><input type="checkbox" data-b2v="stock_footage_enabled"><span><?php esc_html_e( 'Stock footage', 'blog2video' ); ?></span></label></div>
		</div>

		<div class="b2v-generate-warning" id="b2v-generate-warning" <?php echo $b2v_has_project ? 'hidden' : ''; ?>><svg class="b2v-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"></path></svg><span><?php esc_html_e( 'This video will only be created once. To make a different video from this post later, create a new post — this generation cannot be redone or changed afterward.', 'blog2video' ); ?></span></div>

		<div class="b2v-actions" id="b2v-generate-actions" <?php echo $b2v_has_project ? 'hidden' : ''; ?>><button type="button" class="button button-primary" id="b2v-generate"><span id="b2v-generate-label"><?php esc_html_e( 'Generate video', 'blog2video' ); ?></span></button></div>
		<div class="b2v-actions" id="b2v-render-actions">
			<button type="button" class="button button-primary" id="b2v-render" hidden><span><?php esc_html_e( 'Render video', 'blog2video' ); ?></span></button>
			<button type="button" class="button button-primary" id="b2v-embed" disabled><?php esc_html_e( 'Add video to post', 'blog2video' ); ?></button>
		</div>

		<div id="b2v-status-card" class="b2v-status-card" aria-live="polite" <?php echo get_post_meta( $post->ID, '_b2v_last_status', true ) ? '' : 'hidden'; ?>><span class="b2v-status-icon" aria-hidden="true"></span><div><strong id="b2v-status"><?php echo esc_html( get_post_meta( $post->ID, '_b2v_last_status', true ) ); ?></strong><div class="b2v-progress" id="b2v-progress" hidden><span></span></div><div id="b2v-upgrade-slot" class="b2v-upgrade-slot" hidden><a href="#" target="_blank" rel="noopener" class="button button-primary" id="b2v-upgrade-link"><?php esc_html_e( 'Upgrade plan', 'blog2video' ); ?></a></div></div></div>

		<button type="button" class="button b2v-download-button" id="b2v-download-video" data-video-url="<?php echo esc_url( get_post_meta( $post->ID, '_b2v_video_url', true ) ); ?>" <?php echo get_post_meta( $post->ID, '_b2v_video_url', true ) ? '' : 'hidden'; ?>><?php esc_html_e( 'Download video', 'blog2video' ); ?></button>

		<div class="b2v-refine-card" id="b2v-refine-card" <?php echo get_post_meta( $post->ID, '_b2v_project_id', true ) ? '' : 'hidden'; ?>><div><strong><?php esc_html_e( 'Scene-by-scene editing', 'blog2video' ); ?></strong><p><?php esc_html_e( 'Edit each scene’s text, narration, visual direction, layout and timing. Add, delete, reorder or regenerate individual scenes without leaving WordPress.', 'blog2video' ); ?></p></div><button type="button" class="button b2v-editor-link" id="b2v-editor"><svg class="b2v-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg><span><?php esc_html_e( 'Open scene editor', 'blog2video' ); ?></span></button></div>

		<div class="b2v-refine-card" id="b2v-project-settings-card" <?php echo get_post_meta( $post->ID, '_b2v_project_id', true ) ? '' : 'hidden'; ?>><div><strong><?php esc_html_e( 'Project settings', 'blog2video' ); ?></strong><p><?php esc_html_e( 'Logo, colors, font, captions and background music for this video.', 'blog2video' ); ?></p></div><button type="button" class="button b2v-editor-link" id="b2v-open-project-settings"><svg class="b2v-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg><span><?php esc_html_e( 'Edit project', 'blog2video' ); ?></span></button></div>

		<div class="b2v-editor-modal" id="b2v-project-settings-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-project-settings-title" hidden>
			<div class="b2v-editor-backdrop" data-b2v-close-project-settings></div>
			<div class="b2v-editor-dialog b2v-project-settings-dialog">
				<div class="b2v-editor-header">
					<div class="b2v-editor-brand"><img src="<?php echo esc_url( B2V_URL . 'assets/b2v-logo.png' ); ?>" alt=""><div><strong id="b2v-project-settings-title"><?php esc_html_e( 'Project settings', 'blog2video' ); ?></strong><span><?php esc_html_e( 'Logo, colors, font, captions and music', 'blog2video' ); ?></span></div></div>
					<div class="b2v-editor-header-actions"><button type="button" class="b2v-icon-close" data-b2v-close-project-settings aria-label="<?php esc_attr_e( 'Close', 'blog2video' ); ?>">×</button></div>
				</div>
				<div class="b2v-project-settings-body">
					<div class="b2v-project-settings-grid">
						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Template', 'blog2video' ); ?></h3><p><?php esc_html_e( 'Rebuild scene layouts for a new template.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card">
								<div class="b2v-choice-copy"><small><?php esc_html_e( 'Current template', 'blog2video' ); ?></small><strong id="b2v-modal-selected-template"><?php esc_html_e( 'Geometric Explainer', 'blog2video' ); ?></strong></div>
								<div class="b2v-settings-card-footer"><button type="button" class="button button-primary" id="b2v-modal-browse-templates"><?php esc_html_e( 'Change template', 'blog2video' ); ?></button></div>
							</div>
						</section>

						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Voiceover', 'blog2video' ); ?></h3><p><?php esc_html_e( 'The narration voice for this project.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card">
								<div class="b2v-choice-copy"><small><?php esc_html_e( 'Current voice', 'blog2video' ); ?></small><strong id="b2v-modal-selected-voice"><?php esc_html_e( 'No voice selected', 'blog2video' ); ?></strong></div>
								<div class="b2v-settings-card-footer"><button type="button" class="button button-primary" id="b2v-modal-browse-voices"><?php esc_html_e( 'Change voice', 'blog2video' ); ?></button></div>
							</div>
						</section>

						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Logo', 'blog2video' ); ?></h3><p><?php esc_html_e( 'Add your logo as a watermark on the video. PNG, JPEG, WebP or SVG, up to 2 MB.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card" id="b2v-logo-card">
								<div class="b2v-logo-preview" id="b2v-logo-preview" hidden><img id="b2v-logo-preview-image" src="" alt="<?php esc_attr_e( 'Logo preview', 'blog2video' ); ?>"></div>
								<div class="b2v-logo-empty" id="b2v-logo-empty"><?php esc_html_e( 'No logo uploaded yet.', 'blog2video' ); ?></div>
								<div class="b2v-logo-actions">
									<label class="button" id="b2v-logo-choose"><?php esc_html_e( 'Upload logo', 'blog2video' ); ?><input type="file" id="b2v-logo-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
									<button type="button" class="button button-link-delete" id="b2v-logo-remove" hidden><?php esc_html_e( 'Remove logo', 'blog2video' ); ?></button>
								</div>
								<div class="b2v-logo-settings" id="b2v-logo-settings" hidden>
									<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Position', 'blog2video' ); ?></span><select id="b2v-logo-position"><option value="top_left"><?php esc_html_e( 'Top left', 'blog2video' ); ?></option><option value="top_right"><?php esc_html_e( 'Top right', 'blog2video' ); ?></option><option value="bottom_left"><?php esc_html_e( 'Bottom left', 'blog2video' ); ?></option><option value="bottom_right" selected><?php esc_html_e( 'Bottom right', 'blog2video' ); ?></option></select></label>
									<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Size', 'blog2video' ); ?></span><input type="range" id="b2v-logo-size" min="50" max="200" step="1" value="100"></label>
									<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Opacity', 'blog2video' ); ?></span><input type="range" id="b2v-logo-opacity" min="0" max="1" step="0.05" value="0.9"></label>
								</div>
								<p class="b2v-logo-message" id="b2v-logo-message" aria-live="polite"></p>
							</div>
						</section>

						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Colors & Font', 'blog2video' ); ?></h3><p><?php esc_html_e( 'Theme colors and font applied across all scenes.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card" id="b2v-colors-card">
								<div class="b2v-color-row">
									<label class="b2v-color-field"><input type="color" id="b2v-color-accent" value="#7C3AED"><span><span class="b2v-label"><?php esc_html_e( 'Accent', 'blog2video' ); ?></span><span class="b2v-label-hint"><?php esc_html_e( 'Buttons & highlights', 'blog2video' ); ?></span></span></label>
									<label class="b2v-color-field"><input type="color" id="b2v-color-text" value="#000000"><span><span class="b2v-label"><?php esc_html_e( 'Text', 'blog2video' ); ?></span><span class="b2v-label-hint"><?php esc_html_e( 'On-screen text', 'blog2video' ); ?></span></span></label>
									<label class="b2v-color-field"><input type="color" id="b2v-color-bg" value="#FFFFFF"><span><span class="b2v-label"><?php esc_html_e( 'Background', 'blog2video' ); ?></span><span class="b2v-label-hint"><?php esc_html_e( 'Scene background', 'blog2video' ); ?></span></span></label>
								</div>
								<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Font', 'blog2video' ); ?></span>
									<select id="b2v-font-family">
										<option value=""><?php esc_html_e( 'Default', 'blog2video' ); ?></option>
										<option value="inter">Inter</option>
										<option value="roboto_slab">Roboto Slab</option>
										<option value="patrick_hand">Patrick Hand</option>
										<option value="arimo">Arimo</option>
										<option value="archivo_black">Archivo Black</option>
										<option value="poppins">Poppins</option>
										<option value="montserrat">Montserrat</option>
										<option value="merriweather">Merriweather</option>
										<option value="playfair_display">Playfair Display</option>
										<option value="oswald">Oswald</option>
										<option value="lora">Lora</option>
										<option value="righteous">Righteous</option>
										<option value="im_fell_english">IM Fell English</option>
										<option value="pirata_one">Pirata One</option>
										<option value="cinzel_decorative">Cinzel Decorative</option>
										<option value="dm_sans">DM Sans</option>
										<option value="source_sans_3">Source Sans 3</option>
										<option value="source_serif_4">Source Serif 4</option>
										<option value="shippori_mincho">Shippori Mincho</option>
									</select>
								</label>
								<div class="b2v-settings-card-footer"><button type="button" class="button button-primary" id="b2v-colors-save"><?php esc_html_e( 'Save colors & font', 'blog2video' ); ?></button><p class="b2v-settings-message" id="b2v-colors-message" aria-live="polite"></p></div>
							</div>
						</section>

						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Captions', 'blog2video' ); ?></h3><p><?php esc_html_e( 'Requires a voiceover to sync to.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card" id="b2v-captions-card">
								<label class="b2v-toggle-row"><input type="checkbox" id="b2v-captions-toggle"><span><?php esc_html_e( 'Show captions', 'blog2video' ); ?></span></label>
								<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Font', 'blog2video' ); ?></span>
									<select id="b2v-caption-font">
										<option value="inter">Inter</option>
										<option value="poppins">Poppins</option>
										<option value="montserrat">Montserrat</option>
										<option value="roboto_slab">Roboto Slab</option>
										<option value="oswald">Oswald</option>
										<option value="lora">Lora</option>
										<option value="patrick_hand">Patrick Hand</option>
										<option value="arimo">Arimo</option>
										<option value="archivo_black">Archivo Black</option>
										<option value="merriweather">Merriweather</option>
										<option value="playfair_display">Playfair Display</option>
										<option value="fira_code">Fira Code</option>
									</select>
								</label>
								<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Font size', 'blog2video' ); ?></span><input type="range" id="b2v-caption-size" min="12" max="64" step="1" value="36"></label>
								<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Vertical offset', 'blog2video' ); ?></span><input type="range" id="b2v-caption-offset" min="-100" max="100" step="1" value="0"></label>
								<div class="b2v-settings-card-footer"><button type="button" class="button button-primary" id="b2v-captions-save"><?php esc_html_e( 'Save caption settings', 'blog2video' ); ?></button><p class="b2v-settings-message" id="b2v-captions-message" aria-live="polite"></p></div>
							</div>
						</section>

						<section class="b2v-settings-section">
							<div class="b2v-settings-section-head"><h3><?php esc_html_e( 'Background music', 'blog2video' ); ?></h3><p><?php esc_html_e( 'Optional soundtrack under the voiceover.', 'blog2video' ); ?></p></div>
							<div class="b2v-settings-card" id="b2v-music-card">
								<label class="b2v-field"><span class="b2v-label"><?php esc_html_e( 'Track', 'blog2video' ); ?></span><select id="b2v-music-track"><option value=""><?php esc_html_e( 'No music', 'blog2video' ); ?></option></select></label>
								<div class="b2v-music-preview-row"><button type="button" class="b2v-music-play" id="b2v-music-play" disabled aria-label="<?php esc_attr_e( 'Preview track', 'blog2video' ); ?>">▶</button><label class="b2v-field b2v-field-grow"><span class="b2v-label"><?php esc_html_e( 'Volume', 'blog2video' ); ?></span><input type="range" id="b2v-music-volume" min="0" max="1" step="0.05" value="0.1"></label></div>
								<div class="b2v-settings-card-footer"><button type="button" class="button button-primary" id="b2v-music-save"><?php esc_html_e( 'Save music', 'blog2video' ); ?></button><p class="b2v-settings-message" id="b2v-music-message" aria-live="polite"></p></div>
							</div>
						</section>
					</div>
				</div>
			</div>
		</div>

		<div class="b2v-editor-modal" id="b2v-editor-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-editor-title" hidden>
			<div class="b2v-editor-backdrop" data-b2v-close-editor></div>
			<div class="b2v-editor-dialog">
				<div class="b2v-editor-header">
					<div class="b2v-editor-brand"><img src="<?php echo esc_url( B2V_URL . 'assets/b2v-logo.png' ); ?>" alt=""><div><strong id="b2v-editor-title"><?php esc_html_e( 'Scene-by-scene video editor', 'blog2video' ); ?></strong><span id="b2v-editor-project-label"><?php $editor_name = (string) get_post_meta( $post->ID, '_b2v_project_name', true ); $editor_id = absint( get_post_meta( $post->ID, '_b2v_project_id', true ) ); echo esc_html( $editor_name && $editor_id ? $editor_name . ' · Project #' . $editor_id : __( 'Edit this video directly in WordPress', 'blog2video' ) ); ?></span></div></div>
					<div class="b2v-editor-header-actions"><button type="button" class="b2v-editor-done" data-b2v-close-editor><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"></path></svg><span><?php esc_html_e( 'Done', 'blog2video' ); ?></span></button><button type="button" class="b2v-icon-close b2v-editor-close" data-b2v-close-editor aria-label="<?php esc_attr_e( 'Close editor', 'blog2video' ); ?>">×</button></div>
				</div>
				<div class="b2v-native-editor">
					<div class="b2v-editor-tabs" role="tablist"><button type="button" class="b2v-editor-tab is-active" data-editor-tab="scenes" role="tab" aria-selected="true"><?php esc_html_e( 'Scenes', 'blog2video' ); ?></button><button type="button" class="b2v-editor-tab" data-editor-tab="script" role="tab" aria-selected="false"><?php esc_html_e( 'Script', 'blog2video' ); ?></button></div>
					<section class="b2v-editor-pane is-active" data-editor-pane="scenes">
						<div class="b2v-scenes-toolbar"><div><strong id="b2v-scene-count"><?php esc_html_e( 'Loading scenes…', 'blog2video' ); ?></strong><span><?php esc_html_e( 'Scenes are grouped in sets of five. Expand any scene to edit its saved properties.', 'blog2video' ); ?></span></div><button type="button" class="button button-primary" id="b2v-add-scene"><?php esc_html_e( '+ Add scene', 'blog2video' ); ?></button></div>
						<main class="b2v-scene-workspace"><div class="b2v-editor-loading" id="b2v-editor-loading"><span></span><?php esc_html_e( 'Loading existing scenes…', 'blog2video' ); ?></div><div id="b2v-scene-groups" class="b2v-scene-groups"></div><p class="b2v-scene-message" id="b2v-scene-message" aria-live="polite"></p></main>
					</section>
					<section class="b2v-editor-pane" data-editor-pane="script" hidden>
						<div class="b2v-script-toolbar"><div><strong><?php esc_html_e( 'Video script', 'blog2video' ); ?></strong><span id="b2v-script-summary"><?php esc_html_e( 'Edit the words viewers see and hear.', 'blog2video' ); ?></span></div><button type="button" class="button" id="b2v-script-regenerate-toggle"><?php esc_html_e( 'Regenerate script with AI', 'blog2video' ); ?></button></div>
						<main class="b2v-script-workspace">
							<div class="b2v-script-regenerate" id="b2v-script-regenerate" hidden><label for="b2v-script-instruction"><strong><?php esc_html_e( 'How should the script change?', 'blog2video' ); ?></strong><span><?php esc_html_e( 'For example: make it more concise, use a friendly tone, or focus on the database branching section.', 'blog2video' ); ?></span></label><textarea id="b2v-script-instruction" rows="4" maxlength="25000"></textarea><div class="b2v-script-actions"><button type="button" class="button button-primary" id="b2v-script-regenerate-start"><?php esc_html_e( 'Create revised script', 'blog2video' ); ?></button><button type="button" class="button" id="b2v-script-regenerate-cancel"><?php esc_html_e( 'Cancel', 'blog2video' ); ?></button></div></div>
							<div class="b2v-script-review" id="b2v-script-review" hidden></div>
							<div id="b2v-script-groups" class="b2v-script-groups"></div><p class="b2v-scene-message" id="b2v-script-message" aria-live="polite"></p>
						</main>
					</section>
				</div>
			</div>
		</div>
		<div class="b2v-library-modal" id="b2v-library-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-library-title" hidden><div class="b2v-library-backdrop" data-b2v-close-library></div><div class="b2v-library-dialog"><div class="b2v-library-header"><div><span class="b2v-library-eyebrow"><?php esc_html_e( 'Blog2Video library', 'blog2video' ); ?></span><h2 id="b2v-library-title"></h2></div><button type="button" class="b2v-icon-close b2v-library-close" data-b2v-close-library aria-label="<?php esc_attr_e( 'Close library', 'blog2video' ); ?>">×</button></div><div class="b2v-library-tools"><input type="search" id="b2v-library-search" placeholder="<?php esc_attr_e( 'Search…', 'blog2video' ); ?>"></div><div class="b2v-library-grid" id="b2v-library-grid"></div><div class="b2v-library-empty" id="b2v-library-empty" hidden><?php esc_html_e( 'No matching options found.', 'blog2video' ); ?></div></div></div>
		</div>
		<div class="b2v-project-modal" id="b2v-project-modal" role="dialog" aria-modal="true" aria-labelledby="b2v-project-modal-title" hidden><div class="b2v-project-backdrop" data-b2v-close-projects></div><div class="b2v-project-dialog"><div class="b2v-project-header"><div><span><?php esc_html_e( 'Your Blog2Video projects', 'blog2video' ); ?></span><h2 id="b2v-project-modal-title"><?php esc_html_e( 'Choose a video', 'blog2video' ); ?></h2><p><?php esc_html_e( 'Switch the project you are editing, or add any rendered video to this post.', 'blog2video' ); ?></p></div><button type="button" class="b2v-icon-close b2v-library-close" data-b2v-close-projects aria-label="<?php esc_attr_e( 'Close projects', 'blog2video' ); ?>">×</button></div><div class="b2v-project-tools"><input type="search" id="b2v-project-search" placeholder="<?php esc_attr_e( 'Search projects…', 'blog2video' ); ?>"><button type="button" class="b2v-project-back" data-b2v-close-projects>← <?php esc_html_e( 'Back to post', 'blog2video' ); ?></button></div><div class="b2v-project-grid" id="b2v-project-grid"></div><div class="b2v-project-empty" id="b2v-project-empty" hidden><?php esc_html_e( 'No projects found.', 'blog2video' ); ?></div></div></div>
		<?php
	}

	public function assets( $hook ) {
		if ( ! in_array( $hook, array( 'post.php', 'post-new.php' ), true ) ) { return; }
		$screen = get_current_screen();
		if ( ! $screen || ! $screen->post_type ) { return; }
		$asset_version = static function ( $file ) {
			$modified = filemtime( B2V_DIR . 'assets/' . $file );
			return $modified ? (string) $modified : B2V_VERSION;
		};
		wp_enqueue_style( 'b2v-admin', B2V_URL . 'assets/admin.css', array(), $asset_version( 'admin.css' ) );
		wp_enqueue_style( 'b2v-react-ui', B2V_URL . 'assets/react-ui.css', array( 'b2v-admin' ), $asset_version( 'react-ui.css' ) );
		wp_enqueue_script( 'b2v-admin', B2V_URL . 'assets/admin.js', array( 'wp-api-fetch', 'wp-data', 'wp-blocks' ), $asset_version( 'admin.js' ), true );
		wp_enqueue_script( 'b2v-react-admin', B2V_URL . 'assets/react-admin.js', array( 'b2v-admin', 'wp-element' ), $asset_version( 'react-admin.js' ), true );
		$project_id = absint( get_post_meta( get_the_ID(), '_b2v_project_id', true ) );
		wp_localize_script( 'b2v-admin', 'B2VAdmin', array(
			'postId'      => get_the_ID(),
			'projectId'   => $project_id,
			'projectName' => $project_id ? (string) get_post_meta( get_the_ID(), '_b2v_project_name', true ) : '',
			'root'        => '/blog2video/v1/posts/',
			'mediaBase'   => $this->api->base_url(),
			'appUrl'      => $this->api->app_url(),
			'hasEmbed'    => (bool) get_post_meta( get_the_ID(), '_b2v_embed_url', true ),
			'hasProject'  => $project_id > 0,
			'lastStatus'  => (string) get_post_meta( get_the_ID(), '_b2v_last_status', true ),
			'videoUrl'    => (string) get_post_meta( get_the_ID(), '_b2v_video_url', true ),
			'logoUrl'     => B2V_URL . 'assets/b2v-logo.png',
		) );
	}
}
