.PHONY: install up up-native deploy services demo down down-native clean logs e2e e2e-native web-dev web-build

API_PORT ?= 3001

# Install all dependencies
install:
	cd contracts && forge install
	cd solver && npm install
	cd indexer && npm install
	cd api && npm install
	cd mcp && npm install
	cd ops/demo && npm install
	cd web && npm install

# Start infrastructure via Docker Compose (Anvil + Postgres)
up:
	docker compose -f ops/docker-compose.yml up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5

# Start infrastructure natively (requires local Anvil + Postgres)
up-native:
	./ops/start-anvil.sh

# Deploy contracts to local devnet
deploy:
	./ops/deploy.sh

# Start all off-chain services (indexer, solver, API)
services:
	API_PORT=$(API_PORT) ./ops/start-services.sh

# Run the end-to-end demo
demo:
	cd ops/demo && API_URL=http://localhost:$(API_PORT) npx tsx run.ts

# Stop everything
down:
	./ops/stop-services.sh || true
	docker compose -f ops/docker-compose.yml down 2>/dev/null || true

# Stop native infrastructure
down-native:
	./ops/stop-services.sh || true
	@if [ -f ops/anvil.pid ]; then kill $$(cat ops/anvil.pid) 2>/dev/null; rm ops/anvil.pid; fi

# Full clean: remove containers, volumes, generated files
clean:
	./ops/stop-services.sh 2>/dev/null || true
	docker compose -f ops/docker-compose.yml down -v 2>/dev/null || true
	@if [ -f ops/anvil.pid ]; then kill $$(cat ops/anvil.pid) 2>/dev/null; rm -f ops/anvil.pid; fi
	rm -f ops/.env.deployed ops/*.pid ops/*.log

# Tail service logs
logs:
	@tail -f ops/indexer.log ops/solver.log ops/api.log

# Full end-to-end (Docker): infra → deploy → services → demo
e2e: up deploy services demo

# Full end-to-end (native): anvil → deploy → services → demo
e2e-native: up-native deploy services demo

# Web: start dev server
web-dev:
	cd web && npm run dev

# Web: production build
web-build:
	cd web && npm run build
