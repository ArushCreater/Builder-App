# BuilderTrend Clone - Complete Setup Guide

This guide will help you set up and run the complete BuilderTrend clone application including web, backend, and mobile apps.

## Prerequisites

- Node.js 18+ and npm 9+
- PostgreSQL database (or Supabase account)
- Git
- For mobile development: iOS Simulator (Mac) or Android Studio

## Quick Start

### 1. Clone and Install

```bash
# Navigate to the project
cd Builder-App

# Install all dependencies (this installs for all workspaces)
npm install
```

### 2. Set Up Database

#### Option A: Using Supabase (Recommended)

1. Create a free account at [https://supabase.com](https://supabase.com)
2. Create a new project
3. Get your database URL from Project Settings > Database
4. Get your API keys from Project Settings > API

#### Option B: Local PostgreSQL

1. Install PostgreSQL
2. Create a new database: `createdb buildertrend`
3. Note your connection string

### 3. Configure Environment Variables

#### Backend Configuration

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
# Server
PORT=5000
NODE_ENV=development

# Database - Use your Supabase connection string
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Supabase
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key

# JWT Secret (generate a strong random string)
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# GitHub for file storage (create a personal access token)
GITHUB_TOKEN=your_github_token
GITHUB_REPO_OWNER=your_username
GITHUB_REPO_NAME=buildertrend-files
GITHUB_BRANCH=main

# CORS
CORS_ORIGIN=http://localhost:3000
```

#### Web Frontend Configuration

```bash
cd ../web
cp .env.example .env
```

Edit `web/.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_APP_NAME=BuilderTrend Clone
```

#### Mobile App Configuration

```bash
cd ../mobile
cp .env.example .env
```

Edit `mobile/.env`:

```env
API_URL=http://localhost:5000
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

For physical device testing, replace `localhost` with your computer's local IP address.

### 4. Initialize Database

```bash
cd ../backend

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 5. Start Development Servers

#### Start All (Web + Backend)

From the root directory:

```bash
npm run dev
```

This starts both the backend (port 5000) and frontend (port 3000) concurrently.

#### Or Start Individually

**Backend:**
```bash
cd backend
npm run dev
```

**Web:**
```bash
cd web
npm run dev
```

**Mobile:**
```bash
cd mobile
npm start
```

### 6. Access the Applications

- **Web App**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **API Health Check**: http://localhost:5000/health
- **Mobile**: Scan QR code with Expo Go app

## GitHub File Storage Setup

The app uses GitHub as file storage for documents and photos.

1. **Create a GitHub repository** for file storage (e.g., `buildertrend-files`)

2. **Create a Personal Access Token**:
   - Go to GitHub Settings > Developer settings > Personal access tokens
   - Generate new token (classic)
   - Select scopes: `repo` (Full control of private repositories)
   - Copy the token

3. **Update backend/.env** with your GitHub details

## Creating Your First User

### Option 1: Register via Web App

1. Navigate to http://localhost:3000/register
2. Fill in the registration form
3. Select a role (start with ADMIN for full access)

### Option 2: Direct API Call

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "password123",
    "firstName": "Admin",
    "lastName": "User",
    "role": "ADMIN"
  }'
```

## Project Structure

```
Builder-App/
├── web/                    # React web application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── pages/         # Page components
│   │   ├── layouts/       # Layout components
│   │   ├── stores/        # State management
│   │   ├── lib/           # Utilities & API client
│   │   └── hooks/         # Custom React hooks
│   └── package.json
│
├── backend/               # Node.js Express API
│   ├── src/
│   │   ├── controllers/   # Route controllers
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Express middleware
│   │   ├── utils/         # Utility functions
│   │   └── index.ts       # Server entry point
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── package.json
│
├── mobile/                # React Native mobile app
│   ├── app/              # Expo Router pages
│   ├── components/       # React Native components
│   ├── services/         # API & device services
│   └── package.json
│
├── shared/               # Shared types & utilities
│   └── src/
│       ├── types.ts      # TypeScript types
│       └── validation.ts # Zod schemas
│
└── package.json          # Root package.json (monorepo)
```

## Available Scripts

### Root Level

- `npm run dev` - Start web + backend concurrently
- `npm run dev:web` - Start web only
- `npm run dev:backend` - Start backend only
- `npm run dev:mobile` - Start mobile app
- `npm run build` - Build all apps
- `npm test` - Run tests

### Backend

- `npm run dev` - Start dev server with hot reload
- `npm run build` - Build TypeScript
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run migrations
- `npm run prisma:studio` - Open Prisma Studio

### Web

- `npm run dev` - Start Vite dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Mobile

- `npm start` - Start Expo dev server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run web` - Run in web browser

## Troubleshooting

### Database Connection Issues

If you get database connection errors:

1. Verify your DATABASE_URL is correct
2. Check if your IP is allowed in Supabase (if using Supabase)
3. Test connection: `npm run prisma:studio`

### Port Already in Use

If port 3000 or 5000 is already in use:

**Backend**: Change PORT in `backend/.env`
**Web**: Vite will automatically use next available port

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules web/node_modules backend/node_modules mobile/node_modules
npm install
```

### Prisma Client Issues

```bash
cd backend
npm run prisma:generate
```

### Mobile App Not Connecting to Backend

If using a physical device:

1. Ensure device and computer are on same network
2. Replace `localhost` with your computer's local IP in `mobile/.env`
3. For iOS Simulator, `localhost` should work
4. For Android Emulator, use `10.0.2.2` instead of `localhost`

## Building for Production

### Web App

```bash
cd web
npm run build
# Build files will be in web/dist/
```

Deploy to:
- Vercel (recommended)
- Netlify
- AWS S3 + CloudFront
- Any static hosting service

### Backend API

```bash
cd backend
npm run build
# Built files in backend/dist/
```

Deploy to:
- Railway (recommended)
- Render
- Heroku
- AWS EC2
- DigitalOcean

### Mobile App

```bash
cd mobile

# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

Requires EAS CLI: `npm install -g eas-cli`

## Environment-Specific Configurations

### Development
- Debug logging enabled
- Hot reload enabled
- Source maps included
- Detailed error messages

### Production
- Minified builds
- Error logging only
- Source maps disabled
- Secure headers enabled

## Next Steps

1. **Customize the app** - Update branding, colors, and features
2. **Set up CI/CD** - Automate testing and deployment
3. **Add integrations** - Connect to Xero, QuickBooks, etc.
4. **Configure email** - Set up SMTP for notifications
5. **Enable analytics** - Add Google Analytics or similar
6. **Set up monitoring** - Use Sentry or similar for error tracking

## Support

- Check the main README.md for feature documentation
- Review inline code comments
- Check API documentation (coming soon)

## Security Notes

- Never commit `.env` files to git
- Use strong JWT secrets in production
- Enable HTTPS in production
- Regularly update dependencies
- Use Supabase Row Level Security (RLS) for additional database security
- Implement rate limiting (already configured)
- Sanitize user inputs (validation included)

---

**Happy Building!** 🏗️
