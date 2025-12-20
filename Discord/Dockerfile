ARG NODE_VERSION=24

# Base image to use
FROM node:${NODE_VERSION}-alpine AS builder

# Set PNPM version
ARG PNPM_VERSION=latest-10

# Set the working directory
WORKDIR /crownicles/Discord

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./Discord/package.json ./Discord/pnpm-lock.yaml ./Discord/tsconfig.json ./
# Create the config directory
RUN mkdir config

# Install all dependencies (including devDependencies for typescript compilation)
RUN pnpm install

# Copy the lib
RUN mkdir ../Lib
COPY ./Lib/package.json ./Lib/pnpm-lock.yaml ../Lib/
COPY ./Lib/src ../Lib/src

# Copy the translations
COPY ./Lang ../Lang

# Copy the source code
COPY ./Discord/src ./src

# Install all lib dependencies (including devDependencies for typescript compilation)
WORKDIR /crownicles/Lib
RUN pnpm install
WORKDIR /crownicles/Discord

# Compile the source code
RUN pnpm interface
RUN pnpm run tsc

FROM node:${NODE_VERSION}-alpine

WORKDIR /crownicles

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./Discord/package.json ./Discord/pnpm-lock.yaml ./Discord/tsconfig.json ./
# Create the directories
RUN mkdir config

# Install the dependencies
RUN pnpm install --prod

# Copy the built app from the builder
COPY --from=builder /crownicles/Discord/dist ./dist

# Setup permissions
RUN mkdir -p /.cache/node/corepack
RUN chmod -R 777 /.cache/node/corepack
RUN chmod o+rx /root

# Command used to start the app
CMD [ "pnpm", "dockerStart" ]