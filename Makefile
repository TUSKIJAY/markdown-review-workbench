APP_DIR := src/app
NPM := npm

.PHONY: help install dev build build-html preview tauri-dev tauri-build-no-bundle

help:
	@echo "Available targets:"
	@echo "  make install                Install frontend dependencies"
	@echo "  make dev                    Start Vite dev server on port 5174"
	@echo "  make build                  Run TypeScript check and Vite build"
	@echo "  make build-html             Build single-file HTML output"
	@echo "  make preview                Preview built frontend"
	@echo "  make tauri-dev              Start Tauri dev mode"
	@echo "  make tauri-build-no-bundle  Build Tauri release without MSI/NSIS bundles"

install:
	cd $(APP_DIR) && $(NPM) install

dev:
	cd $(APP_DIR) && $(NPM) run dev -- --port 5174

build:
	cd $(APP_DIR) && $(NPM) run build

build-html:
	cd $(APP_DIR) && $(NPM) run build:html

preview:
	cd $(APP_DIR) && $(NPM) run preview

tauri-dev:
	cd $(APP_DIR) && $(NPM) run tauri:dev

tauri-build-no-bundle:
	cd $(APP_DIR) && $(NPM) run tauri:build -- --no-bundle
