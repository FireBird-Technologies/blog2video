<?php

defined( 'ABSPATH' ) || exit;

class Blog2Video_API_Client {
	const CONNECTION_OPTION = 'blog2video_connection';

	public function base_url() {
		$default = defined( 'BLOG2VIDEO_API_URL' ) ? BLOG2VIDEO_API_URL : 'https://api-staging.blog2video.app';
		return untrailingslashit( apply_filters( 'blog2video_api_url', $default ) );
	}

	public function app_url() {
		// A BLOG2VIDEO_APP_URL constant or blog2video_app_url filter can override this value
		// (used for local development against a non-production frontend).
		$default = defined( 'BLOG2VIDEO_APP_URL' ) ? BLOG2VIDEO_APP_URL : 'https://blog2video.app';
		return untrailingslashit( apply_filters( 'blog2video_app_url', $default ) );
	}

	public function connection() {
		$value = get_option( self::CONNECTION_OPTION, array() );
		return is_array( $value ) ? $value : array();
	}

	public function is_connected() {
		return ! empty( $this->connection()['access_token'] );
	}

	public function request( $method, $path, $body = null, $authenticated = true, $headers = array() ) {
		$url = $this->base_url() . '/api/integrations/wordpress/v1/' . ltrim( $path, '/' );
		$args = array(
			'method'  => strtoupper( $method ),
			'timeout' => 30,
			'headers' => array_merge( array( 'Accept' => 'application/json' ), $headers ),
		);
		if ( null !== $body ) {
			$args['headers']['Content-Type'] = 'application/json';
			$args['body']                    = wp_json_encode( $body );
		}
		if ( $authenticated ) {
			$token = isset( $this->connection()['access_token'] ) ? $this->connection()['access_token'] : '';
			if ( ! $token ) {
				return new WP_Error( 'blog2video_not_connected', __( 'Connect Blog2Video first.', 'blog2video' ) );
			}
			$args['headers']['Authorization'] = 'Bearer ' . $token;
		}

		$response = wp_safe_remote_request( $url, $args );
		if ( is_wp_error( $response ) ) {
			return $response;
		}
		$status = wp_remote_retrieve_response_code( $response );
		$data   = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $status < 200 || $status >= 300 ) {
			$message = is_array( $data ) && ! empty( $data['detail'] ) ? $data['detail'] : __( 'Blog2Video request failed.', 'blog2video' );
			if ( is_array( $message ) ) {
				$messages = array();
				foreach ( $message as $item ) {
					if ( is_array( $item ) && ! empty( $item['msg'] ) ) {
						$messages[] = (string) $item['msg'];
					}
				}
				$message = $messages ? implode( ' ', $messages ) : wp_json_encode( $message );
			}
			$normalized_message = strtolower( (string) $message );
			if ( 403 === $status && ( false !== strpos( $normalized_message, 'video limit' ) || false !== strpos( $normalized_message, 'more credits' ) ) ) {
				$code = 'blog2video_video_limit';
			} elseif ( 403 === $status && ( false !== strpos( $normalized_message, 'upgrade' ) || false !== strpos( $normalized_message, 'paid plan' ) || false !== strpos( $normalized_message, 'subscription' ) ) ) {
				$code = 'blog2video_upgrade_required';
			} elseif ( 403 === $status ) {
				$code = 'blog2video_forbidden';
			} else {
				$code = 'blog2video_api_error';
			}
			return new WP_Error( $code, sanitize_text_field( (string) $message ), array( 'status' => $status ) );
		}
		return is_array( $data ) ? $data : array();
	}

	public function upload( $path, $field_name, $file ) {
		$token = isset( $this->connection()['access_token'] ) ? $this->connection()['access_token'] : '';
		if ( ! $token ) {
			return new WP_Error( 'blog2video_not_connected', __( 'Connect Blog2Video first.', 'blog2video' ) );
		}
		if ( ! is_array( $file ) || UPLOAD_ERR_OK !== (int) ( $file['error'] ?? UPLOAD_ERR_NO_FILE ) || empty( $file['tmp_name'] ) || ! is_readable( $file['tmp_name'] ) ) {
			return new WP_Error( 'blog2video_image_upload_failed', __( 'The uploaded image could not be read.', 'blog2video' ), array( 'status' => 400 ) );
		}

		$allowed_mimes = array(
			'jpg|jpeg' => 'image/jpeg',
			'png'      => 'image/png',
			'webp'     => 'image/webp',
		);
		$name          = sanitize_file_name( isset( $file['name'] ) ? $file['name'] : 'scene-image.jpg' );
		$checked       = wp_check_filetype_and_ext( $file['tmp_name'], $name, $allowed_mimes );
		$type          = isset( $checked['type'] ) ? $checked['type'] : false;
		$extension     = isset( $checked['ext'] ) ? $checked['ext'] : false;
		if ( ! $type || ! $extension || ! in_array( $type, $allowed_mimes, true ) ) {
			return new WP_Error( 'blog2video_image_type_invalid', __( 'Upload a valid PNG, JPEG, or WebP image.', 'blog2video' ), array( 'status' => 400 ) );
		}
		if ( ! empty( $checked['proper_filename'] ) ) {
			$name = sanitize_file_name( $checked['proper_filename'] );
		}

		$contents = file_get_contents( $file['tmp_name'] );
		if ( false === $contents ) {
			return new WP_Error( 'blog2video_image_read_failed', __( 'Could not read the uploaded image.', 'blog2video' ) );
		}
		$boundary = 'b2v-' . wp_generate_password( 24, false, false );
		$body = '--' . $boundary . "\r\n";
		$body .= 'Content-Disposition: form-data; name="' . sanitize_key( $field_name ) . '"; filename="' . $name . '"' . "\r\n";
		$body .= 'Content-Type: ' . $type . "\r\n\r\n";
		$body .= $contents . "\r\n--" . $boundary . "--\r\n";
		$url = $this->base_url() . '/api/integrations/wordpress/v1/' . ltrim( $path, '/' );
		$response = wp_safe_remote_request( $url, array(
			'method'  => 'POST',
			'timeout' => 60,
			'headers' => array(
				'Accept'        => 'application/json',
				'Authorization' => 'Bearer ' . $token,
				'Content-Type'  => 'multipart/form-data; boundary=' . $boundary,
			),
			'body' => $body,
		) );
		if ( is_wp_error( $response ) ) { return $response; }
		$status = wp_remote_retrieve_response_code( $response );
		$data = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $status < 200 || $status >= 300 ) {
			$message = is_array( $data ) && ! empty( $data['detail'] ) ? $data['detail'] : __( 'Image upload failed.', 'blog2video' );
			return new WP_Error( 'blog2video_api_error', sanitize_text_field( is_string( $message ) ? $message : wp_json_encode( $message ) ), array( 'status' => $status ) );
		}
		return is_array( $data ) ? $data : array();
	}
}
