FROM andrius/asterisk
RUN apk add --no-cache bash asterisk-srtp
COPY ./templates /templates
COPY ./config /config
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
COPY ./extensions.lua /config/extensions.lua
WORKDIR /
CMD ["bash", "/docker-entrypoint.sh"]
