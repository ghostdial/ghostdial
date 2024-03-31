FROM debian:10
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        lsb-base \
        gettext \
        sudo \
        procps \
        adduser \
        libidn11 \
        libicu63 \
        libssl1.1 \
        lua-bitop \
        lua-dbi-mysql \
        lua-dbi-postgresql \
        lua-dbi-sqlite3 \
        lua-event \
        lua-expat \
        lua-filesystem \
        lua-sec \
        lua-socket \
        lua-zlib \
        lua5.1 \
        lua5.2 \
        openssl \
        ca-certificates \
        ssl-cert \
        prosody \
    && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/run/prosody && chown prosody:prosody /var/run/prosody
COPY ./modules/mod_sms.lua /usr/lib/prosody/modules/mod_sms.lua
COPY ./templates /templates
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod 755 /docker-entrypoint.sh
EXPOSE 80 443 5222 5269 5347 5280 5281
ENV __FLUSH_LOG yes
CMD ["bash", "/docker-entrypoint.sh"]
