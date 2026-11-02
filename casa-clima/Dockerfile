FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production CASA_CLIMA_DATA=/data PORT=8124
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY web ./web
COPY config ./config
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8124
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://127.0.0.1:8124/api/auth/status >/dev/null || exit 1
CMD ["node", "src/index.js"]
