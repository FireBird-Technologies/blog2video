<?php

defined( 'ABSPATH' ) || exit;

class B2V_Post_Extractor {
	private static function post_identity( $post_id ) {
		$post = get_post( $post_id );
		if ( ! $post || 'revision' === $post->post_type ) {
			return new WP_Error( 'b2v_invalid_post', __( 'The post could not be read.', 'blog2video' ) );
		}
		$url = get_permalink( $post );
		if ( ! $url ) {
			$url = home_url( '/?p=' . absint( $post_id ) );
		}
		return array(
			'post'              => $post,
			'external_post_id'  => (string) $post_id,
			'title'             => wp_strip_all_tags( get_the_title( $post ) ),
			'canonical_url'     => esc_url_raw( $url ),
		);
	}

	public static function snapshot( $post_id ) {
		$identity = self::post_identity( $post_id );
		if ( is_wp_error( $identity ) ) { return $identity; }
		$post = $identity['post'];
		$content = apply_filters( 'the_content', $post->post_content );
		$content = preg_replace( '#<(script|style|iframe|form|noscript)[^>]*>.*?</\\1>#is', ' ', $content );
		$content = preg_replace( '/<!--.*?-->/s', ' ', $content );
		$content = wp_strip_all_tags( $content, true );
		$content = html_entity_decode( $content, ENT_QUOTES | ENT_HTML5, get_bloginfo( 'charset' ) ?: 'UTF-8' );
		$content = preg_replace( '/[ \t]+/', ' ', $content );
		$content = preg_replace( '/\n\s*\n+/', "\n\n", $content );
		$content = trim( $content );
		if ( strlen( $content ) < 50 ) {
			return new WP_Error( 'b2v_short_post', __( 'This post does not contain enough text to make a video.', 'blog2video' ) );
		}
		return array(
			'external_post_id' => $identity['external_post_id'],
			'title'            => $identity['title'],
			'canonical_url'    => $identity['canonical_url'],
			'content'          => $content,
			'content_hash'     => hash( 'sha256', $post->post_modified_gmt . '|' . $post->post_title . '|' . $content ),
		);
	}

	public static function url_snapshot( $post_id, $source_url ) {
		$identity = self::post_identity( $post_id );
		if ( is_wp_error( $identity ) ) { return $identity; }
		if ( ! $source_url || ! wp_http_validate_url( $source_url ) ) {
			return new WP_Error( 'b2v_invalid_source_url', __( 'Enter a valid public HTTP or HTTPS URL.', 'blog2video' ) );
		}
		return array(
			'external_post_id' => $identity['external_post_id'],
			'title'            => $identity['title'],
			'canonical_url'    => $identity['canonical_url'],
			'content_hash'     => hash( 'sha256', 'url|' . $source_url ),
		);
	}
}
