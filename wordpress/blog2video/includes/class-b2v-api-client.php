<?php

defined( 'ABSPATH' ) || exit;

class B2V_API_Client {
	const CONNECTION_OPTION = 'b2v_connection';

	public function base_url() {
		$default = defined( 'B2V_API_URL' ) ? B2V_API_URL : 'https://api.blog2video.app';
		return untrailingslashit( apply_filters( 'b2v_api_url', $default ) );
	}

	public function app_url() {
		$default = defined( 'B2V_APP_URL' ) ? B2V_APP_URL : 'https://blog2video.app';
		return untrailingslashit( apply_filters( 'b2v_app_url', $default ) );
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
				return new WP_Error( 'b2v_not_connected', __( 'Connect Blog2Video first.', 'blog2video' ) );
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
			$code = 403 === $status ? 'b2v_video_limit' : 'b2v_api_error';
			return new WP_Error( $code, sanitize_text_field( (string) $message ), array( 'status' => $status ) );
		}
		return is_array( $data ) ? $data : array();
	}

	public function upload( $path, $field_name, $file ) {
		$token = isset( $this->connection()['access_token'] ) ? $this->connection()['access_token'] : '';
		if ( ! $token ) {
			return new WP_Error( 'b2v_not_connected', __( 'Connect Blog2Video first.', 'blog2video' ) );
		}
		$contents = file_get_contents( $file['tmp_name'] );
		if ( false === $contents ) {
			return new WP_Error( 'b2v_image_read_failed', __( 'Could not read the uploaded image.', 'blog2video' ) );
		}
		$boundary = 'b2v-' . wp_generate_password( 24, false, false );
		$name = sanitize_file_name( isset( $file['name'] ) ? $file['name'] : 'scene-image.jpg' );
		$type = isset( $file['type'] ) ? sanitize_mime_type( $file['type'] ) : 'application/octet-stream';
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
			return new WP_Error( 'b2v_api_error', sanitize_text_field( is_string( $message ) ? $message : wp_json_encode( $message ) ), array( 'status' => $status ) );
		}
		return is_array( $data ) ? $data : array();
	}
}
