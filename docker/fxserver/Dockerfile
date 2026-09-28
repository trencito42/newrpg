FROM debian:bookworm-slim

ARG FXSERVER_URL
ARG CFX_SERVER_DATA_COMMIT
ARG OXMYSQL_VERSION
ARG BOB74_IPL_COMMIT

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git libatomic1 xz-utils unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt
RUN test -n "$FXSERVER_URL" \
    && curl -fL --retry 4 "$FXSERVER_URL" -o /tmp/fx.tar.xz \
    && mkdir -p /opt/fxserver \
    && tar -xJf /tmp/fx.tar.xz -C /opt/fxserver \
    && rm /tmp/fx.tar.xz

RUN test -n "$CFX_SERVER_DATA_COMMIT" \
    && git clone --filter=blob:none https://github.com/citizenfx/cfx-server-data.git /opt/cfx-server-data \
    && git -C /opt/cfx-server-data checkout "$CFX_SERVER_DATA_COMMIT" \
    && rm -rf /opt/cfx-server-data/.git

RUN test -n "$OXMYSQL_VERSION" \
    && curl -fL --retry 4 "https://github.com/overextended/oxmysql/releases/download/${OXMYSQL_VERSION}/oxmysql.zip" -o /tmp/oxmysql.zip \
    && mkdir -p /tmp/oxmysql-release '/opt/cfx-server-data/resources/[vendor]' \
    && unzip -q /tmp/oxmysql.zip -d /tmp/oxmysql-release \
    && test -f /tmp/oxmysql-release/oxmysql/fxmanifest.lua \
    && mv /tmp/oxmysql-release/oxmysql '/opt/cfx-server-data/resources/[vendor]/oxmysql' \
    && rm -rf /tmp/oxmysql-release /tmp/oxmysql.zip

RUN test -n "$BOB74_IPL_COMMIT" \
    && git clone --filter=blob:none https://github.com/Bob74/bob74_ipl.git '/opt/cfx-server-data/resources/[vendor]/bob74_ipl' \
    && git -C '/opt/cfx-server-data/resources/[vendor]/bob74_ipl' checkout "$BOB74_IPL_COMMIT" \
    && rm -rf '/opt/cfx-server-data/resources/[vendor]/bob74_ipl/.git'

COPY docker/fxserver/entrypoint.sh /usr/local/bin/rpg-entrypoint
RUN chmod 0755 /usr/local/bin/rpg-entrypoint

WORKDIR /opt/cfx-server-data
ENTRYPOINT ["/usr/local/bin/rpg-entrypoint"]
