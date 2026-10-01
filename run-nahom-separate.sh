#!/usr/bin/env bash
# ==============================================================================
# Nahom (prd1.0) Separate Stack Management Script (Option A)
# Runs on host ports 5007 (API) and 3005 (Web)
# ==============================================================================
set -e

ACTION="${1:-status}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.nahom.yml"

# Auto-detect existing docker network
if docker network inspect mmg-network >/dev/null 2>&1; then
    export DOCKER_NETWORK="mmg-network"
elif docker network inspect gatedcommunity_mmg-network >/dev/null 2>&1; then
    export DOCKER_NETWORK="gatedcommunity_mmg-network"
elif docker network ls --format '{{.Name}}' | grep -q '_mmg-network$'; then
    export DOCKER_NETWORK="$(docker network ls --format '{{.Name}}' | grep '_mmg-network$' | head -n1)"
else
    export DOCKER_NETWORK="mmg-network"
fi

case "${ACTION}" in
    up|start)
        echo "=========================================================="
        echo "  Starting Nahom (prd1.0) Separate Stack (Option A)"
        echo "  Docker Network: ${DOCKER_NETWORK}"
        echo "=========================================================="
        docker compose -f "${COMPOSE_FILE}" up -d
        echo ""
        echo "SUCCESS: Containers running!"
        echo "  - Backend API:  http://localhost:5007"
        echo "  - Frontend Web: http://localhost:3005"
        echo ""
        docker ps --filter "name=nahom" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        ;;
    down|stop)
        echo "Stopping Nahom (prd1.0) separate stack..."
        docker compose -f "${COMPOSE_FILE}" down
        echo "Stack stopped successfully."
        ;;
    logs)
        docker compose -f "${COMPOSE_FILE}" logs -f --tail 100
        ;;
    status|*)
        echo "=========================================================="
        echo "  Nahom (prd1.0) Separate Stack Status"
        echo "=========================================================="
        docker ps -a --filter "name=nahom" --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
        echo ""
        echo "Usage: ./run-nahom-separate.sh [up|down|status|logs]"
        ;;
esac
