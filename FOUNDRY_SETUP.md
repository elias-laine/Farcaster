# Foundry Installation Guide

## Problem
When clicking the "Deploy Lottery Contract" button, you receive the error:
```json
{
  "success": false,
  "message": "Foundry (forge) not installed on server"
}
```

This happens because the backend uses Foundry's `forge` tool to deploy smart contracts.

## Solution: Install Foundry

### Option 1: Quick Install (Recommended)

Run these commands in your terminal:

```bash
# Install foundryup (the installer)
curl -L https://foundry.paradigm.xyz | bash

# Load the new PATH
source ~/.bashrc

# Install Foundry
foundryup
```

After installation, verify it worked:
```bash
forge --version
```

### Option 2: Using Cargo (If you have Rust)

If Rust is already installed on your system:

```bash
cargo install --git https://github.com/foundry-rs/foundry foundry-cli --locked
```

### Option 3: For macOS (Homebrew)

If you're on macOS:

```bash
brew install foundry
```

## Verification

After installation, confirm Foundry is working:

```bash
# Check if forge is available
which forge

# Check version
forge --version

# Try to run a simple command
forge --help
```

## Environment Variables Needed

Make sure your `.env` file has:

```env
# Required for deployment
PRIVATE_KEY=0x...          # Your deployer's private key (without 0x or with it)
SIGNER_ADDRESS=0x...      # Signer wallet address

# Optional (for custom RPC)
BASE_RPC_URL=https://...   # Base network RPC URL (defaults to public)

# Lottery parameters (set via API, but can override here)
LOTTERY_DEADLINE=1735689600
```

## Troubleshooting

### Command not found: foundryup
Make sure to source your shell configuration:
```bash
source ~/.bashrc    # for bash
# or
source ~/.zshrc     # for zsh
```

### forge command not found after installation
The Foundry binary may not be in your PATH:
```bash
# Find where foundryup installed foundry
ls ~/.foundry/bin/

# Add to PATH if needed
export PATH="$PATH:$HOME/.foundry/bin"

# Make it permanent by adding to ~/.bashrc or ~/.zshrc
echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> ~/.bashrc
```

### Permission denied when running foundryup
Add executable permissions:
```bash
chmod +x ~/.foundry/bin/foundryup
```

## What Foundry Does

Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.

The deployment process uses the `forge` tool to:
1. Compile your Solidity smart contracts
2. Deploy them to the Base network
3. Return the deployed contract address

## After Installation

Once Foundry is installed:
1. Restart your development server: `npm run start:dev`
2. Try deploying again through the admin panel
3. The deployment should now work!

## Learn More

- Official Foundry Book: https://book.getfoundry.sh/
- GitHub Repository: https://github.com/foundry-rs/foundry
- Discord Community: https://discord.gg/foundry-rs

## Still Having Issues?

1. Run `forge --version` to confirm installation
2. Check that `PRIVATE_KEY` is set correctly in your environment
3. Ensure you have sufficient permissions to execute `forge` command
4. Check server logs for more detailed error messages

If you're in a containerized/cloud environment (like GitHub Codespaces), make sure:
- You have write permissions in the home directory
- The shell is properly sourced
- You may need to restart the terminal or dev container

