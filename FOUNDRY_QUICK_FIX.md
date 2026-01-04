# 🛠️ Quick Fix: Foundry Not Installed Error

## The Problem
When you click "Deploy Lottery Contract", you see:
```json
{
  "success": false,
  "message": "Foundry (forge) not installed on server"
}
```

## The Solution (Choose One)

### ✨ Method 1: Automatic Installation (Easiest)

Run the setup script from the project root:

```bash
bash setup-foundry.sh
```

This will automatically:
- Download Foundry
- Install it
- Configure your PATH
- Verify everything works

Then restart your dev server:
```bash
npm run start:dev
```

### 🔧 Method 2: Manual Installation

Open a new terminal and run:

```bash
# Step 1: Install foundryup
curl -L https://foundry.paradigm.xyz | bash

# Step 2: Update your shell
source ~/.bashrc

# Step 3: Install Foundry
foundryup
```

### 📦 Method 3: Using Package Manager

**For macOS:**
```bash
brew install foundry
```

**For Linux (Ubuntu/Debian):**
You may need to install Rust first:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.bashrc
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

## ✅ Verify Installation

After installation, check that forge works:

```bash
forge --version
```

You should see something like: `forge 0.2.0`

## 🚀 Deploy Again

1. Start the dev server:
```bash
npm run start:dev
```

2. Go to Admin Dashboard → Deploy New Lottery

3. Fill in the form and click "Deploy Lottery Contract"

## 🆘 Still Not Working?

### Forge command not found
Try these steps:
```bash
# Add to PATH manually
export PATH="$PATH:$HOME/.foundry/bin"

# Make it permanent
echo 'export PATH="$PATH:$HOME/.foundry/bin"' >> ~/.bashrc

# Source the file
source ~/.bashrc
```

### Permission issues
```bash
# Make foundryup executable
chmod +x ~/.foundry/bin/foundryup
```

### In GitHub Codespaces or cloud environment
1. Open a **new terminal**
2. Run `foundryup`
3. Restart your development server

## 📚 What is Foundry?

Foundry is a professional toolkit for building Ethereum apps. The deployment process uses Foundry to:

1. **Compile** your Solidity smart contracts ✓
2. **Deploy** them to Base network ✓  
3. **Return** the contract address ✓

## 💡 Pro Tips

- After installing, you can also use Foundry from the command line:
  ```bash
  # Create a new Foundry project
  forge init my-project
  
  # Compile contracts
  cd contracts && forge build
  
  # Run tests
  forge test
  ```

- For detailed Foundry docs: https://book.getfoundry.sh/

## 📞 Need More Help?

Check the full documentation:
- [FOUNDRY_SETUP.md](./FOUNDRY_SETUP.md) - Detailed setup guide
- [DEPLOYMENT_IMPROVEMENTS.md](./DEPLOYMENT_IMPROVEMENTS.md) - Deployment features
- [RUN_GUIDE.md](./RUN_GUIDE.md) - Project setup

---

**Ready to deploy?** Run the setup script and you'll be good to go! 🎉
