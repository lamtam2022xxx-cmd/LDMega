#!/usr/bin/env bash

# ==============================================================================
# LDMega - Master Deployment & Connection Dispatcher (deploy.sh)
# Điều phối đẩy code đến đúng nơi: Google Apps Script, Cloudflare (BE / FE)
# ==============================================================================

set -e

# Đảm bảo Node & npm từ NVM được nhận diện
export PATH="/Users/sontran/.nvm/versions/node/v24.18.0/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

GREEN="\033[0;32m"
BLUE="\033[0;34m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
NC="\033[0m"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

print_header() {
    echo -e "${CYAN}======================================================${NC}"
    echo -e "${CYAN}🚀 LDMega - Master Deployment & Connection Dispatcher${NC}"
    echo -e "${CYAN}======================================================${NC}"
}

deploy_gas() {
    echo -e "${BLUE}▶ Đang chuẩn bị đẩy code lên Google Apps Script (GAS)...${NC}"
    cd "$ROOT_DIR/apps_script"
    if [ ! -f ".clasp.json" ]; then
        echo -e "${YELLOW}⚠️ Chưa tìm thấy apps_script/.clasp.json!${NC}"
        echo "Hãy sao chép file .clasp.json.example thành .clasp.json và điền scriptId dự án của bạn."
        exit 1
    fi
    npx @google/clasp push
    echo -e "${GREEN}✅ Đã deploy thành công lên Google Apps Script!${NC}"
}

deploy_cf_be() {
    echo -e "${BLUE}▶ Đang chuẩn bị deploy Cloudflare Worker (Backend)...${NC}"
    cd "$ROOT_DIR/cloudflare/backend"
    npx wrangler deploy
    echo -e "${GREEN}✅ Đã deploy thành công Cloudflare Worker Backend!${NC}"
}

deploy_cf_fe() {
    echo -e "${BLUE}▶ Đang chuẩn bị deploy Cloudflare Pages (Frontend)...${NC}"
    cd "$ROOT_DIR/cloudflare/frontend"
    npx wrangler pages deploy public --project-name ldmega-frontend
    echo -e "${GREEN}✅ Đã deploy thành công Cloudflare Pages Frontend!${NC}"
}

run_tests() {
    echo -e "${BLUE}▶ Đang kiểm tra toàn bộ 5 kết nối trong thư mục Conection...${NC}"
    python3 "$ROOT_DIR/Conection/test_connections.py"
}

show_status() {
    print_header
    echo -e "${YELLOW}📍 DANH MỤC THƯ MỤC & ĐIỂM ĐẾN DEPLOY:${NC}"
    echo -e "  1. [apps_script/]          -> ${GREEN}Google Apps Script${NC} (doGet, doPost, Drive, Sheets)"
    echo -e "  2. [cloudflare/backend/]   -> ${GREEN}Cloudflare Worker${NC} (Edge API, Telegram Webhook, Groq)"
    echo -e "  3. [cloudflare/frontend/]  -> ${GREEN}Cloudflare Pages${NC} (Dashboard Web App)"
    echo -e "  4. [Conection/]            -> ${GREEN}5 Dịch vụ sẵn sàng${NC} (Groq, Drive, Telegram, CF, GAS)"
    echo -e "  5. [HR/]                   -> ${GREEN}Module Quản lý Nhân sự${NC}"
    echo -e "  6. [AutoSync/]             -> ${GREEN}Tự động đồng bộ Git${NC}"
    echo ""
}

show_menu() {
    print_header
    echo "Chọn thao tác bạn muốn thực hiện:"
    echo -e "  ${GREEN}1)${NC} Đẩy code lên Google Apps Script (clasp push)"
    echo -e "  ${GREEN}2)${NC} Deploy Cloudflare Worker (Backend API)"
    echo -e "  ${GREEN}3)${NC} Deploy Cloudflare Pages (Frontend Dashboard)"
    echo -e "  ${GREEN}4)${NC} Deploy CẢ HAI: Cloudflare Backend + Frontend"
    echo -e "  ${GREEN}5)${NC} Kiểm tra tình trạng 5 dịch vụ kết nối (Conection)"
    echo -e "  ${GREEN}6)${NC} Thoát"
    echo ""
    read -p "Nhập lựa chọn của bạn [1-6]: " choice
    case $choice in
        1) deploy_gas ;;
        2) deploy_cf_be ;;
        3) deploy_cf_fe ;;
        4) deploy_cf_be && deploy_cf_fe ;;
        5) run_tests ;;
        6) echo "Tạm biệt!"; exit 0 ;;
        *) echo -e "${RED}Lựa chọn không hợp lệ.${NC}"; exit 1 ;;
    esac
}

# Xử lý theo tham số dòng lệnh
TARGET="$1"
case "$TARGET" in
    gas|apps_script)
        deploy_gas
        ;;
    cf-be|cf:be|worker)
        deploy_cf_be
        ;;
    cf-fe|cf:fe|pages)
        deploy_cf_fe
        ;;
    cf-all|cf:all)
        deploy_cf_be
        deploy_cf_fe
        ;;
    test|tests)
        run_tests
        ;;
    status)
        show_status
        ;;
    "")
        show_menu
        ;;
    *)
        echo -e "${RED}Tham số không hợp lệ: $TARGET${NC}"
        echo "Cách sử dụng:"
        echo "  ./deploy.sh gas        # Đẩy lên Google Apps Script"
        echo "  ./deploy.sh cf-be      # Đẩy lên Cloudflare Worker (BE)"
        echo "  ./deploy.sh cf-fe      # Đẩy lên Cloudflare Pages (FE)"
        echo "  ./deploy.sh cf-all     # Đẩy cả BE và FE Cloudflare"
        echo "  ./deploy.sh test       # Kiểm tra 5 kết nối trong Conection"
        echo "  ./deploy.sh status     # Xem bản đồ các thư mục deploy"
        exit 1
        ;;
esac
