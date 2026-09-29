<?php

defined( 'ABSPATH' ) || exit;

class Blog2Video_Block {
	public function __construct() {
		add_action( 'init', array( $this, 'register' ) );
		add_shortcode( 'blog2video', array( $this, 'shortcode' ) );
	}

	public function register() {
		$editor_modified = filemtime( BLOG2VIDEO_DIR . 'assets/editor.js' );
		wp_register_script( 'blog2video-editor-block', BLOG2VIDEO_URL . 'assets/editor.js', array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor' ), $editor_modified ? (string) $editor_modified : BLOG2VIDEO_VERSION, true );
		wp_register_style( 'blog2video-player', BLOG2VIDEO_URL . 'assets/style.css', array(), BLOG2VIDEO_VERSION );
		register_block_type( BLOG2VIDEO_DIR . 'block', array( 'render_callback' => array( $this, 'render' ) ) );
	}

	public function player( $url, $ratio = '16:9' ) {
		$url = esc_url( $url );
		if ( ! $url ) { return ''; }
		$class = '9:16' === $ratio ? ' is-portrait' : '';
		wp_enqueue_style( 'blog2video-player' );
		return '<div class="b2v-player' . esc_attr( $class ) . '"><iframe src="' . $url . '" title="' . esc_attr__( 'Blog2Video player', 'blog2video' ) . '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>';
	}

	public function render( $attributes ) {
		$url = ! empty( $attributes['embedUrl'] ) ? $attributes['embedUrl'] : get_post_meta( get_the_ID(), '_blog2video_embed_url', true );
		return $this->player( $url, $attributes['aspectRatio'] ?? '16:9' );
	}

	public function shortcode( $attributes ) {
		$attributes = shortcode_atts( array( 'url' => '', 'aspect' => '16:9' ), $attributes, 'blog2video' );
		$url = $attributes['url'] ?: get_post_meta( get_the_ID(), '_blog2video_embed_url', true );
		return $this->player( $url, $attributes['aspect'] );
	}

}
