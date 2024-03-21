[general]
externip=$EXTERN_IP
localnet=$IPV4_ADDRESS/255.255.255.0
tlsdontverifyserver=yes
register => $VOIPMS_SIP_PROTOCOL://$VOIPMS_SIP_USERNAME:$VOIPMS_SIP_PASSWORD@$VOIPMS_SIP_HOST:$VOIPMS_SIP_PORT
transport=tls
tcpenable=yes
bind=0.0.0.0
bindport=35060
tlsbindaddr=0.0.0.0:35061
tlsenable=yes
tlscertfile=/etc/asterisk/keys/fullchain.cer
tlscafile=/etc/asterisk/keys/ca.cer
tlsprivatekey=/etc/asterisk/keys/server.key
srvlookup=no
qualify=no
disallow=all
allow=t140
textsupport=yes

[friends_internal](!)
type=friend
transport=udp,tcp,tls
encryption=yes
canreinvite=yes
host=dynamic
allow=ulaw

[$VOIPMS_SIP_USERNAME]
type=friend
canreinvite=no
defaultuser=$VOIPMS_SIP_USERNAME
secret=$VOIPMS_SIP_PASSWORD
context=inbound
host=$VOIPMS_SIP_HOST
transport=$VOIPMS_SIP_PROTOCOL
port=$VOIPMS_SIP_PORT
disallow=all
allow=ulaw
fromuser=$VOIPMS_SIP_USERNAME
trustrpid=yes
sendrpid=yes
insecure=invite
encryption=yes