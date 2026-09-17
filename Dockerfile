FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends tini libatomic1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY bin ./bin
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
ENV MIRALL_RELAY_STORAGE=/data MIRALL_RELAY_PORT=49737
EXPOSE 49737/udp
ENTRYPOINT ["/usr/bin/tini","--","node","bin/mirall-relay-lite.js"]
