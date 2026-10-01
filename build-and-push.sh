#!/usr/bin/env bash
# ==============================================================================
# Manage-My-Gate: Automated Docker Build & Push Script (Linux/macOS)
# Default tag: prd1.0
# ==============================================================================
set -e

TAG="${1:-prd1.0}"
REGISTRY="${2:-atocash}"
SKIP_PUSH="${3:-false}"

echo "=========================================================="
echo "  Manage-My-Gate: Build & Push Docker Images"
echo "  Target Registry: ${REGISTRY}"
echo "  Target Image Tag: ${TAG}"
echo "=========================================================="

# 1. Verify Docker Engine
echo -e "\n[1/4] Checking Docker daemon status..."
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Docker daemon is not running. Please start Docker and try again." >&2
    exit 1
fi
echo "Docker daemon is online and ready."

# Navigate to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 2. Build Backend Image
echo -e "\n[2/4] Building Backend Image (${REGISTRY}/manage-my-gate-server:${TAG})..."
docker build \
  -t "${REGISTRY}/manage-my-gate-server:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-server:latest" \
  ./backend
echo "Backend image built successfully."

# 3. Build Frontend Image
echo -e "\n[3/4] Building Frontend Image (${REGISTRY}/manage-my-gate-client:${TAG})..."
docker build \
  -t "${REGISTRY}/manage-my-gate-client:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-client:latest" \
  --build-arg VITE_API_URL="/api" \
  --build-arg VITE_SOCKET_URL="" \
  --build-arg VITE_GOOGLE_CLIENT_ID="610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com" \
  --build-arg VITE_MICROSOFT_CLIENT_ID="00000000-0000-0000-0000-000000000000" \
  --build-arg VITE_MICROSOFT_TENANT_ID="common" \
  ./frontend
echo "Frontend image built successfully."

# 4. Push Images
if [ "${SKIP_PUSH}" = "true" ] || [ "${SKIP_PUSH}" = "1" ]; then
    echo -e "\n[4/4] Skipping push step (SKIP_PUSH=${SKIP_PUSH})."
else
    echo -e "\n[4/4] Pushing images to Docker Hub..."
    echo "Pushing ${REGISTRY}/manage-my-gate-server:${TAG}..."
    docker push "${REGISTRY}/manage-my-gate-server:${TAG}"

    echo "Pushing ${REGISTRY}/manage-my-gate-client:${TAG}..."
    docker push "${REGISTRY}/manage-my-gate-client:${TAG}"
fi

echo -e "\n=========================================================="
echo "  SUCCESS: Docker images prepared for production!"
echo "  - Backend:  ${REGISTRY}/manage-my-gate-server:${TAG}"
echo "  - Frontend: ${REGISTRY}/manage-my-gate-client:${TAG}"
echo "=========================================================="
