# BuilderTrend Clone - Construction Management Platform

A comprehensive construction management platform for home builders to manage tradies, expenditures, projects, and client relationships.

## 🏗️ Features

### Core Modules
- **Sales & Lead Management** - Capture leads, track proposals, convert to jobs
- **Project Scheduling** - Gantt charts, calendar views, task dependencies
- **Client Portal** - Real-time project status, photo sharing, approvals
- **Financial Management** - Budgets, estimates, POs, change orders, profitability tracking
- **Communication Hub** - Built-in messaging, comments, notifications
- **Materials & Selections** - Track client choices, link to budget lines
- **Daily Logs** - Weather, photos, notes, crew time tracking
- **Document Management** - Plans, permits, contracts, warranties
- **Quality Control** - Inspections, checklists, punch lists
- **Bid Management** - RFQs, bid comparison, subcontractor management
- **Reporting & Analytics** - Project performance, cost variance, business insights
- **Mobile Access** - Full mobile app for field teams

## 🚀 Tech Stack

### Web Frontend
- React 18 with TypeScript
- Vite for blazing fast builds
- Tailwind CSS + shadcn/ui components
- React Query for data fetching
- Zustand for state management
- React Router for navigation

### Backend
- Node.js + Express with TypeScript
- Prisma ORM
- Supabase PostgreSQL database
- Socket.io for real-time features
- JWT authentication

### Mobile
- React Native with Expo
- Shared API with web app
- Offline-first architecture
- Native camera, GPS integration

### Infrastructure
- Database: Supabase (PostgreSQL)
- File Storage: GitHub
- Authentication: Supabase Auth + JWT
- Real-time: Socket.io

## 📦 Project Structure

```
buildertrend-clone/
├── web/                    # React web application
├── backend/                # Node.js Express API
├── mobile/                 # React Native mobile app
├── shared/                 # Shared types and utilities
└── package.json           # Monorepo root
```

## 🛠️ Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp web/.env.example web/.env
cp backend/.env.example backend/.env

# Run development servers
npm run dev
```

### Individual Apps

```bash
# Web app only
npm run dev:web

# Backend only
npm run dev:backend

# Mobile app
npm run dev:mobile
```

## 🔧 Environment Variables

### Backend (.env)
```
DATABASE_URL=your_supabase_database_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_jwt_secret
PORT=5000
```

### Web (.env)
```
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📱 Mobile Development

```bash
cd mobile
npm start
```

## 🧪 Testing

```bash
npm run test
```

## 📄 License

MIT

## 👥 Contributors

Built with ❤️ for builders who build
