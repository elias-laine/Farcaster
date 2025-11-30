# 🔧 راهنمای تنظیم متغیرهای محلی (Environment Variables)

کاملاً ساده! تمام تنظیمات از طریق **متغیرهای محلی** انجام می‌شود.

## ✅ مورد نیاز (فرض کنید):

### 1️⃣ Backend متغیرها (Secrets tab)

```bash
# Neynar API (برای تأیید تسک)
NEYNAR_API_KEY=your_neynar_key_here

# Signer Private Key (برای امضای SBT)
SIGNER_PRIVATE_KEY=0x...your_signer_key...

# Task Configuration
CAST_HASH=0x28a80f62f8053b21fc247c68c8c62c2b4260ccc6
TARGET_FID=123456

# Contract Address (بعد از نشر)
CONTRACT_ADDRESS=0x...deployed_contract_address...

# Optional
CHAIN_ID=8453
RPC_URL=https://mainnet.base.org
```

### 2️⃣ Frontend متغیرها (prefix VITE_)

درUniverse browser دیگری (اگر محتاج باشید):

```bash
VITE_CAST_HASH=0x...
VITE_CAST_URL=https://farcaster.com/...
VITE_TARGET_FID=123456
VITE_TARGET_USERNAME=hossein2001
VITE_CONTRACT_ADDRESS=0x...
VITE_CHAIN_ID=8453
VITE_CHAIN_NAME=Base
VITE_EXPLORER_URL=https://basescan.org
VITE_RPC_URL=https://mainnet.base.org
```

---

## 🎯 فقط برای استفاده محلی:

### برای تست روی Base Sepolia:

```bash
VITE_CAST_HASH=0x...
VITE_TARGET_FID=123456
VITE_CONTRACT_ADDRESS=0x...deployed_on_sepolia...
VITE_CHAIN_ID=84532
VITE_CHAIN_NAME="Base Sepolia"
VITE_EXPLORER_URL=https://sepolia.basescan.org
VITE_RPC_URL=https://sepolia.base.org
```

---

## ✨ کاری نیست!

فقط متغیرها را در **Secrets** تب تنظیم کنید و `config.ts` خودکار می‌خواند.

**هیچ فایلی نیاز به ویرایش ندارد!** 🎉
