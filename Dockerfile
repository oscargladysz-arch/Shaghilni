# Shaghilni in one small container. The database lives in /data: mount a volume there.
# Sample listings are never seeded when NODE_ENV=production (server/config.js); seed/ is copied for development runs of the image.
FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 DB_PATH=/data/shaghilni.db
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY public ./public
COPY seed ./seed
COPY scripts ./scripts
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
