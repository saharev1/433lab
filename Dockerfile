FROM nginx:alpine
COPY . /usr/share/nginx/html
RUN sed -i 's/listen\s*80;/listen 6060;/g' /etc/nginx/conf.d/default.conf
EXPOSE 6060
