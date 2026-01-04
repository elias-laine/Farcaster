# 🎯 Foundry Setup - Visual Guide

## 🔄 فلوچارت فرآیند نصب

```
┌─────────────────────────────────────────────────────────┐
│  "Deploy Lottery Contract" کلیک می‌کنید              │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
        ┌────────────────────────┐
        │   Foundry نصب شده؟     │
        └───┬────────────────┬───┘
            │                │
      Yes   │                │  No
            ▼                ▼
    ✅ Deploy    ❌ خطا نمایش
       می‌شود      داده می‌شود
                    │
                    ▼
         "Foundry نصب کنید"
                    │
        ┌───────────┴────────────┐
        │  3 روش نصب:          │
        ├─────────────────────────┤
        │ 1️⃣  خودکار:              │
        │   bash setup-foundry.sh  │
        │                         │
        │ 2️⃣  دستی:                │
        │   curl -L https://...   │
        │                         │
        │ 3️⃣  macOS:               │
        │   brew install foundry  │
        └───────────┬─────────────┘
                    │
                    ▼
      ✅ نصب تمام شد
                    │
                    ▼
      npm run start:dev (Restart)
                    │
                    ▼
            Deploy دوباره کنید
                    │
                    ▼
              ✅ موفق! 🎉
```

## 🛠️ مرحله‌به‌مرحله نصب

### مرحله 1️⃣: نصب Foundry

**گزینه A: خودکار (⭐ توصیه شده)**
```bash
cd ~/your-project
bash setup-foundry.sh
```

**گزینه B: دستی**
```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

**گزینه C: macOS**
```bash
brew install foundry
```

### مرحله 2️⃣: بررسی نصب
```bash
forge --version
# Output: forge 0.2.0 (یا بالاتر)

which forge
# Output: /home/user/.foundry/bin/forge
```

### مرحله 3️⃣: Restart کنید
```bash
npm run start:dev
```

### مرحله 4️⃣: Deploy کنید
Admin → Deploy New Lottery → Submit ✅

---

## 🎯 Error Handling Flow

```
┌──────────────────────────────────┐
│  User clicks "Deploy"            │
└────────────────┬─────────────────┘
                 │
                 ▼
     ┌───────────────────────┐
     │ Backend checks forge  │
     └───┬───────────────┬───┘
         │               │
      Found         Not Found
         │               │
         ▼               ▼
    ✅ Deploy     ❌ Error Response
                  {
                    success: false,
                    message: "Foundry not installed",
                    installGuide: "bash setup-foundry.sh"
                  }
                         │
                         ▼
                  Frontend catches error
                         │
                  ┌──────┴──────┐
                  ▼             ▼
            Toast Alert    Large Alert
            (Quick)      (Detailed)
            │             │
            ▼             ▼
        Dismiss       Show Help Link
```

---

## 📊 System Architecture

```
┌─────────────────────────────────────────┐
│       Admin Dashboard (React)           │
│  ┌─────────────────────────────────┐   │
│  │  Deploy Lottery Form Component  │   │
│  │  ┌───────────────────────────┐  │   │
│  │  │ Form State:               │  │   │
│  │  │ - deadline date/time      │  │   │
│  │  │ - prize tiers             │  │   │
│  │  │ - foundryError (NEW!)     │  │   │
│  │  └───────────────────────────┘  │   │
│  └──────────┬──────────────────────┘   │
│             │ Submit                     │
└─────────────┼─────────────────────────┘
              │
              ▼
    /api/admin/deploy-lottery
    (POST)
              │
              ▼
    ┌─────────────────────────┐
    │   Backend (Express)     │
    │                         │
    │  1. Parse request       │
    │  2. Check Foundry:      │
    │     which forge         │
    │  3a. If found:          │
    │     forge script ...    │
    │  3b. If NOT found:      │
    │     Return error +      │
    │     installGuide        │
    └──────────┬──────────────┘
               │
               ▼
    Response: {
      success: true/false,
      message: "...",
      installGuide?: "..."  // NEW!
    }
               │
              ▼
    ┌─────────────────────────┐
    │  Frontend handles:       │
    │                         │
    │  if (foundryError) {    │
    │    Show big alert       │
    │    with fix steps       │
    │  } else {               │
    │    Show toast           │
    │  }                      │
    └─────────────────────────┘
```

---

## 📁 فایل‌های مرتبط

```
Farcaster/
├── setup-foundry.sh                    # ⭐ Script نصب خودکار
├── FOUNDRY_QUICK_FIX.md               # حل سریع
├── FOUNDRY_SETUP.md                   # راهنمای تفصیلی
├── FOUNDRY_INSTALLATION.md            # راهنمای کامل
├── DEPLOYMENT_FIXES_SUMMARY.md        # خلاصه تغییرات
├── RUN_GUIDE.md                       # (بروز شده)
│
├── server/
│   └── routes.ts                      # (بهبود شده: بهتر error)
│
└── client/
    └── src/components/
        └── DeployLotteryForm.tsx      # (بهبود شده: state + alert)
```

---

## ⚙️ Environment Variables

```env
# Required for deployment
PRIVATE_KEY=0x...              # Deployer's private key
SIGNER_ADDRESS=0x...           # Signer's wallet address

# Optional (defaults provided)
BASE_RPC_URL=https://...       # Base RPC endpoint
LOTTERY_DEADLINE=1735689600    # Unix timestamp
```

---

## 🔍 Troubleshooting Matrix

| مشکل | تشخیص | حل |
|------|---------|-----|
| "Command not found" | `which forge` = خالی | `source ~/.bashrc` |
| Permission denied | نمی‌تونی execute کنی | `chmod +x ~/.foundry/bin/forge` |
| PATH not updated | Terminal جدید باز کن | بستن/باز کردن terminal |
| نصب ناموفق | Error نمایش می‌دهد | Rust نصب کن → دوباره سعی |
| Codespaces خاص | Terminal جدید باز کن | `bash setup-foundry.sh` |

---

## ✅ Verification Checklist

- [ ] `which forge` نتیجه می‌دهد
- [ ] `forge --version` >= 0.2.0
- [ ] `npm run start:dev` بدون خطا
- [ ] `.env` دارای `PRIVATE_KEY`
- [ ] Deploy form submit می‌شود
- [ ] ✅ Deployment موفق!

---

## 📞 Support Resources

1. **سریع:** FOUNDRY_QUICK_FIX.md
2. **تفصیلی:** FOUNDRY_SETUP.md
3. **کامل:** FOUNDRY_INSTALLATION.md
4. **رسمی:** https://book.getfoundry.sh/

---

**فآدی! Foundry نصب شد و deploy کنید! 🚀**
