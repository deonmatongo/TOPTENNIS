# TOP TENNIS - Vercel Deployment Guide

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. GitHub repository connected to Vercel
3. Supabase project credentials

## Deployment Steps

### 1. Connect GitHub Repository to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository: `deonmatongo/TOPTENNIS`
3. Vercel will automatically detect it as a Vite project

### 2. Configure Environment Variables

In the Vercel project settings, add these environment variables:

```
VITE_SUPABASE_PROJECT_ID=qrhladnnblgbobcnxjsz
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyaGxhZG5uYmxnYm9iY254anN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDcxNzEsImV4cCI6MjA2NzAyMzE3MX0.XtnqHLXk6WguDHQLetYYEkhS1hNj52NPnuxOHHdhVKY
VITE_SUPABASE_URL=https://qrhladnnblgbobcnxjsz.supabase.co
```

**How to add environment variables in Vercel:**
- Go to your project settings
- Navigate to "Environment Variables"
- Add each variable with its name and value
- Make sure to add them for all environments (Production, Preview, Development)

### 3. Build Settings

Vercel will automatically detect these settings from `vercel.json`:

- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### 4. Deploy

Click "Deploy" and Vercel will:
1. Install dependencies
2. Build your project
3. Deploy to a production URL

## Post-Deployment

### Update Supabase Redirect URLs

After deployment, add your Vercel URL to Supabase allowed redirect URLs:

1. Go to https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/auth/url-configuration
2. Add your Vercel production URL (e.g., `https://your-project.vercel.app`)
3. Add redirect URLs:
   - `https://your-project.vercel.app`
   - `https://your-project.vercel.app/**`

### Custom Domain (Optional)

1. Go to your Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed by Vercel
5. Update Supabase redirect URLs with your custom domain

## Continuous Deployment

Every push to the `main` branch will automatically trigger a new deployment on Vercel.

## Troubleshooting

### Build Fails
- Check the build logs in Vercel dashboard
- Ensure all environment variables are set correctly
- Verify `package.json` scripts are correct

### Authentication Issues
- Verify Supabase redirect URLs include your Vercel domain
- Check environment variables are set correctly
- Ensure CORS settings in Supabase allow your domain

### 404 Errors on Routes
- The `vercel.json` configuration handles SPA routing
- All routes should redirect to `index.html`

## Local Testing

Test the production build locally before deploying:

```bash
npm run build
npm run preview
```

This will build and serve the production version at http://localhost:4173

## Support

For issues, check:
- Vercel deployment logs
- Browser console for errors
- Supabase logs for authentication issues
