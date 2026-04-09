FROM nginx:alpine

# Копируем собранный фронтенд
COPY dist /usr/share/nginx/html

# Копируем конфиг nginx (если есть)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80