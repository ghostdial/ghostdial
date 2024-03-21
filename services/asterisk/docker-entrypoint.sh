#!/bin/bash

# optional Docker environment variables
ASTERISK_UID="${ASTERISK_UID:-}"
ASTERISK_GID="${ASTERISK_GID:-}"

# run as user asterisk by default
ASTERISK_USER="${ASTERISK_USER:-asterisk}"
ASTERISK_GROUP="${ASTERISK_GROUP:-${ASTERISK_USER}}"

if [ "$1" = "" ]; then
  COMMAND="/usr/sbin/asterisk -T -W -U ${ASTERISK_USER} -p -vvvdddf"
else
  COMMAND="$@"
fi

function write_sip_conf() {
  IPV4_ADDRESS=$(ip -4 addr show eth0 | grep --color=never -oP '(?<=inet\s)\d+(\.\d+){3}')
  cat /templates/sip.conf.tpl | envsubst > /etc/asterisk/sip.conf
}
function echo_env() {
  echo "EXTERN_IP: $EXTERN_IP"
  echo "VOIPMS_SMS_PROTOCOL: $VOIPMS_SMS_PROTOCOL"
  echo "VOIPMS_SIP_USERNAME: $VOIPMS_SIP_USERNAME"
  local rewrite=$(echo ${VOIPMS_SIP_PASSWORD} | sed -e 's/./x/g)')
  echo "VOIPMS_SIP_PASSWORD: $(echo ${VOIPMS_SIP_PASSWORD} | sed -e 's/./x/g)')"
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

function include_conf() {
  cd /config
  for file in /config/*.conf; do
    if [[ ! -f "/etc/asterisk/$file" ]]; then
      cp -v "/config/$file" "/etc/asterisk/$file"
    fi
  done
}

if [[ "${ASTERISK_UID}" != "" && "${ASTERISK_GID}" != "" ]]; then
  # recreate user and group for asterisk
  # if they've sent as env variables (i.e. to macth with host user to fix permissions for mounted folders
  deluser asterisk && \
  addgroup -g "${ASTERISK_GID}" "${ASTERISK_GROUP}" && \
  adduser -D -H -u "${ASTERISK_UID}" -G "${ASTERISK_GROUP}" "${ASTERISK_USER}"
fi

chown -R "${ASTERISK_USER}": /var/log/asterisk \
                           /var/lib/asterisk \
                           /var/run/asterisk \
                           /var/spool/asterisk ; \

init_asterisk

exec ${COMMAND}
