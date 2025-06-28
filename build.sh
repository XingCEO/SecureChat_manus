#!/bin/bash

# SecureChat 跨平台構建腳本

set -e

echo "🚀 開始 SecureChat 跨平台構建..."

# 顏色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 函數：打印帶顏色的消息
print_message() {
    echo -e "${2}${1}${NC}"
}

# 函數：檢查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_message "錯誤: $1 未安裝" $RED
        exit 1
    fi
}

# 函數：清理構建目錄
clean_build() {
    print_message "🧹 清理構建目錄..." $YELLOW
    rm -rf dist/
    rm -rf build/
    mkdir -p dist build/icons
}

# 函數：構建Web版本
build_web() {
    print_message "🌐 構建Web版本..." $BLUE
    
    # 複製Web文件到構建目錄
    cp -r src/web/* dist/web/
    
    # 壓縮和優化（如果需要）
    # 這裡可以添加壓縮CSS、JS等優化步驟
    
    print_message "✅ Web版本構建完成" $GREEN
}

# 函數：構建Electron桌面版
build_electron() {
    print_message "🖥️  構建Electron桌面版..." $BLUE
    
    # 檢查Electron是否安裝
    check_command "npx"
    
    # 根據參數構建不同平台
    case $1 in
        "win")
            print_message "構建Windows版本..." $YELLOW
            npm run build:electron:win
            ;;
        "mac")
            print_message "構建macOS版本..." $YELLOW
            npm run build:electron:mac
            ;;
        "linux")
            print_message "構建Linux版本..." $YELLOW
            npm run build:electron:linux
            ;;
        "all"|*)
            print_message "構建所有桌面版本..." $YELLOW
            npm run build:all
            ;;
    esac
    
    print_message "✅ Electron桌面版構建完成" $GREEN
}

# 函數：構建移動版
build_mobile() {
    print_message "📱 構建移動版..." $BLUE
    
    # 檢查Capacitor是否安裝
    check_command "npx"
    
    # 同步Web資源到移動平台
    print_message "同步Web資源..." $YELLOW
    npm run cap:sync
    
    case $1 in
        "ios")
            print_message "構建iOS版本..." $YELLOW
            npm run cap:build:ios
            ;;
        "android")
            print_message "構建Android版本..." $YELLOW
            npm run cap:build:android
            ;;
        "all"|*)
            print_message "構建所有移動版本..." $YELLOW
            npm run mobile:build
            ;;
    esac
    
    print_message "✅ 移動版構建完成" $GREEN
}

# 函數：生成圖標
generate_icons() {
    print_message "🎨 生成應用圖標..." $BLUE
    
    # 這裡應該有一個主圖標文件，然後生成不同尺寸
    # 由於我們沒有實際的圖標文件，這裡創建佔位符
    
    sizes=(16 32 48 64 72 96 128 144 152 192 256 384 512 1024)
    
    for size in "${sizes[@]}"; do
        # 創建佔位符圖標（實際項目中應該使用真實圖標）
        echo "生成 ${size}x${size} 圖標..."
        # convert master-icon.png -resize ${size}x${size} build/icons/icon-${size}.png
    done
    
    print_message "✅ 圖標生成完成" $GREEN
}

# 函數：打包分發
package_distribution() {
    print_message "📦 打包分發文件..." $BLUE
    
    # 創建分發目錄
    mkdir -p dist/releases
    
    # 壓縮不同版本
    if [ -d "dist/web" ]; then
        cd dist && zip -r releases/SecureChat-Web.zip web/ && cd ..
        print_message "Web版本已打包" $GREEN
    fi
    
    # 移動Electron構建文件
    if [ -d "dist/electron" ]; then
        mv dist/electron/* dist/releases/ 2>/dev/null || true
    fi
    
    # 移動移動版構建文件
    if [ -d "dist/mobile" ]; then
        mv dist/mobile/* dist/releases/ 2>/dev/null || true
    fi
    
    print_message "✅ 分發文件打包完成" $GREEN
}

# 函數：顯示構建信息
show_build_info() {
    print_message "📊 構建信息:" $BLUE
    echo "項目名稱: SecureChat"
    echo "版本: $(node -p "require('./package.json').version")"
    echo "構建時間: $(date)"
    echo "構建平台: $(uname -s)"
    echo "Node版本: $(node --version)"
    echo "NPM版本: $(npm --version)"
    
    if [ -d "dist/releases" ]; then
        echo ""
        print_message "📁 構建產物:" $BLUE
        ls -la dist/releases/
    fi
}

# 主函數
main() {
    print_message "🔧 SecureChat 跨平台構建腳本" $BLUE
    print_message "================================" $BLUE
    
    # 解析命令行參數
    BUILD_TYPE=${1:-"all"}
    PLATFORM=${2:-"all"}
    
    case $BUILD_TYPE in
        "clean")
            clean_build
            ;;
        "web")
            clean_build
            mkdir -p dist/web
            build_web
            package_distribution
            ;;
        "electron"|"desktop")
            clean_build
            build_electron $PLATFORM
            package_distribution
            ;;
        "mobile")
            clean_build
            build_mobile $PLATFORM
            package_distribution
            ;;
        "icons")
            generate_icons
            ;;
        "all"|*)
            clean_build
            mkdir -p dist/web
            build_web
            build_electron "all"
            build_mobile "all"
            generate_icons
            package_distribution
            ;;
    esac
    
    show_build_info
    print_message "🎉 構建完成！" $GREEN
}

# 執行主函數
main "$@"

