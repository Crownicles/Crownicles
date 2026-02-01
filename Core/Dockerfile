ARG NODE_VERSION=24

# Base image to use
FROM node:${NODE_VERSION}-alpine AS builder

# Set PNPM version
ARG PNPM_VERSION=latest-10

# Set the working directory
WORKDIR /crownicles/Core

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./Core/package.json ./Core/pnpm-lock.yaml ./Core/tsconfig.json ./
# Create the config directory
RUN mkdir config

# Install all dependencies (including devDependencies for typescript compilation)
RUN pnpm install

# Copy the lib
RUN mkdir ../Lib
COPY ./Lib/package.json ./Lib/pnpm-lock.yaml ../Lib/
COPY ./Lib/src ../Lib/src

# Copy the source code
COPY ./Core/src ./src
COPY ./Core/resources ./resources

# Install all lib dependencies (including devDependencies for typescript compilation)
WORKDIR /crownicles/Lib
RUN pnpm install
WORKDIR /crownicles/Core

# Compile the source code
RUN pnpm run tsc

FROM node:${NODE_VERSION}-alpine

WORKDIR /crownicles

# Setup PNPM
RUN npm install --global corepack@latest
RUN corepack enable
RUN corepack use pnpm@"${PNPM_VERSION}"

# Copy files in the workdir
COPY ./Core/package.json ./Core/pnpm-lock.yaml ./Core/tsconfig.json ./
# Create the directories
RUN mkdir config resources

# Install the dependencies
RUN pnpm install --prod

# Copy the built app from the builder
COPY --from=builder /crownicles/Core/dist ./dist
COPY --from=builder /crownicles/Core/resources ./resources

# Setup permissions
RUN mkdir -p /.cache/node/corepack
RUN chmod -R 777 /.cache/node/corepack
RUN chmod o+rx /root

# Command used to start the app
CMD [ "pnpm", "dockerStart" ]