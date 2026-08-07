# Netlify Deployment Guide

This project is fully configured for a zero-setup deployment to Netlify.

## Steps to Deploy

1. **Upload to Netlify:**
   - Log into your Netlify dashboard.
   - Click **Add new site** > **Import an existing project** (if using GitHub/GitLab) OR **Deploy manually** (if dragging and dropping this folder).

2. **Configure Build Settings:**
   Netlify will automatically detect Next.js. Confirm these settings:
   - **Base directory:** Leave empty
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   *(Note: These are pre-configured in `netlify.toml`)*

3. **Add Environment Variables:**
   You MUST add the following environment variables in Netlify before deploying:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL (e.g., `https://your-project.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous public key

   *To add them: Go to Site Settings > Environment Variables in Netlify.*

4. **Deploy Site:**
   - Click **Deploy**. Netlify will install dependencies using Node 20 and execute the production build.
   - Once the build succeeds, your site will be live!

## Notes for Production
- **Demo Login**: The quick demo login has been preserved as requested.
- **Supabase**: Ensure your Supabase RLS (Row Level Security) policies and database remain active, as this frontend connects directly to them using the keys provided.
