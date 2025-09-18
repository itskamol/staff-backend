#!/bin/bash

# Docker Compose Environment Helper Script
# Usage: ./docker-env.sh [dev|prod|staging] [up|down|build|logs|restart]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ENVIRONMENT='prod'
COMMAND=${1:-up}

# Print usage function
print_usage() {
    echo -e "${BLUE}Docker Environment Helper${NC}"
    echo -e "Usage: $0 [ENVIRONMENT] [COMMAND]"
    echo ""
    echo -e "${YELLOW}Environments:${NC}"
    echo "  dev       Development environment (hot reload, port 3001)"
    echo "  prod      Production environment (optimized, port 3000)"
    echo "  staging   Staging environment (production-like, port 3002)"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo "  up        Start services (default)"
    echo "  down      Stop services"
    echo "  build     Build services"
    echo "  logs      View logs"
    echo "  restart   Restart services"
    echo "  ps        Show container status"
    echo "  migrate   Run database migrations"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "  $0 dev up        # Start development environment"
    echo "  $0 prod down     # Stop production environment"
    echo "  $0 staging logs  # View staging logs"
}

# Check for help flag
if [[ "$1" == "-h" ]] || [[ "$1" == "--help" ]]; then
    print_usage
    exit 0
fi

# Check if environment file exists
ENV_FILE="config/environments/.env.${ENVIRONMENT}"
if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ Environment file $ENV_FILE not found!${NC}"
    echo -e "${YELLOW}Available environments: dev, prod, staging${NC}"
    echo -e "${BLUE}Available files:${NC}"
    ls -1 config/environments/ 2>/dev/null || echo "  No environment files found"
    exit 1
fi

# Load environment variables
set -a  # automatically export all variables
source $ENV_FILE
set +a

echo -e "${GREEN}🚀 Running Docker Compose for ${ENVIRONMENT} environment...${NC}"
echo -e "${BLUE}📁 Using environment file: ${ENV_FILE}${NC}"
echo -e "${BLUE}🔧 Command: ${COMMAND}${NC}"
echo -e "${BLUE}🌐 App will be available on port: ${APP_PORT}${NC}"

# Execute docker compose command
case $COMMAND in
    "up")
        docker compose --env-file $ENV_FILE up -d
        ;;
    "down")
        docker compose --env-file $ENV_FILE down
        ;;
    "build")
        docker compose --env-file $ENV_FILE build --no-cache
        ;;
    "logs")
        docker compose --env-file $ENV_FILE logs -f
        ;;
    "restart")
        echo -e "${YELLOW}⏳ Restarting containers...${NC}"
        docker compose --env-file $ENV_FILE down
        docker compose --env-file $ENV_FILE up -d
        ;;
    "ps")
        docker compose --env-file $ENV_FILE ps
        ;;
    "migrate")
        echo -e "${YELLOW}⏳ Running database migrations...${NC}"
        docker compose --env-file $ENV_FILE --profile migration up migration --build
        ;;
    *)
        echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
        echo -e "${YELLOW}Available commands: up, down, build, logs, restart, ps, migrate${NC}"
        exit 1
        ;;
esac

echo -e "${GREEN}✅ Docker Compose command completed!${NC}"
echo -e "${BLUE}📊 Container status:${NC}"
docker compose --env-file $ENV_FILE ps
