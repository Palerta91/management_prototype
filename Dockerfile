FROM nginxinc/nginx-unprivileged:1.27-alpine

COPY --chown=nginx:nginx dist/ /usr/share/nginx/html/
COPY --chown=nginx:nginx deploy/nginx.conf /etc/nginx/conf.d/default.conf
