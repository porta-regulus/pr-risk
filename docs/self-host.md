# Self-host PortaRegulus Risk

You can serve the release bundle from your own web server, for example on an intranet. The files are the same as on https://risk.portaregulus.com (ADR-0004 decision 2).

## Requirements

1. Use a dedicated origin, for example `https://risk.example.com`. Do not serve other pages or scripts on that origin. Any script on the same origin can read the stored registers (ADR-0004 decision 3).
2. Serve the files at the root path `/`. The service worker controls the scope `/`.
3. Use HTTPS. Browsers start a service worker only in a secure context.
4. Set the HTTP headers of this guide on every response. The page also has a CSP `<meta>` tag, but a meta tag cannot set `frame-ancestors`. Without the header, another site can frame the app and trick users into a click on "Remove all data" (ADR-0004 E3).

## Get and check the bundle

Download `pr-risk-<version>.tar.gz` and `SHA256SUMS` from https://github.com/porta-regulus/pr-risk/releases. Check both before you extract the bundle.

```bash
sha256sum -c SHA256SUMS --ignore-missing
```

```bash
gh attestation verify pr-risk-v0.1.0.tar.gz --repo porta-regulus/pr-risk
```

```bash
mkdir -p /var/www/pr-risk && tar -xzf pr-risk-v0.1.0.tar.gz -C /var/www/pr-risk
```

## Headers

The values come from `deploy/headers.json`, and `test/self-host.test.ts` keeps the 3 examples below equal to it. Every path gets the same headers, except `/sw.js`. Its CSP has `connect-src 'self'` in place of `connect-src 'none'`, so that the service worker can cache the app files (ADR-0004, exception for the service worker script).

`Strict-Transport-Security` with `includeSubDomains` applies to every subdomain of the host that you use. Remove `preload` if you do not want to submit the host to the browser preload lists.

Change the host name, the certificate paths and the file path to your values.

### nginx

```nginx
server {
    listen 443 ssl;
    server_name risk.example.com;
    ssl_certificate     /etc/ssl/risk.example.com.crt;
    ssl_certificate_key /etc/ssl/risk.example.com.key;
    root /var/www/pr-risk;

    location / {
        add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    }

    location = /sw.js {
        add_header Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text" always;
        add_header Cross-Origin-Opener-Policy "same-origin" always;
        add_header Cross-Origin-Resource-Policy "same-origin" always;
        add_header Referrer-Policy "no-referrer" always;
        add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    }
}
```

`add_header` in a `location` block replaces every `add_header` of the `server` block. So both blocks list all headers.

### Apache httpd 2.4

Turn on `mod_headers` and `mod_ssl`.

```apache
<VirtualHost *:443>
    ServerName risk.example.com
    DocumentRoot "/var/www/pr-risk"
    SSLEngine on
    SSLCertificateFile "/etc/ssl/risk.example.com.crt"
    SSLCertificateKeyFile "/etc/ssl/risk.example.com.key"

    Header always set Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text" "expr=%{REQUEST_URI} != '/sw.js'"
    Header always set Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text" "expr=%{REQUEST_URI} == '/sw.js'"
    Header always set Cross-Origin-Opener-Policy "same-origin"
    Header always set Cross-Origin-Resource-Policy "same-origin"
    Header always set Referrer-Policy "no-referrer"
    Header always set Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()"
    Header always set X-Content-Type-Options "nosniff"
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
</VirtualHost>
```

### Caddy 2

Caddy gets and renews the certificate itself.

```caddy
risk.example.com {
    root * /var/www/pr-risk
    file_server

    @app not path /sw.js
    header @app Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'none'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text"
    header /sw.js Content-Security-Policy "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'; require-trusted-types-for 'script'; trusted-types app-text"
    header {
        Cross-Origin-Opener-Policy "same-origin"
        Cross-Origin-Resource-Policy "same-origin"
        Referrer-Policy "no-referrer"
        Permissions-Policy "camera=(), microphone=(), geolocation=(), usb=(), payment=(), clipboard-read=()"
        X-Content-Type-Options "nosniff"
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    }
}
```

## Check the result

Open the app, then open the developer tools of the browser. The console must show no CSP error. Check the headers of 2 responses.

```bash
curl -sI https://risk.example.com/ | grep -i content-security-policy
```

```bash
curl -sI https://risk.example.com/sw.js | grep -i content-security-policy
```

The first one must have `connect-src 'none'`, and the second one `connect-src 'self'`.

## Updates

Your copy does not change until you install a new bundle. Watch the releases of https://github.com/porta-regulus/pr-risk to learn about security fixes (SECURITY.md). To update, check and extract the new bundle into an empty folder, then point the web server at it. The service worker loads the new version when users next start the app. The app then shows a notice with the new version and a link to its release notes.

The hosted app at https://risk.portaregulus.com updates itself on the next start after each release. While the app is open, a notice says that a new version is ready. The new version becomes active when you close all tabs of the app. To keep a fixed version, self-host the release that you choose. Your copy stays on that release until you install a newer bundle.
