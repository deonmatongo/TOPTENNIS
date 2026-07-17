# TOP TENNIS - Vercel Deployment Guide

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. GitHub repository connected to Vercel

## Deployment Steps

### 1. Connect GitHub Repository to Vercel

1. Go to https://vercel.com/new
2. Import your GitHub repository: `deonmatongo/TOPTENNIS`

### 2. Set the Root Directory (CRITICAL for monorepo)

Because this is a monorepo, you **must** set the root directory in Vercel's project settings.

**Option A — via Vercel dashboard (recommended):**
- During project import, find the "Root Directory" field
- Set it to: `TOP_TENNIS_WEBSITE`
- Vercel will then use `TOP_TENNIS_WEBSITE/vercel.json` automatically

**Option B — deploy from repo root (no dashboard change needed):**
- The root-level `vercel.json` in the repository is already configured to build from `TOP_TENNIS_WEBSITE/`
- No extra configuration required

### 3. Build Settings

These are auto-detected from `vercel.json` (no changes needed):

| Setting          | Value            |
|------------------|------------------|
| Framework        | Vite             |
| Build Command    | `npm run build`  |
| Output Directory | `dist`           |
| Install Command  | `npm install`    |

### 4. Environment Variables (optional)

The app connects to Supabase using credentials embedded in the build. No environment variables are required for basic operation.

If you want to override the Supabase connection at the environment level, add these in Vercel's project settings and update `src/integrations/supabase/client.ts` to read from `import.meta.env`:

```
VITE_SUPABASE_URL=https://qrhladnnblgbobcnxjsz.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
```

The optional Socket.io presence server can be pointed at via:
```
VITE_SOCKET_URL=https://your-socket-server.example.com
```
When `VITE_SOCKET_URL` is not set, the app falls back to Supabase Realtime for presence.

### 5. Deploy

Click "Deploy". Vercel will install dependencies, build, and serve the SPA.

## Post-Deployment

### Update Supabase Redirect URLs

After deployment, add your Vercel URL to Supabase's allowed redirect URLs:

1. Go to https://supabase.com/dashboard/project/qrhladnnblgbobcnxjsz/auth/url-configuration
2. Add your Vercel production URL (e.g., `https://your-project.vercel.app`)
3. Add:
   - `https://your-project.vercel.app`
   - `https://your-project.vercel.app/**`

### Custom Domain (optional)

1. Go to your Vercel project → Settings → Domains
2. Add your custom domain and follow the DNS instructions
3. Add the custom domain to Supabase redirect URLs as well

## Continuous Deployment

Every push to the `main` branch will automatically trigger a new deployment.

## Troubleshooting

### Build fails — can't find package.json
Vercel is building from the repo root but there's no `package.json` there. Make sure you've either set Root Directory to `TOP_TENNIS_WEBSITE` (Option A) or the root `vercel.json` is present (Option B above).

### 404 on routes (e.g. `/dashboard`)
The `vercel.json` `rewrites` rule catches all routes and serves `index.html`. If this stops working, verify the `rewrites` block is present.

### Authentication redirect loops
Ensure your Vercel domain is listed in Supabase → Auth → URL Configuration → Redirect URLs.

### Local production test

```bash
cd TOP_TENNIS_WEBSITE
npm run build
npm run preview
```

Serves the production build at http://localhost:4173.
