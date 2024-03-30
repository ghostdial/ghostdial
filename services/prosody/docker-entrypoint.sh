#!/bin/bash -e
set -e

export REDIS_HOST=$(echo $REDIS_URI | cut -d '/' -f 3)

data_dir_owner="$(stat -c %u "/var/lib/prosody/")"
if [[ "$(id -u prosody)" != "$data_dir_owner" ]]; then
    usermod -u "$data_dir_owner" prosody
fi
if [[ "$(stat -c %u /var/run/prosody/)" != "$data_dir_owner" ]]; then
    chown "$data_dir_owner" /var/run/prosody/
fi

if [[ "$1" != "prosody" ]]; then
    exec prosodyctl "$@"
    exit 0;
fi

if [[ "$LOCAL" && "$PASSWORD" && "$DOMAIN" ]]; then
    prosodyctl register "$LOCAL" "$DOMAIN" "$PASSWORD"
fi


cat /templates/prosody.cfg.lua.tpl | envsubst > /etc/prosody/prosody.cfg.lua
cat /templates/server.cfg.lua.tpl | envsubst > /etc/prosody/conf.avail/${DOMAIN}.cfg.lua
rm -rf /etc/prosody/conf.d/*
ln -s /etc/prosody/conf.avail/${DOMAIN}.cfg.lua /etc/prosody/conf.d/${DOMAIN}.cfg.lua

exec setpriv --reuid=prosody --regid=prosody --init-groups "prosody -F"
