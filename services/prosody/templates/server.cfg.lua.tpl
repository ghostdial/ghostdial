-- Section for example.com


VirtualHost "$DOMAIN"
	enabled = true -- Remove this line to enable this host
	-- Assign this host a certificate for TLS, otherwise it would use the one
	-- set in the global section (if any).
	-- Note that old-style SSL on port 5223 only supports one certificate, and will always
	-- use the global one.
	ssl = {
		key = "$TLS_PRIVATE_KEY";
		certificate = "$TLS_CERTIFICATE";
	}
	disco_items = { { "upload.$DOMAIN" } }

Component "upload.$DOMAIN" "http_file_share"

Component "sms.$DOMAIN" "sms"

