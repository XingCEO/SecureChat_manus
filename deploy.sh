#!/bin/bash

# SecureChat 自動部署腳本

set -e

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置變數
PROJECT_NAME="SecureChat"
GITHUB_REPO="https://github.com/your-username/securechat.git"
NETLIFY_SITE_ID="your-netlify-site-id"
RENDER_SERVICE_ID="your-render-service-id"

# 函數：打印帶顏色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 函數：檢查必要工具
check_dependencies() {
    print_message "🔍 檢查部署依賴..." $BLUE
    
    local tools=("git" "node" "npm" "curl")
    for tool in "${tools[@]}"; do
        if ! command -v $tool &> /dev/null; then
            print_message "錯誤: $tool 未安裝" $RED
            exit 1
        fi
    done
    
    print_message "✅ 所有依賴檢查通過" $GREEN
}

# 函數：檢查環境變數
check_environment() {
    print_message "🔧 檢查環境變數..." $BLUE
    
    local required_vars=(
        "DATABASE_URL"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
    )
    
    local missing_vars=()
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        print_message "錯誤: 缺少環境變數: ${missing_vars[*]}" $RED
        print_message "請設置這些環境變數後重試" $YELLOW
        exit 1
    fi
    
    print_message "✅ 環境變數檢查通過" $GREEN
}

# 函數：運行測試
run_tests() {
    print_message "🧪 運行測試..." $BLUE
    
    # 後端測試
    if [[ -f "server/package.json" ]]; then
        cd server
        if npm list --depth=0 | grep -q "jest\|mocha\|tap"; then
            npm test
        else
            print_message "⚠️  未找到測試框架，跳過後端測試" $YELLOW
        fi
        cd ..
    fi
    
    # 前端測試
    if npm list --depth=0 | grep -q "jest\|cypress\|playwright"; then
        npm test
    else
        print_message "⚠️  未找到前端測試框架，跳過前端測試" $YELLOW
    fi
    
    print_message "✅ 測試完成" $GREEN
}

# 函數：構建項目
build_project() {
    print_message "🔨 構建項目..." $BLUE
    
    # 安裝依賴
    npm install
    cd server && npm install && cd ..
    
    # 構建前端
    print_message "構建前端..." $YELLOW
    npm run build:web
    
    # 構建後端（如果需要）
    if [[ -f "server/build.js" ]]; then
        print_message "構建後端..." $YELLOW
        cd server && npm run build && cd ..
    fi
    
    print_message "✅ 項目構建完成" $GREEN
}

# 函數：部署到 Netlify
deploy_frontend() {
    print_message "🌐 部署前端到 Netlify..." $BLUE
    
    if [[ -z "$NETLIFY_AUTH_TOKEN" ]]; then
        print_message "錯誤: 未設置 NETLIFY_AUTH_TOKEN" $RED
        return 1
    fi
    
    # 安裝 Netlify CLI（如果未安裝）
    if ! command -v netlify &> /dev/null; then
        npm install -g netlify-cli
    fi
    
    # 部署到 Netlify
    netlify deploy --prod --dir=src/web --site=$NETLIFY_SITE_ID --auth=$NETLIFY_AUTH_TOKEN
    
    print_message "✅ 前端部署完成" $GREEN
}

# 函數：部署到 Render
deploy_backend() {
    print_message "🖥️  部署後端到 Render..." $BLUE
    
    if [[ -z "$RENDER_API_KEY" ]]; then
        print_message "錯誤: 未設置 RENDER_API_KEY" $RED
        return 1
    fi
    
    # 觸發 Render 部署
    curl -X POST \
        -H "Authorization: Bearer $RENDER_API_KEY" \
        -H "Content-Type: application/json" \
        "https://api.render.com/v1/services/$RENDER_SERVICE_ID/deploys" \
        -d '{"clearCache": false}'
    
    print_message "✅ 後端部署觸發完成" $GREEN
}

# 函數：設置資料庫
setup_database() {
    print_message "🗄️  設置資料庫..." $BLUE
    
    if [[ -z "$DATABASE_URL" ]]; then
        print_message "錯誤: 未設置 DATABASE_URL" $RED
        return 1
    fi
    
    # 運行資料庫遷移
    if [[ -f "server/migrations" ]]; then
        cd server
        npm run migrate
        cd ..
    elif [[ -f "server/database.sql" ]]; then
        print_message "請手動在 Supabase 中執行 database.sql" $YELLOW
    fi
    
    print_message "✅ 資料庫設置完成" $GREEN
}

