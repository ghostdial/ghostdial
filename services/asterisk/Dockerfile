FROM debian:bookworm-slim
WORKDIR /opt
RUN apt-get update
RUN apt-get install -y git gettext build-essential autoconf binutils automake bash sudo findutils less curl sngrep ngrep tcpdump libcap-dev libedit-dev libxml2-dev libsqlite3-dev libedit-dev libjansson-dev libssl-dev libxml2-dev patch uuid-dev iproute2
RUN git clone https://github.com/asterisk/asterisk
WORKDIR /opt/asterisk
RUN git checkout 20.5.0
RUN ./configure --without-dahdi --without-pri --without-gtk2 --without-radius --without-x11 --without-speex
RUN make menuselect.makeopts
RUN menuselect/menuselect \
    --disable-category MENUSELECT_ADDONS \
    --disable-category MENUSELECT_APPS \
        --enable app_authenticate --enable app_cdr --enable app_celgenuserevent \
        --enable app_channelredirect --enable app_chanisavail --enable app_chanspy \
       --enable app_amd --enable app_mixmonitor \
       --enable chan_sip --enable res_srtp
RUN make install
COPY ./templates /templates
COPY ./config /config
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
COPY ./extensions.lua /config/extensions.lua
WORKDIR /
CMD ["bash", "/docker-entrypoint.sh"]
