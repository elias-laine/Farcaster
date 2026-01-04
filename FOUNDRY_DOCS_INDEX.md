# 📚 Foundry Documentation Index

## 🚀 شروع سریع (Choose One)

### اگر عجله دارید ⏰
→ [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md)
- 2 دقیقه برای خواندن
- مسائل معمول
- 3 روش نصب

### اگر مشکل دارید 🔧
→ [FOUNDRY_VISUAL_GUIDE.md](./FOUNDRY_VISUAL_GUIDE.md)
- فلوچارت‌ها و نمودارها
- مرحله‌به‌مرحله
- Troubleshooting matrix

### اگر جزئیات می‌خواهید 📖
→ [FOUNDRY_INSTALLATION.md](./FOUNDRY_INSTALLATION.md)
- راهنمای کامل
- تمام گزینه‌ها
- Environment variables
- دستورات مفید

### اگر خیلی عمیق می‌خواهید 🔬
→ [FOUNDRY_SETUP.md](./FOUNDRY_SETUP.md)
- تفصیل‌ترین راهنما
- تمام troubleshooting
- Learning resources

---

## 📄 Documentation Map

```
Quick Help (1-2 min)
    ↓
FOUNDRY_QUICK_FIX.md
├─ خطا دیدید؟
├─ 3 روش نصب
├─ 3 مشکل معمول
└─ Verify

Visual Learning (5 min)
    ↓
FOUNDRY_VISUAL_GUIDE.md
├─ فلوچارت‌های کاملی
├─ Step-by-step
├─ Architecture diagram
└─ Checklist

Detailed Instructions (10 min)
    ↓
FOUNDRY_INSTALLATION.md
├─ تمام روش‌های نصب
├─ محیط سیستم
├─ بعد از نصب
└─ دستورات مفید

Complete Reference (30 min)
    ↓
FOUNDRY_SETUP.md
├─ هر جزئیات
├─ Troubleshooting جامع
├─ Environment setup
└─ Learning resources
```

---

## 🎯 به‌دنبال چی هستید؟

### "Foundry نصب شده نیست" خطا دیدم
→ **قدم 1:** [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md)  
→ **قدم 2:** `bash setup-foundry.sh`  
→ **قدم 3:** `npm run start:dev`

### نمی‌دانم کدام روش نصب برای من است
→ [FOUNDRY_VISUAL_GUIDE.md](./FOUNDRY_VISUAL_GUIDE.md) - فلوچارت را ببینید

### `forge: command not found`
→ [FOUNDRY_INSTALLATION.md](./FOUNDRY_INSTALLATION.md) - بخش Troubleshooting

### نصب اصلاً کار نکرد
→ [FOUNDRY_SETUP.md](./FOUNDRY_SETUP.md) - Complete troubleshooting

### می‌خواهم Foundry یاد بگیرم
→ [FOUNDRY_SETUP.md](./FOUNDRY_SETUP.md) - Learning Foundry section

---

## 🔍 Search by Error Message

| خطا | سند |
|-----|------|
| "Foundry not installed" | QUICK_FIX → VISUAL_GUIDE |
| "Command not found: forge" | INSTALLATION → SETUP |
| "Permission denied" | SETUP → Troubleshooting |
| "foundryup error" | SETUP → Troubleshooting |
| "How to deploy?" | RUN_GUIDE.md |

---

## 📋 هر مستند چی مطالبی دارد

### ✅ FOUNDRY_QUICK_FIX.md
```
✓ مشکل چیست
✓ 3 روش نصب سریع
✓ 3 مسئله معمول + راه‌حل
✓ بعد‌ها چی کار کنید
```
⏱️ **زمان:** 2-3 دقیقه

### ✅ FOUNDRY_VISUAL_GUIDE.md
```
✓ فلوچارت استقبال
✓ فلوچارت error handling
✓ مرحله‌به‌مرحله جزئی
✓ System architecture
✓ Troubleshooting matrix
✓ Checklist
```
⏱️ **زمان:** 5-10 دقیقه

### ✅ FOUNDRY_INSTALLATION.md
```
✓ خلاصه سریع
✓ 4 روش نصب (Linux, macOS, Docker, Cargo)
✓ تأیید کردن نصب
✓ Troubleshooting برای هر روش
✓ دستورات مفید Foundry
✓ Learning resources
✓ بعد از نصب نکات
```
⏱️ **زمان:** 10-15 دقیقه

