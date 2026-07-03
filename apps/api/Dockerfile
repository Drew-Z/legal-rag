# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --registry=$NPM_CONFIG_REGISTRY

FROM deps AS build
WORKDIR /app

COPY apps/api apps/api
COPY packages/shared packages/shared

RUN npm run build:shared && npm --workspace apps/api run build

FROM deps AS prod-deps
WORKDIR /app
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY --from=prod-deps /app/node_modules node_modules

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/packages/shared packages/shared
COPY datasets datasets
COPY eval eval

EXPOSE 4000
CMD ["npm", "--workspace", "apps/api", "run", "start"]
