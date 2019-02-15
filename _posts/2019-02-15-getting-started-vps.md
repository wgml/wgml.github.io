---
header: Getting started with VPS
description: Setting up VPS instance for jekyll blog
category: dev
tags: [linux, vps, web, jekyll]
layout: post
---

Recently, I decided to organize how I host and manage this website.
Until now, I was using tangled net of services hidden behind the idea of simplicity. I used Github Pages for hosting but wanted to keep my own domain. Easily done, unless you want to also have HTTPS -- I had to use Cloudflare for DNS and tunneling traffic via theirs server for SSL. My domain provider didn't support managing mail communication with custom DNS addresses, so I configured [mailgun](https://www.mailgun.com/) to do it instead. On top of that, I maintained *development* box with its own subdomain but without tunneling the traffic via Cloudflare. It was a mess. The time has come to sort things out.

* Display table of contents 
{:toc}

## Basics

I am using [Jekyll](https://jekyllrb.com/) to generate static website from Markdown and HTML snippets. It is *really* great. Those are still being hosted by [Github repository](https://github.com/wgml/wgml.github.io) but I no longer care for Github Pages -- it's only reason for existence is to redirect to mine domain. And one more thing but let's not get ahead of ourselves.

I host the content on Vultr $5/mo VPS. 1 GB of RAM + 25 GB of SSD storage is more than enough to support such endeavour and allow me to play with side projects on the same machine. Theirs $2.5/mo would be probably sufficient, too. Decided to use Ubuntu just for the library of guides already available on Vultr and DigitalOcean for that distribution.

## Blog
I installed nginx, configured it, normal stuff. The configuration was dead-simple.

```nginx
server {
    root /var/www/wgml.pl/html;
    index index.html;
    error_page 404 /404.html;

    server_name wgml.pl www.wgml.pl;

    location / {
        try_files $uri $uri/ =404;
    }

    listen 80;
    listen [::]:80;
}
```

I also installed a few necessary packages, like git, vim, jekyll. Built blog with `jekyll build --destination /var/www/wgml.pl` and, voilà, I could see my website under `http://wgml.pl`.

Yeah, at least two issues with that setup:
- I do not want to manually deploy the site every time I commit to repository
- Where is that HTTPS lock icon?

Fortunately, we will solve both of them in a minute.

## Deploying content changes automatically

I googled a bit for ideas on how to automate website deployment. It seems there are at least two interesting solutions. Jekyll docs [describe](https://jekyllrb.com/docs/deployment/automated/) how to use bare git repository and post-receive hooks to regenerate website on every push. You can also use Github webhooks to notify something like [jekyll-hook](https://github.com/developmentseed/jekyll-hook/) about changes. Both solutions work fine, I went with the second one because who would like to write two `git push` commands every time when one is sufficient?

Within a couple of minutes I prepared a bit overly complicated shell script to handle deployments.

```bash
#/bin/bash

set -e

REPO_URL="https://github.com/wgml/wgml.github.io.git"
SITE_DIR="/var/www/wgml.pl"
SITE_PUBLIC_DIR="$SITE_DIR/html"

cd $(mktemp -d)
git clone $REPO_URL --depth=1 --branch=master --single-branch .

HEAD=$(git rev-parse HEAD)
SITE_REV_DIR="$SITE_DIR/html-$HEAD"

if [ -d "$SITE_REV_DIR" ];
then
  ln -sfn "$SITE_REV_DIR" "$SITE_PUBLIC_DIR"
  exit 0
else
  mkdir "$SITE_REV_DIR"
fi

jekyll build --destination "$SITE_REV_DIR" && ln -sfn "$SITE_REV_DIR" "$SITE_PUBLIC_DIR" || rm -rf "$SITE_REV_DIR"
```

I modified nginx configuration to expose `/update` endpoint and forward all requests to the hook listener.

```nginx
server {
    ...
    location / {
        try_files $uri $uri/ =404;
    }

    location /update {
        rewrite ^/update(.*) /$1 break;
        proxy_pass http://127.0.0.1:12345;
    }

    listen 80;
    listen [::]:80;
}
```
{:.line-numbers}
{:data-line="7-10"}

Now, when I do `git push` on my local machine, changes will appear on website in a matter of seconds. Finally, I have dynamic-static website.

## Let's Encrypt

[Let's encrypt](https://letsencrypt.org/) is a go-to service for everyone in need of free TLS certificates and I highly recommend it.
For configuration, I  mostly followed DO [How To Secure Nginx with Let's Encrypt](https://www.digitalocean.com/community/tutorials/how-to-secure-nginx-with-let-s-encrypt-on-ubuntu-18-04) guide.

To sum up, install LE Certbot, configure firewall, obtain your SSL certificate with something similar to:

```bash
sudo certbot --nginx -d wgml.pl -d www.wgml.pl
```

`certbot` will attempt to renew any near-expiring certificates but make sure it will work by running

```bash
sudo certbot renew --dry-run
```

Make sure you entered your email address while requesting certificate as Let's Encrypt will mail you if renewal fails. 
`certbot` modified nginx configuration on itself, `https://wgml.pl` was available when I restarted nginx. Yay!

## Summary
I managed to migrate from Github Pages into personal VPS in a matter of couple of hours. I didn't lose ability to dynamically regenerate content on changes and SSL support. And, in addition to `DIY` factor, hosting your own website means you no longer need to care about limitations of Github Pages.
