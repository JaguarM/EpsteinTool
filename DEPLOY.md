# Deployment Instructions

Follow these steps to deploy the EpsteinTool to your Ubuntu server.

## 1. Prepare the Server
Ensure `git` is installed:
```bash
sudo apt-get update
sudo apt-get install -y git
```

### 1.1 Install Fonts
The application requires Microsoft fonts (Times New Roman) to calculate text widths correctly. Install `fontconfig` and `ttf-mscorefonts-installer`:

```bash
sudo apt-get update
sudo apt-get install -y fontconfig ttf-mscorefonts-installer
```

*Note: You may be prompted to accept a license agreement (EULA). Use `TAB` to select `<Ok>` and `ENTER` to accept.*

After installation, update the font cache:

```bash
sudo fc-cache -f -v
```

## 2. Get or update code
If you are setting up for the first time, clone the repository:

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/JaguarM/EpsteinTool.git epsteintool
cd epsteintool
```

If you already have the code and want to update it:

```bash
cd /var/www/epsteintool
git pull
```
*Note: This will create or update the directory named `epsteintool` in `/var/www/`.*

## 3. Run Setup Script
On the server, run the setup script:

```bash
cd /var/www/epsteintool
chmod +x setup.sh
./setup.sh
```

## 4. Configure Services
The `setup.sh` script installs dependencies but you need to finalize the configuration.

### Systemd (Gunicorn)
```bash
# Edit the service file if your path or user is not 'ubuntu'
# If you are root, User should be 'root' and paths should be '/var/www/epsteintool'
nano epsteintool.service

# Copy to systemd directory
sudo cp epsteintool.service /etc/systemd/system/

# Reload daemon to recognize changes
sudo systemctl daemon-reload

# Start and enable the service
sudo systemctl start epsteintool
sudo systemctl enable epsteintool
```

### Troubleshooting: Permission Denied (13: Permission denied)
If you see a `Permission denied` error in your Nginx logs, it means Nginx (`www-data`) cannot access the Gunicorn socket.
To fix this, ensure Gunicorn runs as `www-data` and owns the project folder:

1. **Update the Service**:
   Ensure `epsteintool.service` has:
   ```ini
   [Service]
   User=www-data
   Group=www-data
   ```

2. **Fix Folder Ownership**:
   Run this command to give `www-data` ownership of the project:
   ```bash
   sudo chown -R www-data:www-data /var/www/epsteintool
   ```

3. **Reload and Restart**:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl restart epsteintool
   sudo systemctl restart nginx
   ```

### Troubleshooting: User Error (217/USER)
If the service fails to start with `status=217/USER`, it means the `User=` line in `epsteintool.service` refers to a user that doesn't exist. Ensure it is set to `www-data` or a user that exists on your system.


### Nginx
```bash
# Edit the config if paths are different
nano nginx_app.conf

# Copy to Nginx sites-available
sudo cp nginx_app.conf /etc/nginx/sites-available/epsteintool

# Enable the site
sudo ln -s /etc/nginx/sites-available/epsteintool /etc/nginx/sites-enabled

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

## 5. SSL Certificate (HTTPS)
Secure your site with Let's Encrypt. If Certbot is not installed, run:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

Now, obtain and install the SSL certificate:

```bash
sudo certbot --nginx -d puzzle.moedritscher.ch
```

*Follow the prompts to enter your email and agree to the terms. When asked whether to redirect HTTP to HTTPS, choose **2 (Redirect)** to ensure Safari handles the connection correctly.*

## 6. Verification
Check that the socket file is owned by `www-data`:

```bash
ls -l /var/www/epsteintool/epsteintool.sock
```

Open your browser and navigate to: [https://puzzle.moedritscher.ch](https://puzzle.moedritscher.ch)
