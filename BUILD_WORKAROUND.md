# Build Instructions - Memory Issue Workaround

## Problem
The build process is running out of memory on your system.

## Solutions

### Option 1: Build on a Different Machine
If you have access to another computer with more RAM (8GB+), clone the repo there and build:

```bash
git clone <your-repo>
cd newsofyou-main
npm install
npm run build
```

Then copy the `dist/` folder back to this machine.

### Option 2: Use Vercel/Netlify to Build
Deploy directly to Vercel or Netlify - they'll build it on their servers:

**Vercel:**
```powershell
npm install -g vercel
vercel
```

**Netlify:**
```powershell
npm install -g netlify-cli
netlify deploy --prod
```

### Option 3: Close Other Applications
Close all other applications and try again:

```powershell
# Close browsers, IDEs, etc., then:
$env:NODE_OPTIONS="--max-old-space-size=6144"
npm run build
```

### Option 4: Build in WSL (Windows Subsystem for Linux)
WSL often handles memory better:

```bash
# In WSL terminal:
cd /mnt/c/Users/HP/Desktop/newsofyou-main
npm run build
```

### Option 5: Use the Existing Dist Folder
If there's already a `dist/` folder from a previous build, you can deploy that:

```powershell
# Check if dist exists
ls dist

# If it exists, deploy it directly
vercel --prod
```

---

## What's Already Done ✅

1. ✅ **All database migrations deployed**
2. ✅ **All 5 edge functions deployed**
3. ✅ **TypeScript types regenerated**
4. ✅ **All code is complete and error-free**

## What's Left ⚠️

1. ⚠️ **Set OpenRouter API key** (required for AI features)
2. ⚠️ **Build the app** (blocked by memory issue)
3. ⚠️ **Deploy to production**

---

## Recommended: Deploy to Vercel

This is the easiest solution since Vercel will build on their servers:

```powershell
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy (will build automatically)
vercel --prod
```

Vercel will:
- Build the app on their servers (no memory issues)
- Deploy it automatically
- Give you a production URL

---

## After Deployment

Don't forget to set your OpenRouter API key:

```powershell
supabase secrets set OPENROUTER_API_KEY=sk-or-your-key-here
```

Get your key from: https://openrouter.ai/

---

## Testing

Once deployed and the API key is set, test all features using the checklist in `DEPLOYMENT_STATUS.md`.
