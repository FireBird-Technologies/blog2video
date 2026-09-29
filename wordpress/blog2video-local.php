<?php
/** Local-development networking exceptions for the Blog2Video WordPress plugin. */

add_filter(
	'http_request_host_is_external',
	static function ( $allowed, $host ) {
		return in_array( $host, array( '127.0.0.1', 'localhost' ), true ) ? true : $allowed;
	},
	10,
	2
);

add_filter(
	'http_allowed_safe_ports',
	static function ( $ports ) {
		$ports[] = 8000;
		return array_values( array_unique( $ports ) );
	}
);
