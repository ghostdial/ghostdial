FROM alpine:latest
WORKDIR /opt
RUN apk add --no-cache git gettext build-base bash sudo findutils less curl sngrep ngrep tcpdump libcap libedit libxml2 jansson sqlite sqlite-libs sqlite-dev libedit-dev util-linux-dev jansson-dev openssl-dev libxml2-dev
RUN apk add --no-cache libedit
RUN git clone https://github.com/asterisk/asterisk
WORKDIR /opt/asterisk
RUN git checkout 20.5.0
RUN ./configure
RUN make
RUN make install
RUN mkdir /etc
COPY ./templates /templates
COPY ./config /etc/asterisk
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
WORKDIR /
CMD ["bash", "/docker-entrypoint.sh"]
