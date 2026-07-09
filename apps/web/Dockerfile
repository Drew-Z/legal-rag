# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app
ARG NPM_CONFIG_REGISTRY=https://registry.npmmirror.com
ARG VITE_API_BASE_URL=
ARG VITE_PUBLIC_DEMO_EMAIL=
ARG VITE_PUBLIC_DEMO_PASSWORD=
ARG VITE_PUBLIC_DEMO_NOTE=

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --registry=$NPM_CONFIG_REGISTRY

COPY apps/web apps/web
COPY packages/shared packages/shared
COPY package.json package-lock.json ./

RUN npm run build:shared && npm --workspace apps/web run build

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
