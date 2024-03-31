#!/bin/bash

# optional Docker environment variables
ASTERISK_UID="${ASTERISK_UID:-}"
ASTERISK_GID="${ASTERISK_GID:-}"

# run as user asterisk by default
ASTERISK_USER="${ASTERISK_USER:-asterisk}"
ASTERISK_GROUP="${ASTERISK_GROUP:-${ASTERISK_USER}}"

if [ "$1" = "" ]; then
  COMMAND="/usr/sbin/asterisk -T -U "$ASTERISK_USER" -W -p -vvvdddf"
else
  COMMAND="$@"
fi

function write_sip_conf() {
  export IPV4_ADDRESS=$(ip -4 addr show eth0 | grep --color=never -oP '(?<=inet\s)\d+(\.\d+){3}')
  cat /templates/sip.conf.tpl | envsubst > /etc/asterisk/sip.conf
}

function add_certs_group() {
  groupadd -g ${CERTS_GID} letsencrypt -f 2> /dev/null
  adduser asterisk letsencrypt 2> /dev/null
  chown -R 0:${CERTS_GID} /etc/letsencrypt/*
  chmod -R 770 /etc/letsencrypt/*
}

export REDIS_HOST=$(echo $REDIS_URI | cut -d '/' -f 3)
function echo_env() {
  echo "REDIS_HOST: $REDIS_HOST"
  echo "EXTERN_IP: $EXTERN_IP"
  echo "VOIPMS_SIP_PROTOCOL: $VOIPMS_SIP_PROTOCOL"
  echo "VOIPMS_SIP_USERNAME: $VOIPMS_SIP_USERNAME"
  local rewrite=$(echo ${VOIPMS_SIP_PASSWORD} | sed -e 's/./x/g')
  echo "VOIPMS_SIP_PASSWORD: $rewrite"
  echo "VOIPMS_SIP_HOST: $VOIPMS_SIP_HOST"
  echo "VOIPMS_SIP_PORT: $VOIPMS_SIP_PORT"
  echo "TWILIO_ACCOUNT_SID: $TWILIO_ACCOUNT_SID"
  echo "TWILIO_AUTH_TOKEN: $TWILIO_AUTH_TOKEN"
}

function init_asterisk() {
  echo_env
  echo "INITIALIZING GHOSTDIAL/ASTERISK..."
  if [[ ! -f /etc/asterisk/sip.conf ]]; then
    write_sip_conf
  fi
  include_conf
  if [[ ! -f /etc/asterisk/extensions.lua ]]; then
    cp /config/extensions.lua /etc/asterisk/extensions.lua
  fi
}

function create_user() {
  adduser --gecos "" --disabled-login --disabled-password --uid "${ASTERISK_UID}" "${ASTERISK_USER}"
  adduser asterisk asterisk
}

function include_conf() {
  cd /config
  for file in *.conf; do
    if [[ ! -f "/etc/asterisk/$file" ]]; then
      cp -v "/config/$file" "/etc/asterisk/$file"
    fi
  done
}

echo "ASTERISK_UID: $ASTERISK_UID"
echo "ASTERISK_GID: $ASTERISK_GID"

CURRENT_ASTERISK_ID=$(id -u asterisk)
echo "CURRENT_ASTERISK_ID: $CURRENT_ASTERISK_ID"
if [[ ! -z "$CURRENT_ASTERISK_ID"  && $CURRENT_ASTERISK_ID != $ASTERISK_UID ]]; then
  deluser asterisk
  create_user
fi

if [[ -z "$CURRENT_ASTERISK_ID" ]]; then
  create_user
fi


chown -R $ASTERISK_USER /var/log/asterisk \
                           /var/lib/asterisk \
                           /var/run/asterisk \
                           /var/spool/asterisk ; \

add_certs_group
init_asterisk

exec ${COMMAND}
