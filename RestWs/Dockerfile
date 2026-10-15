ARG NODE_VERSION=24

# Base image to use
FROM node:${NODE_VERSION}-alpine AS builder

# Set PNPM version
ARG PNPM_VERSION=10.34.3

# Set the working directory
WORKDIR /crownicles/RestWs

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./RestWs/package.json ./RestWs/pnpm-lock.yaml ./RestWs/tsconfig.json ./
# Create the config directory
RUN mkdir config

# Install all dependencies (including devDependencies for typescript compilation)
RUN pnpm install

# Copy the lib
RUN mkdir ../Lib
COPY ./Lib/package.json ./Lib/pnpm-lock.yaml ../Lib/
COPY ./Lib/src ../Lib/src

# Copy the websocket packets, they have no runtime dependency so only the sources are needed
COPY ./WsPackets/src ../WsPackets/src

# Copy the translations, they are compiled into dist/Lang and served to the clients as assets
COPY ./Lang ../Lang

# Copy the source code
COPY ./RestWs/src ./src

# Install all lib dependencies (including devDependencies for typescript compilation)
WORKDIR /crownicles/Lib
RUN pnpm install
WORKDIR /crownicles/RestWs

# Compile the source code
RUN pnpm run tsc

FROM node:${NODE_VERSION}-alpine

# Set PNPM version
ARG PNPM_VERSION=10.34.3

WORKDIR /crownicles

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./RestWs/package.json ./RestWs/pnpm-lock.yaml ./RestWs/tsconfig.json ./
# Create the directories
RUN mkdir config

# Install the dependencies
RUN pnpm install --prod

# Copy the built app from the builder, it also holds the translations in dist/Lang
COPY --from=builder /crownicles/RestWs/dist ./dist

# Setup permissions
RUN mkdir -p /.cache/node/corepack
RUN chmod -R 777 /.cache/node/corepack
RUN chmod o+rx /root

# REST API and WebSocket default ports
EXPOSE 10500 10501

# Healthcheck, probing the sockets keeps the healthcheck out of the request logs
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD nc -z 127.0.0.1 10500 && nc -z 127.0.0.1 10501 || exit 1

# Command used to start the app
CMD [ "pnpm", "dockerStart" ]
