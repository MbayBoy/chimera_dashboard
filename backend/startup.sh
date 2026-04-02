#!/bin/bash
# ============================================================
# CHIMERA BACKEND v5.0 - Startup & Deployment Script
# ============================================================
# Usage:
#   chmod +x startup.sh
#   ./startup.sh
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo "" echo"============================================================" echo"  CHIMERA BACKEND v5.0 - Deployment Script" echo"============================================================" echo""

# Step 1: Check Node.js
log_info "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    log_error "Node.js is not installed. Please install Node.js 18+" log_info"Run: curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs"
    exit 1
fi
NODE_VERSION=$(node --version)
log_success "Node.js found: $NODE_VERSION"

# Step 2: Check .env file
log_info "Checking environment configuration..."
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        log_warn ".env not found. Copying from .env.example..."
        cp .env.example .env
        log_warn "IMPORTANT: Edit .env with your actual credentials!" log_warn"Run: nano .env" echo"" read -p"Press ENTER after editing .env to continue, or Ctrl+C to exit..."
    else
        log_error ".env file not found and no .env.example available."
        exit 1
    fi
fi

source .env 2>/dev/null || true

if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" = "https://your-project-id.supabase.co" ]; then
    log_error "SUPABASE_URL is not configured in .env"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_KEY" ] || [ "$SUPABASE_SERVICE_KEY" = "your-service-role-key-here" ]; then
    log_error "SUPABASE_SERVICE_KEY is not configured in .env" log_info"Get it from: Supabase Dashboard -> Settings -> API -> service_role key"
    exit 1
fi

log_success "Environment configuration looks good"

# Step 3: Create required directories
log_info "Creating required directories..."
mkdir -p logs
mkdir -p backups
log_success "Directories created"

# Step 4: Install dependencies
log_info "Installing Node.js dependencies..."
npm install --production --silent
log_success "Dependencies installed"

# Step 5: Check PM2
log_info "Checking PM2 process manager..."
if ! command -v pm2 &> /dev/null; then
    log_warn "PM2 not found. Installing globally..."
    npm install -g pm2
    log_success "PM2 installed"
else
    log_success "PM2 found: $(pm2 --version)"
fi

# Step 6: Stop existing process if running
log_info "Stopping existing Chimera process (if any)..."
pm2 stop chimera-backend 2>/dev/null || true
pm2 delete chimera-backend 2>/dev/null || true
log_success "Cleaned up old processes"

# Step 7: Start with PM2
log_info "Starting Chimera Backend with PM2..."
pm2 start ecosystem.config.js --env production
log_success "Chimera Backend started"

# Step 8: Save PM2 process list
log_info "Saving PM2 process list for auto-restart..."
pm2 save
log_success "PM2 process list saved"

# Step 9: Setup PM2 startup
log_info "Setting up PM2 startup script..."
PM2_STARTUP=$(pm2 startup 2>&1 | tail -1)
if [[ $PM2_STARTUP == sudo* ]]; then
    log_warn "Run this command to enable auto-start on reboot:" echo"  $PM2_STARTUP"
else
    log_success "PM2 startup configured"
fi

# Step 10: Health check
log_info "Waiting for server to start..."
sleep 3

PORT_NUM=${PORT:-3001}
HEALTH_URL="http://localhost:$PORT_NUM/health"

log_info "Running health check at $HEALTH_URL..."
for i in {1..5}; do
    if curl -s -f "$HEALTH_URL" > /dev/null 2>&1; then log_success"Health check passed!"
        break
    fi
    if [ $i -eq 5 ]; then
        log_warn "Health check failed after 5 attempts. Check logs:" log_info"  pm2 logs chimera-backend"
    else
        log_info "Attempt $i/5 - waiting 2 seconds..."
        sleep 2
    fi
done

echo "" echo"============================================================" echo -e"  ${GREEN}CHIMERA BACKEND DEPLOYED SUCCESSFULLY!${NC}" echo"============================================================" echo"" echo"  Status:    pm2 status" echo"  Logs:      pm2 logs chimera-backend" echo"  Restart:   pm2 restart chimera-backend" echo"  Stop:      pm2 stop chimera-backend" echo"  Monitor:   pm2 monit" echo"" echo"  Health:    curl http://localhost:${PORT:-3001}/health"
echo "  Deep:      curl http://localhost:${PORT:-3001}/health/deep"
echo "" echo"  Next steps:" echo"  1. Configure Nginx: sudo cp nginx.conf /etc/nginx/sites-available/chimera-api" echo"  2. Enable site:     sudo ln -s /etc/nginx/sites-available/chimera-api /etc/nginx/sites-enabled/" echo"  3. Get SSL cert:    sudo certbot --nginx -d api.yourdomain.com" echo""
