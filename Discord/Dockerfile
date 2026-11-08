ARG NODE_VERSION=24

# Base image to use
FROM node:${NODE_VERSION}-alpine AS builder

# Set PNPM version
ARG PNPM_VERSION=10.34.3

# Set the working directory
WORKDIR /crownicles/Discord

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./Discord/package.json ./Discord/pnpm-lock.yaml ./Discord/tsconfig.json ./
COPY ./Discord/patches ./patches
# Create the config directory
RUN mkdir config

# Install all dependencies (including devDependencies for typescript compilation)
RUN pnpm install --frozen-lockfile

# Copy the lib
RUN mkdir ../Lib
COPY ./Lib/package.json ./Lib/pnpm-lock.yaml ../Lib/
COPY ./Lib/patches ../Lib/patches
COPY ./Lib/src ../Lib/src

# Copy the translations
COPY ./Lang ../Lang

# Copy the source code
COPY ./Discord/src ./src

# Install all lib dependencies (including devDependencies for typescript compilation)
WORKDIR /crownicles/Lib
RUN pnpm install --frozen-lockfile
WORKDIR /crownicles/Discord

# Compile the source code
RUN pnpm interface
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
COPY ./Discord/package.json ./Discord/pnpm-lock.yaml ./Discord/tsconfig.json ./
COPY ./Discord/patches ./patches
# Create the directories
RUN mkdir config

# Install the dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy the built app from the builder
COPY --from=builder /crownicles/Discord/dist ./dist

# Setup permissions
RUN mkdir -p /.cache/node/corepack
RUN chmod -R 777 /.cache/node/corepack
RUN chmod o+rx /root

# Install wget for healthcheck and refresh the system CA bundle (distrusts the compromised eMudhra intermediates)
RUN apk upgrade --no-cache ca-certificates-bundle && apk add --no-cache wget

# Healthcheck (shard 0 on default port)
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:10124/health || exit 1

# Command used to start the app
CMD [ "pnpm", "dockerStart" ]