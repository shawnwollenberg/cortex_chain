FROM node:22-alpine AS build

WORKDIR /app/api

COPY api/package*.json ./
RUN npm ci

COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app/api

COPY --from=build /app/api/package*.json ./
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist
COPY indexer/migrations /app/indexer/migrations

EXPOSE 3000
CMD ["node", "dist/src/index.js"]
