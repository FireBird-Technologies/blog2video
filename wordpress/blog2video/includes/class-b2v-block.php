<?php

defined( 'ABSPATH' ) || exit;

class B2V_Block {
	public function __construct() {
		add_action( 'init', array( $this, 'register' ) );
		add_shortcode( 'blog2video', array( $this, 'shortcode' ) );
	}

	public function register() {
		$editor_modified = filemtime( B2V_DIR . 'assets/editor.js' );
		wp_register_script( 'b2v-editor-block', B2V_URL . 'assets/editor.js', array( 'wp-blocks', 'wp-element', 'wp-components', 'wp-block-editor' ), $editor_modified ? (string) $editor_modified : B2V_VERSION, true );
		wp_register_style( 'b2v-player', B2V_URL . 'assets/style.css', array(), B2V_VERSION );
		register_block_type( B2V_DIR . 'block', array( 'render_callback' => array( $this, 'render' ) ) );
	}

	public function player( $url, $ratio = '16:9' ) {
		$url = esc_url( $url );
		if ( ! $url ) { return ''; }
		$class = '9:16' === $ratio ? ' is-portrait' : '';
		wp_enqueue_style( 'b2v-player' );
		return '<div class="b2v-player' . esc_attr( $class ) . '"><iframe src="' . $url . '" title="' . esc_attr__( 'Blog2Video player', 'blog2video' ) . '" loading="lazy" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe></div>';
	}

	public function render( $attributes ) {
		$url = ! empty( $attributes['embedUrl'] ) ? $attributes['embedUrl'] : get_post_meta( get_the_ID(), '_b2v_embed_url', true );
		return $this->player( $url, $attributes['aspectRatio'] ?? '16:9' );
	}

	public function shortcode( $attributes ) {
		$attributes = shortcode_atts( array( 'url' => '', 'aspect' => '16:9' ), $attributes, 'blog2video' );
		$url = $attributes['url'] ?: get_post_meta( get_the_ID(), '_b2v_embed_url', true );
		return $this->player( $url, $attributes['aspect'] );
	}

}
