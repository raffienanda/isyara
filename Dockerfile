# Build the web app
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime: only the API server, shared data, and the built files
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787 DATA_DIR=/data STATIC_DIR=/app/dist
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/api/sehat || exit 1
CMD ["node", "server/index.js"]