### ✅ FOUNDRY_SETUP.md
```
✓ راهنمای کامل هر روش
✓ Environment variables
✓ شاملTraceability جامع:
  - PATH issues
  - Permission issues
  - Installation failures
  - Cloud environments
✓ دستورات Foundry پیشرفته
✓ رسمی resources
```
⏱️ **زمان:** 20-30 دقیقه

---

## 🎯 Quick Decision Tree

```
آیا "Foundry not installed" خطا دیدید؟
│
├─ YES → FOUNDRY_QUICK_FIX.md (سریع‌ترین)
│        └─ bash setup-foundry.sh
│
└─ NO (شکایت مختلف)
   │
   ├─ Command not found → INSTALLATION.md
   ├─ Permission issues → SETUP.md
   ├─ Visual learner?   → VISUAL_GUIDE.md
   └─ Need full docs   → SETUP.md
```

---

## 🚀 Installation Quick Commands

### ✨ خودکار (Recommended)
```bash
bash setup-foundry.sh
```

### 📝 دستی
```bash
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup
```

### 🍎 macOS
```bash
brew install foundry
```

---

## 📞 اگر هنوز مشکل دارید

1. **Verify:** `forge --version`
2. **Check:** `which forge`
3. **Search:** مسئله را در محدوده docs جستجو کنید
4. **Read:** FOUNDRY_SETUP.md (Complete troubleshooting)
5. **Learn:** https://book.getfoundry.sh/

---

## 📚 عناوین کامل مستندات

| فایل | موضوع | طول | سطح |
|------|-------|------|-----|
| FOUNDRY_QUICK_FIX.md | حل سریع | کوتاه | شروع‌کننده |
| FOUNDRY_VISUAL_GUIDE.md | نمودارها | متوسط | بصری |
| FOUNDRY_INSTALLATION.md | نصب مفصل | متوسط | متوسط |
| FOUNDRY_SETUP.md | راهنمای کامل | بلند | پیشرفته |
| RUN_GUIDE.md | اجرای پروژه | کوتاه | شروع‌کننده |

---

## ⭐ Best Practices

1. **ابتدا QUICK_FIX بخوانید** - اگر موفق شد، تمام!
2. **VISUAL_GUIDE اگر نیاز است** - فلوچارت‌های مفید
3. **INSTALLATION برای تفاصیل** - هر روش نصب جداگانه
4. **SETUP برای help** - troubleshooting جامع

---

## 🎓 Learning Path

```
Level 1: Just want it to work ⚡
└─ FOUNDRY_QUICK_FIX.md → bash setup-foundry.sh ✅

Level 2: Understand what's happening 🧠
└─ FOUNDRY_VISUAL_GUIDE.md → Flowcharts + Steps

Level 3: Need more details 📖
└─ FOUNDRY_INSTALLATION.md → Full instructions

Level 4: Professional setup 🚀
└─ FOUNDRY_SETUP.md → Complete reference + Learning
└─ https://book.getfoundry.sh/ → Official docs
```

---

## 🔗 Quick Links

- [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md) - شروع کنید اینجا! 👈
- [FOUNDRY_VISUAL_GUIDE.md](./FOUNDRY_VISUAL_GUIDE.md) - فلوچارت‌ها
- [FOUNDRY_INSTALLATION.md](./FOUNDRY_INSTALLATION.md) - هر روش نصب
- [FOUNDRY_SETUP.md](./FOUNDRY_SETUP.md) - تمام راهنمایی‌ها
- [RUN_GUIDE.md](./RUN_GUIDE.md) - اجرای پروژه
- [DEPLOYMENT_IMPROVEMENTS.md](./DEPLOYMENT_IMPROVEMENTS.md) - فرم deployment
- [DEPLOYMENT_FIXES_SUMMARY.md](./DEPLOYMENT_FIXES_SUMMARY.md) - خلاصه fixing

---

**⏭️ بعدی؟ [FOUNDRY_QUICK_FIX.md](./FOUNDRY_QUICK_FIX.md) را بخوانید!**
