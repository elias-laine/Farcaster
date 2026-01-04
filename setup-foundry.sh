#!/bin/bash
# setup-foundry.sh - Automatic Foundry installation script

set -e

echo "🚀 Installing Foundry..."

# Check if foundryup is already installed
if command -v foundryup &> /dev/null; then
    echo "✅ foundryup already exists, updating..."
    foundryup
else
    echo "📥 Downloading Foundry installer..."
    curl -L https://foundry.paradigm.xyz | bash
    
    # Source the new PATH
    echo "⚙️  Setting up PATH..."
    export PATH="$PATH:$HOME/.foundry/bin"
    
    # Update shell configuration
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q ".foundry/bin" "$HOME/.bashrc"; then
            echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> "$HOME/.bashrc"
        fi
    fi
    
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q ".foundry/bin" "$HOME/.zshrc"; then
            echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> "$HOME/.zshrc"
        fi
    fi
    
    echo "📦 Installing Foundry toolchain..."
    foundryup
fi

# Verify installation
echo "🔍 Verifying installation..."
if forge --version; then
    echo "✨ Foundry installed successfully!"
    echo ""
    echo "forge version:"
    forge --version
else
    echo "❌ Installation failed. Please check the output above."
    exit 1
fi

echo ""
echo "✅ Foundry setup complete!"
echo "📝 To deploy contracts, use the admin panel in the app."
echo ""
echo "If 'forge' command is not found in your terminal:"
echo "  - Restart your terminal/shell"
echo "  - Or source your shell config: source ~/.bashrc"
