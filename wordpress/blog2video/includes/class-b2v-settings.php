<?php

defined( 'ABSPATH' ) || exit;

class B2V_Settings {
	private $api;

	public function __construct( B2V_API_Client $api ) {
		$this->api = $api;
		add_action( 'admin_menu', array( $this, 'menu' ) );
		add_action( 'admin_init', array( $this, 'register' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'assets' ) );
		add_action( 'admin_post_b2v_begin_connection', array( $this, 'begin' ) );
		add_action( 'admin_post_b2v_finish_connection', array( $this, 'finish' ) );
		add_action( 'admin_post_b2v_disconnect', array( $this, 'disconnect' ) );
		add_action( 'wp_ajax_b2v_connection_status', array( $this, 'connection_status' ) );
	}

	public function menu() {
		add_options_page( 'Blog2Video', 'Blog2Video', 'manage_options', 'blog2video', array( $this, 'page' ) );
	}

	public function register() {
		// Embedding is intentionally explicit: the editor inserts or replaces one
		// Blog2Video block only after the user confirms the action.
	}

	public function assets( $hook ) {
		if ( 'settings_page_blog2video' === $hook ) {
			$asset_version = static function ( $file ) {
				$modified = filemtime( B2V_DIR . 'assets/' . $file );
				return $modified ? (string) $modified : B2V_VERSION;
			};
			wp_enqueue_style( 'b2v-settings', B2V_URL . 'assets/settings.css', array(), $asset_version( 'settings.css' ) );
			wp_enqueue_style( 'b2v-react-ui', B2V_URL . 'assets/react-ui.css', array( 'b2v-settings' ), $asset_version( 'react-ui.css' ) );
			wp_enqueue_script( 'b2v-settings', B2V_URL . 'assets/settings.js', array(), $asset_version( 'settings.js' ), true );
			wp_enqueue_script( 'b2v-react-settings', B2V_URL . 'assets/react-settings.js', array( 'b2v-settings', 'wp-element' ), $asset_version( 'react-settings.js' ), true );
			$pending = get_option( 'b2v_pending_connection', array() );
			wp_localize_script( 'b2v-settings', 'B2VSettings', array(
				'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
				'nonce'           => wp_create_nonce( 'b2v_poll_connection' ),
				'connected'       => $this->api->is_connected(),
				'pending'         => ! empty( $pending['verification_url'] ),
				'approvalUrl'     => esc_url_raw( $pending['verification_url'] ?? '' ),
				'beginUrl'        => wp_nonce_url( admin_url( 'admin-post.php?action=b2v_begin_connection' ), 'b2v_begin_connection' ),
				'adminPostUrl'    => admin_url( 'admin-post.php' ),
				'createPostUrl'   => admin_url( 'post-new.php' ),
				'beginNonce'      => wp_create_nonce( 'b2v_begin_connection' ),
				'disconnectNonce' => wp_create_nonce( 'b2v_disconnect' ),
				'notice'          => isset( $_GET['b2v_notice'] ) ? sanitize_text_field( wp_unslash( $_GET['b2v_notice'] ) ) : '', // phpcs:ignore WordPress.Security.NonceVerification.Recommended
				'logoUrl'         => B2V_URL . 'assets/b2v-logo.png',
			) );
		}
	}

	private function redirect( $notice ) {
		wp_safe_redirect( add_query_arg( 'b2v_notice', $notice, admin_url( 'options-general.php?page=blog2video' ) ) );
		exit;
	}

	public function begin() {
		check_admin_referer( 'b2v_begin_connection' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to connect this site.', 'blog2video' ) );
		}
		$result = $this->api->request( 'POST', 'connections/begin', array( 'site_url' => home_url(), 'site_name' => get_bloginfo( 'name' ) ), false );
		if ( is_wp_error( $result ) ) {
			$this->redirect( $result->get_error_message() );
		}
		update_option( 'b2v_pending_connection', $result, false );
		wp_safe_redirect( admin_url( 'options-general.php?page=blog2video' ) );
		exit;
	}

