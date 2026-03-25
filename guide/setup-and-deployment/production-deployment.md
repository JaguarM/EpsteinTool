# Production Deployment

Full deployment guide for a Linux server (Ubuntu/Debian) with Gunicorn, Nginx, and SSL.

## Architecture

```
Client → HTTPS (443) → Nginx → Unix Socket → Gunicorn → Django
```

Nginx handles SSL termination, static files, and proxies dynamic requests to Gunicorn over a Unix socket.

---

## Automated Setup

The `setup.sh` script handles the entire process:

```bash
sudo mkdir -p /var/www/epsteintool
sudo cp -r . /var/www/epsteintool/
cd /var/www/epsteintool
chmod +x setup.sh
sudo ./setup.sh
```

### What `setup.sh` does

| Step | Action |
|------|--------|
| 1 | Updates system, installs Python, Nginx, fonts, HarfBuzz, OpenCV dependencies |
| 2 | Creates Python venv, installs `requirements.txt` + Gunicorn |
| 3 | Runs `manage.py migrate` and `collectstatic` |
| 4 | Installs the `epsteintool.service` systemd unit |
| 5 | Configures Nginx with `nginx_app.conf` |
| 6 | Installs SSL certificate via Certbot for `puzzle.moedritscher.ch` |

---

## Manual Step-by-Step

### 1. Systemd Service

The file `epsteintool.service` runs Gunicorn as `www-data`:

```ini
[Unit]
Description=EpsteinTool Gunicorn
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/epsteintool
ExecStart=/var/www/epsteintool/venv/bin/gunicorn \
    epstein_project.wsgi:application \
    --bind unix:/var/www/epsteintool/epsteintool.sock

[Install]
WantedBy=multi-user.target
```

```bash
sudo cp epsteintool.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now epsteintool
```

### 2. Nginx Configuration

The file `nginx_app.conf` proxies to the Gunicorn socket and serves static files directly:

```nginx
server {
    listen 80;
    server_name puzzle.moedritscher.ch;

    location /static/ {
        alias /var/www/epsteintool/static/;
    }

    location / {
        proxy_pass http://unix:/var/www/epsteintool/epsteintool.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
sudo cp nginx_app.conf /etc/nginx/sites-available/epsteintool
sudo ln -sf /etc/nginx/sites-available/epsteintool /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 3. SSL with Certbot

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d puzzle.moedritscher.ch
```

Certbot will modify the Nginx config to add HTTPS listeners and auto-renew certificates.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `502 Bad Gateway` | Check if Gunicorn is running: `sudo systemctl status epsteintool` |
| Static files 404 | Run `python manage.py collectstatic --noinput`, check Nginx `alias` path |
| Permission denied on socket | `sudo chown -R www-data:www-data /var/www/epsteintool` |
| Font widths are wrong | Ensure `assets/fonts/` contains the `.ttf` files and `fc-cache -fv` was run |
| Upload too large | `DATA_UPLOAD_MAX_MEMORY_SIZE` in `settings.py` defaults to 50 MB |

## Updating

```bash
cd /var/www/epsteintool
git pull
source venv/bin/activate
pip install -r requirements.txt
python3 manage.py migrate
python3 manage.py collectstatic --noinput
sudo systemctl restart epsteintool
```
