.PHONY: help install dev start test lint docker-up docker-down docker-logs db-reset clean

# Default target: display available targets
help:
	@echo "=========================================================="
	@echo "  GIA ĐÌNH XANH - LOCAL DEVELOPMENT & DEVOPS COMMANDS     "
	@echo "=========================================================="
	@echo "  make install      - Cài đặt dependencies chuẩn xác theo lockfile (npm ci)"
	@echo "  make dev          - Chạy ứng dụng chế độ development với hot-reload"
	@echo "  make start        - Chạy ứng dụng chế độ production"
	@echo "  make test         - Chạy toàn bộ bộ kiểm thử tự động (Unit & Integration)"
	@echo "  make lint         - Kiểm tra cú pháp và chất lượng mã nguồn"
	@echo "  make docker-up    - Khởi động toàn bộ container dịch vụ bằng Docker Compose"
	@echo "  make docker-down  - Dừng và gỡ bỏ containers Docker"
	@echo "  make docker-logs  - Theo dõi nhật ký log của container ứng dụng"
	@echo "  make db-reset     - Khôi phục dữ liệu mẫu chuẩn SQL về trạng thái gốc"
	@echo "  make clean        - Dọn dẹp thư mục node_modules và file tạm"
	@echo "=========================================================="

install:
	npm ci

dev:
	npm run dev

start:
	npm start

test:
	npm test

lint:
	npm run lint

docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f app

db-reset:
	curl -s -X POST http://localhost:3000/api/supabase/reset-local

clean:
	rm -rf node_modules
