#!/bin/bash

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Python and Nginx
sudo apt-get install -y python3-pip python3-venv nginx

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate

# Install dependencies including Gunicorn
pip install -r requirements.txt
pip install gunicorn

# Setup Gunicorn service (Assuming the service file is in the current directory)
# You might need to adjust the path in the service file if your project is not in /home/ubuntu/EpsteinTool
# sudo cp epsteintool.service /etc/systemd/system/
# sudo systemctl start epsteintool
# sudo systemctl enable epsteintool

# Setup Nginx (Assuming the nginx conf is in the current directory)
# sudo cp nginx_app.conf /etc/nginx/sites-available/epsteintool
# sudo ln -s /etc/nginx/sites-available/epsteintool /etc/nginx/sites-enabled
# sudo rm /etc/nginx/sites-enabled/default
# sudo systemctl restart nginx

# SSL Setup (Interactive)
# sudo apt-get install -y certbot python3-certbot-nginx
# sudo certbot --nginx -d puzzle.moedritscher.ch
