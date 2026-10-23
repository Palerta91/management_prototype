FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-fund --no-audit
COPY --chown=node:node server/ ./server/
COPY --chown=node:node dist/ ./dist/
USER node
EXPOSE 8080
CMD ["node", "server/index.mjs"]
