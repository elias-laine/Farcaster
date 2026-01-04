# 🔧 Foundry Installation & Deployment Guide

## Quick Summary

If you see this error when trying to deploy contracts:
```json
{
  "success": false,
  "message": "Foundry (forge) not installed on server"
}
```

**Solution:** Install Foundry using the setup script:

```bash
# From the project root directory
bash setup-foundry.sh
```

Then restart your dev server:
```bash
npm run start:dev
```

---

## What is Foundry?

Foundry is a professional toolkit for Ethereum smart contract development. The deployment system uses Foundry's `forge` command to:

1. **Compile** Solidity smart contracts
2. **Deploy** contracts to the Base blockchain
3. **Broadcast** transactions and return contract addresses

Without Foundry, the deployment feature cannot work.

---

## Installation Methods

### ✨ Method 1: Automatic Setup (Recommended)

```bash
# From project root
bash setup-foundry.sh
```

The script will:
- Download Foundry
- Install it to `~/.foundry/bin`
- Update your PATH
- Verify installation

### 🔧 Method 2: Manual Installation

**On Linux/WSL:**
```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

**On macOS:**
```bash
brew install foundry
```

**With Rust (if installed):**
```bash
cargo install --git https://github.com/foundry-rs/foundry foundry-cli --locked
```

### 📦 Method 3: Docker (if using containers)

If running in a Docker environment, add to your Dockerfile:
```dockerfile
RUN curl -L https://foundry.paradigm.xyz | bash && \
    source ~/.bashrc && \
    foundryup
```

---

## Verify Installation

After installing, confirm Foundry is working:

```bash
# Check if forge is available
which forge

# Check version (should be 0.2.0 or higher)
forge --version

# Quick test
forge --help
```

Expected output:
```
/home/user/.foundry/bin/forge
forge 0.2.0
...forge commands...
```

---

## Troubleshooting

### Issue: "Command not found: forge"

**Solution 1:** Update your PATH
```bash
export PATH="$PATH:$HOME/.foundry/bin"
echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> ~/.bashrc
source ~/.bashrc
```

**Solution 2:** Restart your terminal
- The installation added Foundry to your PATH
- Close and reopen your terminal or IDE

**Solution 3:** Check shell configuration
```bash
# For bash
cat ~/.bashrc | grep foundry

# For zsh
cat ~/.zshrc | grep foundry
```

### Issue: Installation fails

**Check prerequisites:**
```bash
# Make sure curl is available
which curl

# Check internet connection
ping github.com
```

**Try manual installation:**
```bash
# 1. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Source Rust
source "$HOME/.cargo/env"

# 3. Install Foundry
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

### Issue: Permission denied

```bash
# Make scripts executable
chmod +x ~/.foundry/bin/forge
chmod +x ~/.foundry/bin/foundryup

# Or reinstall
rm -rf ~/.foundry
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

### Issue: In GitHub Codespaces

```bash
# 1. Open a new terminal (⌃ + ~)
# 2. Run setup script
bash setup-foundry.sh

# 3. Restart dev server
npm run start:dev
```

---

## After Installation

### Step 1: Verify Setup
```bash
forge --version
```

### Step 2: Check Environment Variables
Make sure your `.env` has:
```env
# Required
PRIVATE_KEY=0x...        # Your deployer's private key
SIGNER_ADDRESS=0x...     # Your deployer's wallet address

# Optional (defaults are provided)
BASE_RPC_URL=https://...  # Base network RPC endpoint
```

### Step 3: Deploy Contracts
1. Go to Admin Dashboard in your app
2. Click "Deploy New Lottery"
3. Fill in deadline and prize tiers
4. Click "Deploy Lottery Contract"

---

## Common Issues After Installation

### Deploy fails with "Signer not found"
Make sure `PRIVATE_KEY` is set:
```bash
# Check .env file
cat .env | grep PRIVATE_KEY
```

### Deploy fails with "Invalid chain ID"
Ensure you're using the correct RPC URL for Base:
```env
BASE_RPC_URL=https://mainnet.base.org  # Base Mainnet
# or
BASE_RPC_URL=https://sepolia.base.org  # Base Sepolia (testnet)
```

### Deploy shows weird output
Check the deployment logs:
```bash
# In your terminal where dev server is running
npm run start:dev
# Look for detailed error messages
```

---

## Learning Foundry

Foundry is powerful! Here are some useful commands:

```bash
# Initialize a new project
forge init my-project

# Compile contracts
cd contracts && forge build

# Run tests
forge test

# Get contract info
forge inspect ContractName

# See more commands
forge --help
```

**Official Foundry Book:** https://book.getfoundry.sh/

---

## Files Reference

| File | Purpose |
|------|---------|
| `setup-foundry.sh` | Automatic Foundry installation script |
| `FOUNDRY_QUICK_FIX.md` | Quick troubleshooting guide |
| `FOUNDRY_SETUP.md` | Detailed setup documentation |
| `DEPLOYMENT_IMPROVEMENTS.md` | Deployment form features |
| `contracts/script/Deploy.s.sol` | Deployment script (uses Foundry) |

---

## Next Steps

1. **Install Foundry:**
   ```bash
   bash setup-foundry.sh
   ```

2. **Restart dev server:**
   ```bash
   npm run start:dev
   ```

3. **Go to Admin Dashboard** and deploy your first contract!

---

## Support

If you're still having issues:

1. **Check logs:** Look at terminal output when running `npm run start:dev`
2. **Check PATH:** Run `echo $PATH` and verify `~/.foundry/bin` is included
3. **Check version:** Run `forge --version`
4. **Check documentation:** See `FOUNDRY_QUICK_FIX.md` for quick fixes

---

**Ready to deploy? 🚀**

Run `bash setup-foundry.sh` and you're good to go!
