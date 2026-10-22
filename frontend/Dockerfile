# Phoenix frontend: build with node, serve static with nginx.
#
# API base URL is baked at build time from VITE_API_BASE_URL.
# For docker compose the default below matches the backend
# service exposed on the host.

FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY . .
ARG VITE_API_BASE_URL=http://127.0.0.1:1992
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:stable-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
