#!/bin/bash
# =============================================================================
# POULTRY LIMS - Production Update Script
# =============================================================================
# This script safely updates the production deployment without losing data
# Run this on your NAS server to update to the latest version
# =============================================================================

set -e  # Exit on any error

echo "========================================"
echo "POULTRY LIMS - Production Update"
echo "========================================"
echo ""

# Configuration
COMPOSE_FILE="docker-compose-hub.yml"

# Step 1: Pull latest images from Docker Hub
echo "[1/4] Pulling latest images from Docker Hub..."
docker-compose -f $COMPOSE_FILE pull
echo "✓ Images pulled successfully"
echo ""

# Step 2: Stop and remove containers (NOT volumes - data is preserved!)
echo "[2/4] Stopping current containers..."
docker-compose -f $COMPOSE_FILE down
echo "✓ Containers stopped"
echo ""

# Step 3: Start containers with new images
echo "[3/4] Starting containers with new images..."
docker-compose -f $COMPOSE_FILE up -d
echo "✓ Containers started"
echo ""

# Step 4: Verify all containers are running
echo "[4/4] Verifying deployment..."
sleep 5
docker-compose -f $COMPOSE_FILE ps

echo ""
echo "========================================"
echo "✓ Update completed successfully!"
echo "========================================"
echo ""
echo "Access your application at: http://$(hostname -I | awk '{print $1}'):3000"
echo ""

# Health check
echo "Running health check..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/docs | grep -q "200"; then
    echo "✓ Backend is healthy"
else
    echo "⚠ Backend may need a moment to start. Check logs with: docker logs lims_backend"
fi
