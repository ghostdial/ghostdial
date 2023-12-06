FROM node:lts
RUN apt-get update -y
RUN apt-get install -y \
    build-essential \
    curl \
    git \
    supervisor \
    redis
RUN apt-get update -y
WORKDIR /opt
RUN git clone https://github.com/asterisk/asterisk
RUN git checkout 20.5.0
RUN ./configure
RUN make
RUN make install
RUN mkdir /config
RUN mkdir /etc/asterisk
RUN apt-get install prosody prosody-modules
RUN npm install -g yarn
WORKDIR /app
ADD . .
RUN yarn
COPY supervisord.conf .
CMD ["/usr/bin/supervisord", "-c", "supervisord.conf"]
