FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM caddy:2.8.4-alpine
COPY Caddyfile.static /etc/caddy/Caddyfile
COPY --from=build /src/dist /srv
EXPOSE 8080