# 函數：健康檢查
health_check() {
    print_message "🏥 進行健康檢查..." $BLUE
    
    local frontend_url="https://your-app.netlify.app"
    local backend_url="https://your-api.onrender.com"
    
    # 檢查前端
    if curl -f -s "$frontend_url" > /dev/null; then
        print_message "✅ 前端健康檢查通過" $GREEN
    else
        print_message "❌ 前端健康檢查失敗" $RED
    fi
    
    # 檢查後端
    if curl -f -s "$backend_url/health" > /dev/null; then
        print_message "✅ 後端健康檢查通過" $GREEN
    else
        print_message "❌ 後端健康檢查失敗" $RED
    fi
}

# 函數：發送通知
send_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "$SLACK_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$PROJECT_NAME 部署$status: $message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
    
    if [[ -n "$DISCORD_WEBHOOK_URL" ]]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"$PROJECT_NAME 部署$status: $message\"}" \
            "$DISCORD_WEBHOOK_URL"
    fi
}

# 函數：回滾部署
rollback_deployment() {
    print_message "🔄 回滾部署..." $YELLOW
    
    # 這裡可以實現回滾邏輯
    # 例如回滾到上一個 Git 提交或之前的部署版本
    
    print_message "⚠️  請手動檢查並回滾部署" $YELLOW
}

# 函數：清理資源
cleanup() {
    print_message "🧹 清理臨時資源..." $BLUE
    
    # 清理構建文件
    rm -rf dist/ build/ .cache/
    
    # 清理日誌文件
    find . -name "*.log" -type f -delete
    
    print_message "✅ 清理完成" $GREEN
}

# 主部署函數
deploy() {
    local deploy_type=${1:-"full"}
    
    print_message "🚀 開始 $PROJECT_NAME 部署..." $BLUE
    print_message "部署類型: $deploy_type" $BLUE
    print_message "時間: $(date)" $BLUE
    print_message "================================" $BLUE
    
    # 設置錯誤處理
    trap 'echo "部署失敗，正在清理..."; cleanup; exit 1' ERR
    
    case $deploy_type in
        "frontend"|"web")
            check_dependencies
            build_project
            deploy_frontend
            ;;
        "backend"|"api")
            check_dependencies
            check_environment
            run_tests
            deploy_backend
            setup_database
            ;;
        "full"|*)
            check_dependencies
            check_environment
            run_tests
            build_project
            deploy_frontend
            deploy_backend
            setup_database
            health_check
            ;;
    esac
    
    cleanup
    
    local end_time=$(date)
    print_message "🎉 部署成功完成！" $GREEN
    print_message "完成時間: $end_time" $GREEN
    
    send_notification "成功" "部署於 $end_time 完成"
}

# 函數：顯示幫助信息
show_help() {
    echo "SecureChat 部署腳本"
    echo ""
    echo "用法: $0 [選項] [部署類型]"
    echo ""
    echo "部署類型:"
    echo "  full      - 完整部署 (默認)"
    echo "  frontend  - 僅部署前端"
    echo "  backend   - 僅部署後端"
    echo ""
    echo "選項:"
    echo "  -h, --help     - 顯示此幫助信息"
    echo "  -t, --test     - 僅運行測試"
    echo "  -b, --build    - 僅構建項目"
    echo "  -c, --check    - 僅進行健康檢查"
    echo "  -r, --rollback - 回滾部署"
    echo ""
    echo "環境變數:"
    echo "  DATABASE_URL        - 資料庫連接字符串"
    echo "  JWT_SECRET          - JWT 密鑰"
    echo "  ENCRYPTION_KEY      - 加密密鑰"
    echo "  NETLIFY_AUTH_TOKEN  - Netlify 認證令牌"
    echo "  RENDER_API_KEY      - Render API 密鑰"
    echo "  SLACK_WEBHOOK_URL   - Slack 通知 Webhook"
    echo "  DISCORD_WEBHOOK_URL - Discord 通知 Webhook"
}

# 解析命令行參數
case ${1:-} in
    -h|--help)
        show_help
        exit 0
        ;;
    -t|--test)
        run_tests
        exit 0
        ;;
    -b|--build)
        build_project
        exit 0
        ;;
    -c|--check)
        health_check
        exit 0
        ;;
    -r|--rollback)
        rollback_deployment
        exit 0
        ;;
    *)
        deploy "$1"
        ;;
esac

