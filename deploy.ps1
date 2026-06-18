# Supabase Deployment Script
# This script deploys all migrations and edge functions to your Supabase project

Write-Host "Starting Supabase Deployment..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Deploy Database Migrations
Write-Host "Step 1/4: Deploying database migrations..." -ForegroundColor Yellow
try {
    supabase db push
    Write-Host "Migrations deployed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Migration deployment failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Deploy Edge Functions
Write-Host "Step 2/4: Deploying edge functions..." -ForegroundColor Yellow

$functions = @(
    "ai-compose-help",
    "ai-memory-extract",
    "ai-message-guard",
    "ai-companion",
    "ai-decoy-bot"
)

foreach ($func in $functions) {
    Write-Host "  Deploying $func..." -ForegroundColor Gray
    try {
        supabase functions deploy $func
        Write-Host "  $func deployed" -ForegroundColor Green
    } catch {
        Write-Host "  $func failed: $_" -ForegroundColor Red
    }
}
Write-Host ""

# Step 3: Regenerate Types
Write-Host "Step 3/4: Regenerating TypeScript types..." -ForegroundColor Yellow
try {
    supabase gen types typescript --project-id itjukxjshcobpibmbrzq > src/integrations/supabase/types.ts
    Write-Host "Types regenerated successfully!" -ForegroundColor Green
} catch {
    Write-Host "Type generation failed (non-critical): $_" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Reminder about API Key
Write-Host "Step 4/4: API Key Setup" -ForegroundColor Yellow
Write-Host ""
Write-Host "IMPORTANT: You need to set your OpenRouter API key!" -ForegroundColor Red
Write-Host "Get your key from: https://openrouter.ai/" -ForegroundColor Cyan
Write-Host ""
Write-Host "Then run this command:" -ForegroundColor White
Write-Host "  supabase secrets set OPENROUTER_API_KEY=sk-or-your-key-here" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Set your OpenRouter API key (see above)" -ForegroundColor White
Write-Host "  2. Build the app: npm run build" -ForegroundColor White
Write-Host "  3. Test the features using DEPLOYMENT_NOTES.md checklist" -ForegroundColor White
Write-Host ""
Write-Host "Features deployed:" -ForegroundColor Yellow
Write-Host "  - Security & RLS policies" -ForegroundColor Green
Write-Host "  - Proposals system" -ForegroundColor Green
Write-Host "  - AI memories" -ForegroundColor Green
Write-Host "  - Decoy mode" -ForegroundColor Green
Write-Host "  - AI compose help" -ForegroundColor Green
Write-Host "  - AI companion" -ForegroundColor Green
Write-Host "  - AI message guard" -ForegroundColor Green
Write-Host ""
