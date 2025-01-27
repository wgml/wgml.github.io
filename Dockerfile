FROM jekyll/jekyll:3.1.6 AS builder

WORKDIR /build

COPY . src

ENV JEKYLL_ENV=production
RUN jekyll build --destination output --source src

FROM nginx:stable-alpine
COPY --from=builder /build/output /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
