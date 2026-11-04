FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG SITE_URL
ENV SITE_URL=$SITE_URL
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
