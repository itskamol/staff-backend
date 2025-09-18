#!/bin/sh

set -e

echo "Running database migrations..."

pnpm db:migrate

echo "Migrations complete. Starting the application..."
exec "$@"