	public function finish() {
		check_admin_referer( 'b2v_finish_connection' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to connect this site.', 'blog2video' ) );
		}
		$pending = get_option( 'b2v_pending_connection', array() );
		$result  = $this->api->request( 'POST', 'connections/token', array( 'connection_id' => absint( $pending['connection_id'] ?? 0 ), 'device_code' => (string) ( $pending['device_code'] ?? '' ) ), false );
		if ( is_wp_error( $result ) ) {
			$this->redirect( $result->get_error_message() );
		}
		if ( 'authorization_pending' === ( $result['status'] ?? '' ) ) {
			$this->redirect( __( 'Approve the code in Blog2Video first, then try again.', 'blog2video' ) );
		}
		update_option( B2V_API_Client::CONNECTION_OPTION, array( 'access_token' => sanitize_text_field( $result['access_token'] ), 'connection_id' => absint( $result['connection_id'] ) ), false );
		delete_option( 'b2v_pending_connection' );
		$this->redirect( __( 'Blog2Video connected successfully.', 'blog2video' ) );
	}

	public function connection_status() {
		check_ajax_referer( 'b2v_poll_connection', 'nonce' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_send_json_error( array( 'message' => __( 'You are not allowed to connect this site.', 'blog2video' ) ), 403 );
		}
		$pending = get_option( 'b2v_pending_connection', array() );
		if ( empty( $pending['connection_id'] ) || empty( $pending['device_code'] ) ) {
			wp_send_json_error( array( 'message' => __( 'The connection request is no longer available. Start again.', 'blog2video' ) ), 410 );
		}
		$result = $this->api->request( 'POST', 'connections/token', array(
			'connection_id' => absint( $pending['connection_id'] ),
			'device_code'   => (string) $pending['device_code'],
		), false );
		if ( is_wp_error( $result ) ) {
			wp_send_json_error( array( 'message' => $result->get_error_message() ), 502 );
		}
		if ( 'authorization_pending' === ( $result['status'] ?? '' ) ) {
			wp_send_json_success( array( 'status' => 'pending' ) );
		}
		if ( empty( $result['access_token'] ) || empty( $result['connection_id'] ) ) {
			wp_send_json_error( array( 'message' => __( 'Blog2Video returned an invalid connection response.', 'blog2video' ) ), 502 );
		}
		update_option( B2V_API_Client::CONNECTION_OPTION, array(
			'access_token'  => sanitize_text_field( $result['access_token'] ),
			'connection_id' => absint( $result['connection_id'] ),
		), false );
		delete_option( 'b2v_pending_connection' );
		wp_send_json_success( array(
			'status'   => 'connected',
			'redirect' => add_query_arg( 'b2v_notice', __( 'Blog2Video connected successfully.', 'blog2video' ), admin_url( 'options-general.php?page=blog2video' ) ),
		) );
	}

