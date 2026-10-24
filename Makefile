# ==============================
# Configuration
# ==============================

NPM := npm

# ==============================
# Quality checks
# ==============================

default: help

lint: ## Run oxlint static analysis
	$(NPM) run lint

lint-eslint: ## Run eslint static analysis
	$(NPM) run lint:eslint

type-check: ## Run TypeScript type checking (main, preload, renderer)
	$(NPM) run type-check

test: ## Run unit tests (vitest)
	$(NPM) run test

format-branch: ## Auto-fix eslint + prettier for files changed on current branch (vs main)
	$(NPM) run format:branch

format-branch-check: ## Check eslint + prettier for files changed on current branch (vs main)
	$(NPM) run format:branch:check

check: lint lint-eslint type-check test ## Run all checks (lint + eslint + types + tests)

# ==============================
# Development
# ==============================

dev: ## Start the app in dev mode (electron-vite, HMR)
	$(NPM) run dev

build: ## Production build (type-check + electron-vite build)
	$(NPM) run build

preview: ## Run the production build
	$(NPM) run start

# ==============================
# Maintenance
# ==============================

clean: ## Remove build artifacts and caches
	rm -rf dist out

help: ## Show this help menu
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

.PHONY: default lint lint-eslint type-check test format-branch format-branch-check check dev build preview clean help
