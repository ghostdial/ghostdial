#!/bin/bash

IPV4_ADDRESS=$(ip -4 addr show eth0 | grep --color=never -oP '(?<=inet\s)\d+(\.\d+){3}')
if [[ ! -f /etc/asterisk/sip.conf ]]; then
  cat /templates/sip.conf.tpl | envsubst > /etc/asterisk/sip.conf
fi
asterisk
