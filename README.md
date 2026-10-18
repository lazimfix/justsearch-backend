# 🛡️ Secure Agency Backend API (100% Free Hosting Ready)

A production-grade, lightweight, and hardened Node.js backend for digital agencies and web design businesses. Designed specifically to capture leads from your Blogger XML theme or custom landing page, filter out spam, and send instant WhatsApp/Telegram alerts directly to your mobile phone.

## 🚀 Key Highlights

- **100% Free of Cost:** Can be hosted forever on free tiers (Render.com, Vercel Serverless, Railway, or Koyeb).
- **GitHub Ready:** Pre-configured `.gitignore`, `.env.example`, and zero exposed credentials.
- **Bank-Grade Security:**
  - 🛡️ **Helmet Security Headers:** Protections against XSS, clickjacking, MIME-sniffing.
  - 🛑 **Rate Limiting:** Protects endpoints from DDoS, brute-force spam, and abuse (5 submissions / 15 mins per IP).
  - 🍯 **Honeypot Bot Trap:** Catches automated spambots silently without requiring ugly CAPTCHAs.
  - 🧼 **Input Sanitization:** Strips XSS payloads and validates email/phone formats.
  - ⏱️ **Timing-Safe Auth:** Constant-time API key verification (`crypto.timingSafeEqual`) to prevent timing attacks on admin endpoints.
  - 🌐 **Strict CORS:** Whitelists only your verified agency frontend domain.
  - 📦 **Memory Overflow Protection:** Caps incoming JSON payloads at 10kb.
- **Zero-Cost Instant Alerts:**
  - Free Telegram Bot API integration (receive instant lead alerts on your phone the second a client requests a quote).

---

## 🛠️ Step 1: Local Setup

```bash
# Clone or enter the folder
cd agency-backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Start development server
npm run dev # or npm start
```

---

## 📤 Step 2: Push to GitHub (Safely)

Your `.env` file containing secrets is automatically ignored by `.gitignore`.

```bash
git init
git add .
git commit -m "feat: initial secure agency backend"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/agency-backend.git
git push -u origin main
```

---

## ☁️ Step 3: 100% Free Cloud Deployment (Render.com)

1. Go to [Render.com](https://render.com) and sign up with GitHub (free).
2. Click **New +** -> **Web Service**.
3. Select your newly pushed GitHub repository (`agency-backend`).
4. Settings:
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free ($0/month)
5. Under **Environment Variables**, add:
   - `ALLOWED_ORIGINS` = `https://your-agency-website.com`
   - `ADMIN_API_KEY` = `your_secure_random_key_here`
   - `TELEGRAM_BOT_TOKEN` = `your_bot_token` (Optional, from @BotFather)
   - `TELEGRAM_CHAT_ID` = `your_chat_id` (Optional, from @userinfobot)
6. Click **Deploy Web Service**! You will get a live HTTPS URL (e.g. `https://agency-backend.onrender.com`).

---

## 🔌 Step 4: Connect to Your Blogger XML Theme / Website

In your Blogger XML Theme or website JavaScript, submit inquiries with a simple `fetch`:

```javascript
async function submitInquiry(formData) {
  const response = await fetch("https://agency-backend.onrender.com/api/v1/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      service: formData.service,
      package: "AED 799 Deal",
      message: formData.message,
      _hp_website: "" // Keep empty; bots will fill this and get trapped!
    })
  });
  const result = await response.json();
  if (result.success) {
    alert("Inquiry received! We will WhatsApp you shortly.");
  }
}
```
