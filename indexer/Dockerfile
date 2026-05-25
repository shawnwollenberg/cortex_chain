FROM node:22-alpine AS build

WORKDIR /app/indexer

COPY indexer/package*.json ./
RUN npm ci

COPY indexer/tsconfig.json ./
COPY indexer/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/indexer

COPY --from=build /app/indexer/package*.json ./
COPY --from=build /app/indexer/node_modules ./node_modules
COPY --from=build /app/indexer/dist ./dist
COPY indexer/migrations ./migrations

CMD ["node", "dist/src/index.js"]
