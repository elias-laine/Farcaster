#!/bin/bash
# install-foundry-simple.sh - ساده و مطمئن

set -e

echo "🚀 نصب Foundry شروع می‌شود..."

# Step 1: دانلود foundryup
echo "📥 دانلود Foundry installer..."
if ! curl -L https://foundry.paradigm.xyz | bash; then
    echo "❌ دانلود ناموفق"
    exit 1
fi

# Step 2: PATH را تنظیم کنید
echo "⚙️  تنظیم PATH..."
export PATH="$HOME/.foundry/bin:$PATH"

# Step 3: bashrc را به‌روز کنید
if [ -f "$HOME/.bashrc" ]; then
    if ! grep -q ".foundry/bin" "$HOME/.bashrc"; then
        echo 'export PATH="$HOME/.foundry/bin:$PATH"' >> "$HOME/.bashrc"
        echo "✅ .bashrc به‌روز شد"
    fi
fi

# Step 4: foundryup اجرا کنید (نصب واقعی)
echo "📦 نصب Foundry toolchain..."
if ! "$HOME/.foundry/bin/foundryup"; then
    echo "❌ foundryup ناموفق"
    exit 1
fi

# Step 5: بررسی
echo ""
echo "🔍 بررسی نصب..."
if "$HOME/.foundry/bin/forge" --version; then
    echo "✨ Foundry نصب شد!"
else
    echo "❌ بررسی ناموفق"
    exit 1
fi

echo ""
echo "✅ تمام شد! حالا:"
echo "   1. Terminal را بستید و دوباره باز کنید"
echo "   2. یا: source ~/.bashrc"
echo "   3. سپس: npm run start:dev"
