-- Section for example.com

VirtualHost "stomp.dynv6.net"
	enabled = true -- Remove this line to enable this host
	-- Assign this host a certificate for TLS, otherwise it would use the one
	-- set in the global section (if any).
	-- Note that old-style SSL on port 5223 only supports one certificate, and will always
	-- use the global one.
	ssl = {
		key = "/etc/prosody/certs/server.key";
		certificate = "/etc/prosody/certs/server.crt";
	}
	disco_items = { { "upload.stomp.dynv6.net" } }


--Component "sms.stomp.dynv6.net" "sms"

Component "upload.stomp.dynv6.net" "http_file_share"
