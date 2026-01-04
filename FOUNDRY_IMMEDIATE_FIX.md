# 🔧 Foundry Installation - Quick Fix

## Problem
```
Foundry (forge) not installed on server
```

## Solution (Choose One)

### ✨ Option 1: Using Simple Script (Recommended)
```bash
bash install-foundry-simple.sh
```

### Option 2: Manual Steps
```bash
# Step 1: Download foundryup installer
curl -L https://foundry.paradigm.xyz | bash

# Step 2: Add to PATH
export PATH="$HOME/.foundry/bin:$PATH"

# Step 3: Install Foundry
$HOME/.foundry/bin/foundryup

# Step 4: Verify
$HOME/.foundry/bin/forge --version
```

### Option 3: For macOS
```bash
brew install foundry
```

---

## After Installation

### Option A: Restart Terminal
Close and reopen your terminal, then:
```bash
npm run start:dev
```

### Option B: Reload PATH Now
```bash
source ~/.bashrc
npm run start:dev
```

### Option C: Use Full Path
```bash
~/.foundry/bin/forge --version
npm run start:dev
```

---

## Verify It Works

```bash
# Check if forge is available
which forge

# Should output something like:
# /home/codespace/.foundry/bin/forge

# Check version
forge --version

# Should output:
# forge 0.2.0 (or newer)
```

---

## If Still Not Working

### Issue: "Command not found: foundry"
```bash
# Use full path
$HOME/.foundry/bin/foundryup
```

### Issue: "Permission denied"
```bash
chmod +x $HOME/.foundry/bin/forge
chmod +x $HOME/.foundry/bin/foundryup
```

### Issue: Still can't find forge
```bash
# Check if directory exists
ls -la ~/.foundry/bin/

# If empty, try again:
$HOME/.foundry/bin/foundryup
```

---

## Next Steps

1. **Install:** `bash install-foundry-simple.sh`
2. **Restart:** Close and reopen terminal (or `source ~/.bashrc`)
3. **Verify:** `forge --version`
4. **Run:** `npm run start:dev`
5. **Deploy:** Admin Dashboard → Deploy Lottery

---

**Need more help?** See [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md)
