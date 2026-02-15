#!/bin/bash

# Exit on error
set -e

echo "Updating package lists..."
sudo apt-get update

echo "Installing Python 3, pip, and venv..."
sudo apt-get install -y python3 python3-pip python3-venv

# Install system dependencies for OpenCV and other potential libraries
# libgl1 and libglib2.0-0 are commonly required for opencv-python-headless and other image libraries
# build-essential is useful for compiling Python packages if wheels are missing
echo "Installing system dependencies..."
sudo apt-get install -y libgl1 libglib2.0-0 build-essential

# Create a virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate the virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
if [ -f "requirements.txt" ]; then
    echo "Installing Python dependencies from requirements.txt..."
    pip install -r requirements.txt
else
    echo "requirements.txt not found!"
    exit 1
fi

echo "Installation complete!"
echo "To run the application, use: ./run_app.sh"