	public function disconnect() {
		check_admin_referer( 'b2v_disconnect' );
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You are not allowed to disconnect this site.', 'blog2video' ) );
		}
		$this->api->request( 'POST', 'connections/revoke' );
		delete_option( B2V_API_Client::CONNECTION_OPTION );
		delete_option( 'b2v_pending_connection' );
		$this->redirect( __( 'Blog2Video disconnected.', 'blog2video' ) );
	}

	public function page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="wrap"><div id="b2v-settings-react-root"><p>' . esc_html__( 'Loading Blog2Video…', 'blog2video' ) . '</p></div></div>';
		return;
		$pending = get_option( 'b2v_pending_connection', array() );
		$connected = $this->api->is_connected();
		?>
		<div class="wrap b2v-settings-page">
			<header class="b2v-settings-hero">
				<div class="b2v-settings-brand">
					<img src="<?php echo esc_url( B2V_URL . 'assets/b2v-logo.png' ); ?>" alt="">
					<div><h1><?php esc_html_e( 'Blog2Video', 'blog2video' ); ?></h1><p><?php esc_html_e( 'Create, edit and publish narrated videos without leaving WordPress.', 'blog2video' ); ?></p></div>
				</div>
				<span class="b2v-connection-state <?php echo $connected ? 'is-connected' : ''; ?>"><i></i><?php echo $connected ? esc_html__( 'Connected', 'blog2video' ) : esc_html__( 'Not connected', 'blog2video' ); ?></span>
			</header>
		<?php if ( isset( $_GET['b2v_notice'] ) ) : // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?>
			<div class="notice notice-info is-dismissible"><p><?php echo esc_html( sanitize_text_field( wp_unslash( $_GET['b2v_notice'] ) ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended ?></p></div>
		<?php endif; ?>

			<div class="b2v-settings-layout">
				<section class="b2v-connect-panel">
				<?php if ( $connected ) : ?>
					<div class="b2v-connect-icon is-success">✓</div>
					<div class="b2v-connect-copy"><span class="b2v-settings-kicker"><?php esc_html_e( 'Account connection', 'blog2video' ); ?></span><h2><?php esc_html_e( 'Your site is ready', 'blog2video' ); ?></h2><p><?php esc_html_e( 'Editors can now create videos from any WordPress post and manage them directly in the block editor.', 'blog2video' ); ?></p></div>
					<div class="b2v-connect-actions"><a class="button button-primary" href="<?php echo esc_url( admin_url( 'post-new.php' ) ); ?>"><?php esc_html_e( 'Create a post', 'blog2video' ); ?></a><form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"><input type="hidden" name="action" value="b2v_disconnect"><?php wp_nonce_field( 'b2v_disconnect' ); ?><button type="submit" class="button b2v-button-quiet b2v-disconnect-button"><?php esc_html_e( 'Disconnect account', 'blog2video' ); ?></button></form></div>
				<?php elseif ( ! empty( $pending['verification_url'] ) ) : ?>
					<div class="b2v-connect-icon">↗</div>
					<div class="b2v-connect-copy"><span class="b2v-settings-kicker"><?php esc_html_e( 'One final step', 'blog2video' ); ?></span><h2><?php esc_html_e( 'Approve this site in Blog2Video', 'blog2video' ); ?></h2><p><?php esc_html_e( 'We will open a secure Blog2Video page with this site’s temporary request already filled in. Sign in and approve it.', 'blog2video' ); ?></p></div>
					<div class="b2v-connect-actions"><a class="button button-primary" target="_blank" rel="noopener noreferrer" href="<?php echo esc_url( $pending['verification_url'] ); ?>"><?php esc_html_e( 'Approve', 'blog2video' ); ?><span aria-hidden="true">↗</span></a></div>
					<p class="b2v-approval-status" id="b2v-approval-status"><i aria-hidden="true"></i><span><?php esc_html_e( 'Waiting for approval…', 'blog2video' ); ?></span></p>
				<?php else : ?>
					<div class="b2v-connect-icon">B2V</div>
					<div class="b2v-connect-copy"><span class="b2v-settings-kicker"><?php esc_html_e( 'Get started', 'blog2video' ); ?></span><h2><?php esc_html_e( 'Connect your Blog2Video account', 'blog2video' ); ?></h2><p><?php esc_html_e( 'Authorize this site once, then create, edit, render and embed videos from the WordPress post editor.', 'blog2video' ); ?></p></div>
					<ul class="b2v-connect-benefits"><li><?php esc_html_e( 'No password stored in WordPress', 'blog2video' ); ?></li><li><?php esc_html_e( 'Revocable access limited to this site', 'blog2video' ); ?></li><li><?php esc_html_e( 'Your existing projects stay available', 'blog2video' ); ?></li></ul>
					<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>"><input type="hidden" name="action" value="b2v_begin_connection"><?php wp_nonce_field( 'b2v_begin_connection' ); ?><button type="submit" class="button button-primary"><?php esc_html_e( 'Connect Blog2Video', 'blog2video' ); ?><span aria-hidden="true">→</span></button></form>
				<?php endif; ?>
				</section>

			</div>
		</div>
		<?php
	}
}
