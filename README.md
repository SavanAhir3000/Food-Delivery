# 🍔 BiteBlitz — Full Stack Food Delivery Platform

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg)
![AI Powered](https://img.shields.io/badge/AI-Groq%20LLaMA%203.1-orange.svg)

A production-grade, multi-role food delivery platform with real-time order tracking, AI-powered features, Stripe payments, and a complete admin + rider dashboard.

---

## ✨ Features

### 👤 Customer App
- Browse menu with **AI-powered natural language search** ("something spicy under ₹200")
- Add to cart, apply coupon codes, checkout via **Stripe** or **Cash on Delivery**
- Real-time order status tracking (no page refresh — Socket.io powered)
- Full order history with progress bar UI
- AI food chatbot for menu questions and customer support
- Personalised meal recommendations based on order history
- Password reset via email, saved delivery addresses
- Dark / Light theme toggle

### 🛡️ Admin Dashboard
- Full food inventory management (add, edit, soft-delete, restore, toggle availability)
- Images auto-converted to **WebP** via Sharp for performance
- Live order management with status updates that push to customer in real time
- Coupon creation and management
- **AI sentiment report** — analyses all customer feedback automatically
- Real-time new order notifications via Socket.io

### 🛵 Rider Portal
- Dedicated rider role with separate protected routes
- Claim available orders, mark pickup and delivery
- Real-time broadcast when new orders are ready

### 🤖 AI Features (6 total — powered by Groq LLaMA 3.1)
| Endpoint | Feature |
|---|---|
| `POST /api/ai/chat` | Food chatbot with live menu context |
| `POST /api/ai/search` | Natural language food search |
| `GET /api/ai/order-summary/:id` | AI-generated order summary |
| `GET /api/ai/sentiment-report` | Customer feedback sentiment analysis |
| `GET /api/ai/recommend/:userId` | Personalised meal recommendations |
| `POST /api/ai/support` | Customer support bot |

---

## 🧱 Tech Stack

### Frontend & Admin
- **React 18** + **Vite**
- **Socket.io-client** for real-time updates
- CSS with dark/light theme support

### Backend
- **Node.js** + **Express**
- **InsForge** (PostgreSQL BaaS) — database + file storage
- **JWT** (access + refresh token flow)
- **Socket.io** — real-time rooms for user, admin, and rider
- **Stripe** — payments, webhooks, and refunds
- **Nodemailer** (Gmail SMTP) — order confirmation + password reset emails
- **Sharp** — image resizing and WebP conversion
- **PDFKit** — invoice generation attached to confirmation emails
- **Groq API** (llama-3.1-8b-instant) — all AI features
- **Swagger** — live API docs at `/api-docs`
- **express-rate-limit** — rate limiting on all routes
- **xss + xss-filters** — XSS protection
- **express-validator** — full input validation middleware
- **Twilio** — SMS (gracefully disabled until configured)

### DevOps
- **Docker** + **docker-compose** — full containerisation
- **GitHub Actions** — CI/CD pipeline

---

## 🔐 Roles & Access Control

| Role | Access |
|---|---|
| `user` | Customer app — browse, cart, order, track |
| `admin` | Admin dashboard — food, orders, coupons, AI reports |
| `rider` | Rider portal — claim and complete deliveries |

All roles enforced via `requireRole()` middleware on every protected route. Role-based 403 responses on any cross-role access attempt.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm
- An InsForge account (or swap with any PostgreSQL provider)
- Stripe account (test keys work fine)
- Gmail account with App Password for SMTP
- Groq API key (free at console.groq.com)

### Option A: Local Setup

**1. Clone the repo**
```bash
git clone https://github.com/savan-rajatiya/Food-Delivery.git
cd Food-Delivery
```

**2. Configure environment variables**

Create a `.env` file inside `/backend` using `.env.example` as a reference:

```env
# InsForge (PostgreSQL BaaS)
INSFORGE_URL=your_insforge_url
INSFORGE_ANON_KEY=your_insforge_anon_key

# JWT
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Email (Gmail App Password)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=BiteBlitz <your@gmail.com>

# Groq AI
GROQ_API_KEY=gsk_...

# App
PORT=4000
FRONTEND_URL=http://localhost:5173
SALT=10
```

**3. Start the backend**
```bash
cd backend
npm install
npm run server
# Runs on http://localhost:4000
```

**4. Start the frontend**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

**5. Start the admin dashboard**
```bash
cd admin
npm install
npm run dev
# Runs on http://localhost:5174
```

**6. Seed demo data (optional)**
```bash
cd backend
node seed-dummy.js
```

### Option B: Docker

```bash
# Configure /backend/.env first, then:
docker-compose up --build -d
```

| Service | URL |
|---|---|
| Customer App | http://localhost:5173 |
| Admin Dashboard | http://localhost:5174 |
| Backend API | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api-docs |

---

## 📖 API Documentation

Live Swagger UI available at `http://localhost:4000/api-docs` when the backend is running.

| Route Prefix | Description | Auth |
|---|---|---|
| `POST /api/user/register` | Register (user or rider) | Public |
| `POST /api/user/login` | Login → JWT + refresh token | Public |
| `GET /api/food` | Browse menu | Public |
| `GET /api/cart/get` | Get cart | JWT |
| `POST /api/order/place` | Place order | JWT |
| `GET /api/order/userorders` | Order history | JWT |
| `POST /api/coupon/apply` | Apply promo code | JWT |
| `GET /api/ai/recommend/:userId` | AI recommendations | JWT |
| `POST /api/ai/chat` | Food chatbot | JWT |
| `GET /api/ai/sentiment-report` | Sentiment analysis | Admin JWT |
| `GET /api/rider/available-orders` | Available deliveries | Rider JWT |

> Include JWT in the `token` header for all protected endpoints.

---

## 🔌 Real-Time Events (Socket.io)

| Room | Who Joins | Events Received |
|---|---|---|
| `user_{userId}` | Customer | `order_update`, `payment_confirmed`, `new_notification` |
| `admin_room` | Admin | `new_order`, `order_feedback_update` |
| `rider_room` | All riders | `new_order_available`, `food_ready` |
| `rider_{id}` | Specific rider | `order_status_update` |

---

## 🧪 Testing

A `qa_test.js` file and `jest.config.js` are included for automated tests.

```bash
cd backend
npm test
```

---

## ⚠️ Known Limitations

- **Twilio SMS** — placeholder credentials; SMS is gracefully skipped (no crash). Replace with real Twilio keys to enable.
- **Stripe Webhooks** — placeholder secret in `.env.example`; replace with your real webhook secret from Stripe dashboard.
- **2FA** — disabled by default (set `CHECK_2FA_ENABLED=true` in `.env` to enable).

---

## 📁 Project Structure

```
Food-Delivery/
├── frontend/          # React customer app (Vite)
├── admin/             # React admin dashboard (Vite)
├── backend/
│   ├── controllers/   # Route handlers
│   ├── middleware/    # Auth, roles, rate limiting, validation
│   ├── routes/        # Express routers
│   ├── services/      # Business logic
│   └── utils/         # Socket.io, email, PDF, AI helpers
├── foods/             # Seed images
├── docker-compose.yml
└── .github/           # CI/CD workflows
```

---

## 📄 License

MIT — see [LICENSE](./LICENSE) for details.

---

> Built as a full-stack portfolio project demonstrating real-world patterns: multi-role auth, real-time systems, AI integration, payment processing, and containerised deployment.
