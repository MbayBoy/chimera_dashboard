# Chimera Backend - Deployment Guide

## Overview
This guide covers deploying the Chimera backend API server to:
- **Option A**: Hostinger VPS (recommended - full Node.js support)
- **Option B**: AWS EC2

> ⚠️ **Note**: Hostinger **shared hosting** does NOT support Node.js backend servers.
> You need a **Hostinger VPS** plan (KVM 1 or higher) for this backend.
> Your React frontend can stay on shared hosting.

---

## OPTION A: Hostinger VPS Deployment

### Prerequisites
- Hostinger KVM VPS (Ubuntu 22.04 LTS)
- SSH access to your VPS
- Domain pointed to VPS IP (for SSL)

### Step 1: Connect to Your VPS
```bash
ssh root@YOUR_VPS_IP
# Or with key: ssh -i ~/.ssh/your-key.pem root@YOUR_VPS_IP
```

### Step 2: Install Node.js 18
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # Should show v18.x.x
```

### Step 3: Install PM2 and Nginx
```bash
npm install -g pm2
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Step 4: Upload Your Backend Files
```bash
# On your LOCAL machine - upload backend folder
scp -r ./backend root@YOUR_VPS_IP:/var/www/chimera-backend

# Or use SFTP client (FileZilla, WinSCP)
# Connect to: YOUR_VPS_IP, Port 22, Username: root
# Upload the entire 'backend' folder to /var/www/chimera-backend
```

### Step 5: Install Dependencies
```bash
cd /var/www/chimera-backend
npm install --production
```

### Step 6: Configure Environment Variables
```bash
cp .env.example .env
nano .env
# Fill in your actual values:
# SUPABASE_URL=https://your-project.supabase.co
# SUPABASE_SERVICE_KEY=your-service-role-key
# ENABLE_CRON_JOBS=true
# ALLOWED_ORIGINS=https://chimerada7417.builtwithrocket.new
```

### Step 7: Start with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup  # Follow the command it outputs to auto-start on reboot

# Verify it's running
pm2 status
pm2 logs chimera-backend
```

### Step 8: Configure Nginx
```bash
# Copy nginx config
sudo cp nginx.conf /etc/nginx/sites-available/chimera-api

# Edit the config - replace api.yourdomain.com with your actual domain
sudo nano /etc/nginx/sites-available/chimera-api

# Enable the site
sudo ln -s /etc/nginx/sites-available/chimera-api /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 9: SSL Certificate (Let's Encrypt - FREE)
```bash
# Make sure your domain DNS points to this VPS IP first!
sudo certbot --nginx -d api.yourdomain.com

# Auto-renewal is set up automatically
# Test renewal: sudo certbot renew --dry-run
```

### Step 10: Verify Deployment
```bash
# Test health endpoint
curl https://api.yourdomain.com/health

# Should return:
# {"status":"healthy","version":"5.0.0",...}
```

---

## OPTION B: AWS EC2 Deployment

### Step 1: Launch EC2 Instance
1. Go to AWS Console → EC2 → Launch Instance
2. **AMI**: Ubuntu Server 22.04 LTS
3. **Instance Type**: t3.small (minimum) or t3.medium (recommended)
4. **Security Group** - Add these inbound rules:
   - SSH (22) - Your IP only
   - HTTP (80) - Anywhere
   - HTTPS (443) - Anywhere
   - Custom TCP (3001) - Your IP only (for direct testing)
5. **Key Pair**: Create or select existing
6. Launch instance

### Step 2: Connect to Instance
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

### Step 3: Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 and Nginx
npm install -g pm2
sudo apt install nginx certbot python3-certbot-nginx -y

# Install Git (optional, for pulling code)
sudo apt install git -y
```

### Step 4: Upload Backend Code
```bash
# Option 1: SCP from local machine
scp -i your-key.pem -r ./backend ubuntu@YOUR_EC2_IP:/home/ubuntu/chimera-backend

# Option 2: Git clone (if you have a private repo)
git clone https://github.com/yourusername/chimera-backend.git /home/ubuntu/chimera-backend

# Option 3: Use AWS S3
aws s3 cp s3://your-bucket/chimera-backend.tar.gz .
tar -xzf chimera-backend.tar.gz
```

### Step 5: Setup Application
```bash
cd /home/ubuntu/chimera-backend
npm install --production
cp .env.example .env
nano .env  # Fill in your values
```

### Step 6: Start with PM2
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd
# Run the command PM2 outputs
```

### Step 7: Configure Nginx + SSL
```bash
# Point your domain to EC2 Elastic IP first
# Then:
sudo cp /home/ubuntu/chimera-backend/nginx.conf /etc/nginx/sites-available/chimera-api
sudo nano /etc/nginx/sites-available/chimera-api  # Update domain name
sudo ln -s /etc/nginx/sites-available/chimera-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d api.yourdomain.com
```

### Step 8: Elastic IP (Important for AWS)
```bash
# Allocate an Elastic IP in AWS Console
# Associate it with your EC2 instance
# Update your domain DNS to point to the Elastic IP
# This prevents IP changes on instance restart
```

---

## Connecting Frontend to Backend

Update your React frontend `.env` file:
```bash
VITE_API_URL=https://api.yourdomain.com
```

Then in your React components, use:
```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Example API call
const response = await fetch(`${API_URL}/api/campaigns`, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

---

## PM2 Management Commands

```bash
pm2 status              # View all processes
pm2 logs chimera-backend # View live logs
pm2 restart chimera-backend # Restart app
pm2 stop chimera-backend    # Stop app
pm2 reload chimera-backend  # Zero-downtime reload
pm2 monit               # Real-time monitoring dashboard
```

---

## Troubleshooting

### Backend won't start
```bash
pm2 logs chimera-backend --lines 50
# Check for missing env variables or port conflicts
```

### Nginx 502 Bad Gateway
```bash
# Check if Node.js is running
pm2 status
# Check nginx error log
sudo tail -f /var/log/nginx/error.log
```

### Supabase connection failed
```bash
# Verify your service key is correct
# Check Supabase dashboard → Settings → API
# Make sure SUPABASE_SERVICE_KEY (not anon key) is used
```

### Cron jobs not running
```bash
# Check ENABLE_CRON_JOBS=true in .env
pm2 logs chimera-backend | grep CRON
```

### SSL certificate issues
```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

---

## Security Checklist

- [ ] `.env` file has correct permissions: `chmod 600 .env`
- [ ] Firewall configured: `sudo ufw allow 22,80,443/tcp && sudo ufw enable`
- [ ] SUPABASE_SERVICE_KEY is NOT the anon key
- [ ] ALLOWED_ORIGINS only includes your frontend domain
- [ ] SSH key authentication enabled, password auth disabled
- [ ] Regular security updates: `sudo apt update && sudo apt upgrade`
- [ ] PM2 auto-restart on reboot configured
- [ ] SSL certificate auto-renewal working
