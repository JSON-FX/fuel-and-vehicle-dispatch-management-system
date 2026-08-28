FROM node:24.19.0-alpine AS development

ENV COREPACK_HOME=/opt/corepack

RUN apk add --no-cache curl \
  && mkdir -p "$COREPACK_HOME" \
  && corepack enable \
  && corepack prepare pnpm@11.24.0 --activate \
  && chown -R node:node "$COREPACK_HOME"

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

RUN mkdir -p /app/.next \
  && chown -R node:node /app/node_modules /app/.next

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["pnpm", "dev"]
