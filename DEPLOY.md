# Deployment Instructions

Follow these steps to deploy the EpsteinTool to your Ubuntu server.

## 1. Prepare the Server
Connect to your server via SSH:
```bash
ssh root@46.225.122.81
```

Once connected, ensure `git` is installed:
```bash
sudo apt-get update
sudo apt-get install -y git
```

## 2. Get or update code
If you are setting up for the first time, clone the repository:

```bash
cd ~
git clone https://github.com/JaguarM/EpsteinTool.git
```

If you already have the code and want to update it:

```bash
cd ~/EpsteinTool
git pull
```
*Note: This will create or update the directory named `EpsteinTool` in your home directory (e.g., `/root/EpsteinTool` if logged in as root).*

## 3. Run Setup Script
On the server, run the setup script:

```bash
cd ~/EpsteinTool
chmod +x setup.sh
./setup.sh
```

## 4. Configure Services
The `setup.sh` script installs dependencies but you need to finalize the configuration.

### Systemd (Gunicorn)
```bash
# Edit the service file if your path or user is not 'ubuntu'
# If you are root, User should be 'root' and paths should be '/root/EpsteinTool'
nano epsteintool.service

# Copy to systemd directory
sudo cp epsteintool.service /etc/systemd/system/

# Reload daemon to recognize changes
sudo systemctl daemon-reload

# Start and enable the service
sudo systemctl start epsteintool
sudo systemctl enable epsteintool
```

### Troubleshooting User Error (217/USER)
If the service fails to start with `status=217/USER`, it means the `User=` line in `epsteintool.service` doesn't match a user on your system.
1. Check your current user with `whoami`.
2. Ensure `epsteintool.service` has `User=root` (if you are root) or your specific username.
3. Ensure all paths (`WorkingDirectory`, `ExecStart`, etc.) match your user's home directory.

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
Secure your site with Let's Encrypt:

```bash
sudo certbot --nginx -d guesser.moedritscher.ch
```

## 6. Access the App
Open your browser and navigate to: [http://guesser.moedritscher.ch](http://guesser.moedritscher.ch)
