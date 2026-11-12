FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS build
WORKDIR /repo

COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/site/package.json apps/site/package.json
COPY packages/animated-fluent-emojis/package.json packages/animated-fluent-emojis/package.json
RUN bun install --frozen-lockfile --filter . --filter @animated-fluent-emojis/site --ignore-scripts

COPY packages/animated-fluent-emojis packages/animated-fluent-emojis
COPY apps/site apps/site
COPY docs docs
COPY CHANGELOG.md CHANGELOG.md
ARG LAST_MODIFIED_DATES=""
ENV LAST_MODIFIED_DATES=${LAST_MODIFIED_DATES}
RUN bun run --cwd packages/animated-fluent-emojis build
RUN bun run --cwd apps/site build
RUN bun run --cwd apps/site src/scripts/render-security-headers.ts dist docker/security-headers.conf dist-security-headers.conf

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de
RUN rm -f /etc/nginx/conf.d/default.conf
COPY apps/site/docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /repo/apps/site/dist-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY apps/site/docker/site.conf /etc/nginx/conf.d/site.conf
COPY --from=build /repo/apps/site/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO /dev/null http://127.0.0.1/ || exit 1
