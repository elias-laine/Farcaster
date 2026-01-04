# 🚀 راهنمای اجرای Farcaster App در Codespaces

## ✅ متغیرهای محلی آماده هستند!

فایل `.env.local` شما تمام متغیرهای لازم را دارد:
- ✅ NEYNAR_API_KEY
- ✅ SIGNER_PRIVATE_KEY
- ✅ CAST_HASH
- ✅ TARGET_FID
- ✅ CONTRACT_ADDRESS
- ✅ RPC_URL

## 🎯 اجرای App

### **گزینه 1: استفاده از ترمینال مستقیم**

باز کنید **Terminal** در VS Code (Ctrl + ` یا View → Terminal)

سپس اجرا کنید:
```bash
cd /workspaces/codespaces-blank/Farcaster
npm run dev
```

### **گزینه 2: استفاده از Script**

```bash
chmod +x /workspaces/codespaces-blank/Farcaster/start-dev.sh
bash /workspaces/codespaces-blank/Farcaster/start-dev.sh
```

### **گزینه 3: مستقیم tsx**

```bash
cd /workspaces/codespaces-blank/Farcaster
NODE_ENV=development npx tsx server/index.ts
```

## 📱 دسترسی به App

بعد از اجرا:

1. **Ports Tab** را باز کنید (اگر بسته شده باشد)
   - View → Terminal → Select "Ports" tab

2. Port **5000** یا **5173** را ببینید

3. روی آن کلیک کنید یا:
   - **Local**: `http://localhost:5000`
   - **Codespaces**: `https://<codespace-name>-5000.app.github.dev`

## ⚡ چه چیزی اجرا می‌شود؟

```
📦 Server (Express) → Port 5000
   ├── API Endpoints
   │   ├── /api/app-config
   │   ├── /api/user-progress
   │   ├── /api/verify-task
   │   ├── /api/mint-signature
   │   ├── /api/confirm-mint
   │   ├── /api/lottery-stats
   │   └── /api/admin/participants
   │
   └── Client (Vite) → Served from /
       ├── Home Page (Tasks)
       ├── Admin Page (Lottery Control)
       └── Farcaster Frame Support

🔗 Blockchain Connection:
   └── Base Mainnet (Chain ID: 8453)
       └── RPC: Alchemy
```

## 🐛 اگر مشکل داشتید:

**خطای "Command not found":**
```bash
npm install
npm run dev
```

**خطای Port در حال استفاده:**
```bash
lsof -i :5000
kill -9 <PID>
```

**Clear node_modules:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 🔧 برای Deploy Contracts (Admin Only)

### اگر "Foundry not installed" خطا دیدید:

```bash
# نصب Foundry (خودکار)
bash setup-foundry.sh

# یا دستی
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

سپس dev server را restart کنید:
```bash
npm run start:dev
```

📚 بیشتر در:
- [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md) - حل سریع
- [FOUNDRY_INSTALLATION.md](./FOUNDRY_INSTALLATION.md) - راهنمای کامل

## 🎮 تست Features
rm -rf node_modules package-lock.json
npm install
npm run dev
```

## 🎮 تست Features

1. **Home Page** - Task verification
   - Like cast
   - Recast
   - Follow @book

2. **Mint SBT** - اگر تمام tasks تکمیل شدند
   - Get signature
   - Send transaction
   - Confirm mint

3. **Admin Page** - اگر owner باشید
   - View participants
   - Execute lottery
   - See winners

---

**موفق باشید! 🚀**
