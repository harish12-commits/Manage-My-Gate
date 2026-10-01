#!/usr/bin/env bash
# ==============================================================================
# Nahom (Manage-My-Gate): Automated Docker Build & Push Script (Linux/macOS)
# Default Image: nahom:prd1.0
# ==============================================================================
set -e

IMAGE_NAME="${1:-nahom}"
TAG="${2:-prd1.0}"
REGISTRY="${3:-atocash}"
SKIP_PUSH="${4:-true}"

echo "=========================================================="
echo "  Nahom: Build & Tag Production Docker Images"
echo "  Primary Image:  ${IMAGE_NAME}:${TAG}"
echo "  Registry Image: ${REGISTRY}/manage-my-gate-server:${TAG}"
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

# 2. Build Backend Image (nahom:prd1.0)
echo -e "\n[2/4] Building Backend Image (${IMAGE_NAME}:${TAG})..."
docker build \
  -t "${IMAGE_NAME}:${TAG}" \
  -t "${IMAGE_NAME}:latest" \
  -t "${IMAGE_NAME}-backend:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-server:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-server:latest" \
  ./backend
echo "Backend image built successfully as ${IMAGE_NAME}:${TAG}."

# 3. Build Frontend Image (nahom-frontend:prd1.0)
echo -e "\n[3/4] Building Frontend Image (${IMAGE_NAME}-frontend:${TAG})..."
docker build \
  -t "${IMAGE_NAME}-frontend:${TAG}" \
  -t "${IMAGE_NAME}-frontend:latest" \
  -t "${IMAGE_NAME}-client:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-client:${TAG}" \
  -t "${REGISTRY}/manage-my-gate-client:latest" \
  --build-arg VITE_API_URL="/api" \
  --build-arg VITE_SOCKET_URL="" \
  --build-arg VITE_GOOGLE_CLIENT_ID="610778456829-edvpd6gcav2u31jo0p2aeligfopvqfbo.apps.googleusercontent.com" \
  --build-arg VITE_MICROSOFT_CLIENT_ID="00000000-0000-0000-0000-000000000000" \
  --build-arg VITE_MICROSOFT_TENANT_ID="common" \
  ./frontend
echo "Frontend image built successfully as ${IMAGE_NAME}-frontend:${TAG}."

# 4. Push Images
if [ "${SKIP_PUSH}" = "true" ] || [ "${SKIP_PUSH}" = "1" ]; then
    echo -e "\n[4/4] Skipping push step (SKIP_PUSH=${SKIP_PUSH})."
else
    echo -e "\n[4/4] Pushing images..."
    if [ -n "${REGISTRY}" ]; then
        docker push "${REGISTRY}/manage-my-gate-server:${TAG}"
        docker push "${REGISTRY}/manage-my-gate-client:${TAG}"
    fi
    docker push "${IMAGE_NAME}:${TAG}" || true
    docker push "${IMAGE_NAME}-frontend:${TAG}" || true
fi

echo -e "\n=========================================================="
echo "  SUCCESS: Docker production images ready!"
echo "  - Backend:  ${IMAGE_NAME}:${TAG}"
echo "  - Frontend: ${IMAGE_NAME}-frontend:${TAG}"
echo "=========================================================="
