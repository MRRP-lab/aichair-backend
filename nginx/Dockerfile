# builds the React app, then serves it with nginx. nginx also forwards API requests
# (see default.conf.template). built from the repo root, see docker-compose.yml

# stage 1: build frontend/ into static files. only this stage needs node
FROM node:22.16.0-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# stage 2: nginx with just the built files
FROM nginx:1.30.6-alpine
# the nginx image fills in ${SERVER_NAME} in templates/ when it starts
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
