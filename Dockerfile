FROM node:22-alpine AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY public/data/floorplan.yaml ./public/data/floorplan.yaml
COPY . .
RUN test -f public/data/floorplan.yaml
RUN pnpm build

FROM nginx:1.29-alpine

ENV CORS_MODE=restricted

COPY nginx.conf /etc/nginx/templates/default.restricted.conf
COPY nginx.open.conf /etc/nginx/templates/default.open.conf
COPY docker/10-select-cors-config.sh /docker-entrypoint.d/10-select-cors-config.sh
RUN chmod +x /docker-entrypoint.d/10-select-cors-config.sh

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]