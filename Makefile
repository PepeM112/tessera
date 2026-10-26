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

type-check: ## Run TypeScript type checking (library, playground, e2e, config files)
	$(NPM) run type-check

test: ## Run unit tests (vitest: node + real Chromium)
	$(NPM) run test

e2e: ## Run end-to-end tests on the playground (Playwright, Chromium)
	$(NPM) run test:e2e

format-branch: ## Auto-fix eslint + prettier for files changed on current branch (vs main)
	$(NPM) run format:branch

format-branch-check: ## Check eslint + prettier for files changed on current branch (vs main)
	$(NPM) run format:branch:check

check: lint lint-eslint type-check test e2e ## Run all checks (lint + eslint + types + tests + e2e)

# ==============================
# Development
# ==============================

dev: ## Start the playground (Vite, HMR)
	$(NPM) run dev

build: ## Build the library into dist/ (type-check + Vite library mode + .d.ts + styles.css)
	$(NPM) run build

pack: ## Build, then list what npm would publish
	$(NPM) run build && $(NPM) pack --dry-run

# ==============================
# Maintenance
# ==============================

clean: ## Remove build artifacts and caches
	rm -rf dist playground/dist test-results playwright-report .vitest

help: ## Show this help menu
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'

.PHONY: default lint lint-eslint type-check test e2e format-branch format-branch-check check dev build pack clean help
