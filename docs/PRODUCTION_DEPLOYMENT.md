# Production Deployment Guide

This guide provides a comprehensive production deployment plan for SocialHub, including environment configuration, infrastructure setup, and operational considerations.

## Architecture Overview

SocialHub consists of four main services:

```mermaid
graph TB
    Client[Frontend - Next.js]
    API[Backend - Express API]
    Worker[Worker - BullMQ]
    DB[(PostgreSQL)]
    Cache[(Redis)]
    
    Client -->|HTTP/HTTPS| API
    API -->|SQL| DB
    API -->|Queue Jobs| Cache
    Worker -->|Process Jobs| Cache
    Worker -->|SQL| DB
    Worker -->|Publish| Platforms[LinkedIn/Instagram/YouTube]
```

## Recommended Hosting Architecture

### Minimal Production Setup
- **Platform**: Railway, Render, or DigitalOcean App Platform
- **Frontend**: Next.js on Vercel or platform's container service
- **Backend**: Container service with auto-scaling
- **Worker**: Separate container service (1-2 instances)
- **Database**: Managed PostgreSQL (e.g., Railway Postgres, Render Postgres, or DigitalOcean Managed Database)
- **Cache**: Managed Redis (e.g., Railway Redis, Render Redis, or DigitalOcean Managed Redis)

### Alternative: Self-Hosted on VPS
- **Provider**: DigitalOcean Droplet, Hetzner Cloud, or AWS Lightsail
- **Size**: 4GB RAM minimum (2 vCPU)
- **Setup**: Docker Compose deployment with volumes
- **Backup**: Automated PostgreSQL backups to S3-compatible storage

## Environment Variables

### Backend Service

#### Required Secrets (store in secret manager)
```bash
# Database & Cache
DATABASE_URL=postgresql://user:password@host:5432/socialhub
REDIS_URL=redis://:password@host:6379

# Authentication & Encryption
JWT_SECRET=<generate-32-char-random-string>
TOKEN_ENCRYPTION_SECRET=<exactly-32-char-random-string>

# OAuth Credentials - LinkedIn
LINKEDIN_CLIENT_ID=<from-linkedin-developer-portal>
LINKEDIN_CLIENT_SECRET=<from-linkedin-developer-portal>

# OAuth Credentials - Instagram (Meta)
INSTAGRAM_CLIENT_ID=<from-meta-developer-portal>
INSTAGRAM_CLIENT_SECRET=<from-meta-developer-portal>

# OAuth Credentials - YouTube (Google)
YOUTUBE_CLIENT_ID=<from-google-cloud-console>
YOUTUBE_CLIENT_SECRET=<from-google-cloud-console>

# AI Provider (Optional)
OPENAI_API_KEY=<from-openai-dashboard>
```

#### Configuration Variables
```bash
# Application URLs
APP_BASE_URL=https://api.yourdomain.com
FRONTEND_URL=https://yourdomain.com

# Server Config
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# API Versions
LINKEDIN_API_VERSION=202502
META_API_VERSION=v23.0

# Autopilot AI Settings
AUTOPILOT_AI_ENABLED=false
AUTOPILOT_AI_PROVIDER=openai
AUTOPILOT_OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
AUTOPILOT_REQUEST_TIMEOUT_MS=30000
AUTOPILOT_RATE_LIMIT_WINDOW_MINUTES=60
AUTOPILOT_RATE_LIMIT_REQUESTS=10
AUTOPILOT_RATE_LIMIT_DRAFTS=50

# Media Storage
MEDIA_UPLOAD_DIR=/app/uploads
MAX_MEDIA_UPLOAD_BYTES=52428800

# Database Connection
DB_CONNECT_RETRIES=30
DB_CONNECT_DELAY_MS=1000
```

### Frontend Service

```bash
# API Endpoint
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api

# Build Config
NODE_ENV=production
```

### Worker Service

#### Required Secrets
```bash
# Database & Cache
DATABASE_URL=postgresql://user:password@host:5432/socialhub
REDIS_URL=redis://:password@host:6379

# Encryption (must match backend)
TOKEN_ENCRYPTION_SECRET=<same-as-backend-32-char-string>

# OAuth Credentials (same as backend)
LINKEDIN_CLIENT_ID=<same-as-backend>
LINKEDIN_CLIENT_SECRET=<same-as-backend>
YOUTUBE_CLIENT_ID=<same-as-backend>
YOUTUBE_CLIENT_SECRET=<same-as-backend>
```

#### Configuration Variables
```bash
# Backend Communication
BACKEND_URL=https://api.yourdomain.com

# Server Config
NODE_ENV=production

# API Versions
LINKEDIN_API_VERSION=202502
META_API_VERSION=v23.0

# YouTube Settings
YOUTUBE_PRIVACY_STATUS=unlisted

# Retry Configuration
PUBLISH_RETRY_ATTEMPTS=3
PUBLISH_RETRY_BASE_MS=1000
```

## Secrets Management Strategy

### Recommended Approach by Platform

#### Railway / Render
- Use built-in environment variable management
- Mark sensitive variables as "secret" (hidden in logs)
- Use service-to-service private networking for DATABASE_URL and REDIS_URL

#### DigitalOcean App Platform
- Store secrets in App-level environment variables
- Use DigitalOcean Managed Database connection strings
- Enable "Encrypt" option for sensitive variables

#### AWS / Self-Hosted
- Use AWS Secrets Manager or HashiCorp Vault
- Inject secrets at runtime via environment variables
- Never commit secrets to version control
- Rotate secrets quarterly (especially JWT_SECRET, OAuth secrets)

### Secret Generation Commands

```bash
# Generate JWT_SECRET (32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# Generate TOKEN_ENCRYPTION_SECRET (exactly 32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### OAuth Setup Checklist

1. **LinkedIn**
   - Create app at https://www.linkedin.com/developers
   - Add redirect URI: `https://api.yourdomain.com/api/social-accounts/oauth/linkedin/callback`
   - Request scopes: `openid`, `profile`, `w_member_social`

2. **Instagram (Meta)**
   - Create app at https://developers.facebook.com
   - Add Instagram Basic Display or Instagram Graph API product
   - Add redirect URI: `https://api.yourdomain.com/api/social-accounts/oauth/instagram/callback`
   - Required permissions: `instagram_basic`, `instagram_content_publish`

3. **YouTube (Google)**
   - Create project at https://console.cloud.google.com
   - Enable YouTube Data API v3
   - Create OAuth 2.0 credentials
   - Add redirect URI: `https://api.yourdomain.com/api/social-accounts/oauth/youtube/callback`
   - Required scopes: `youtube.upload`, `youtube.readonly`

## Database Migration Strategy

### Initial Setup

```bash
# The schema is applied automatically via Docker entrypoint
# For production, apply manually:

psql $DATABASE_URL < infra/sql/schema.sql
```

### Migration Approach

SocialHub currently uses a single `schema.sql` file with idempotent DDL statements (IF NOT EXISTS, IF EXISTS checks).

**Recommended for Production:**

1. **Version-controlled migrations** - Use a migration tool:
   ```bash
   npm install --save node-pg-migrate
   ```

2. **Migration workflow**:
   - Development: Create migration files for each schema change
   - Staging: Test migrations on staging database
   - Production: Run migrations during deployment window

3. **Backup before migration**:
   ```bash
   # Managed database providers usually have automatic backups
   # For self-hosted:
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql
   ```

4. **Zero-downtime strategy**:
   - Use backward-compatible migrations (add columns, not remove)
   - Deploy code changes after schema changes are applied
   - Schedule breaking changes during maintenance windows

### Current Schema Notes

The existing schema includes:
- Idempotent table creation (`CREATE TABLE IF NOT EXISTS`)
- Idempotent column additions (`ADD COLUMN IF NOT EXISTS`)
- Idempotent constraint modifications (using DO blocks)
- Safe for re-running on existing databases

## Worker Scaling Strategy

### Single Worker (Minimal)
**Cost**: ~$5-10/month
**Suitable for**: Up to 100 posts/day, 1-2 clients

```yaml
# Railway/Render config
instances: 1
resources:
  memory: 512MB
  cpu: 0.5
```

### Scaled Workers (Growth)
**Cost**: ~$20-40/month
**Suitable for**: 500+ posts/day, 5+ clients

```yaml
# Multiple worker instances
instances: 2-4
resources:
  memory: 1GB
  cpu: 1.0
```

### Auto-scaling Configuration

**BullMQ naturally handles multiple workers** - each worker instance processes jobs from the shared Redis queue.

**Scaling triggers**:
- Queue depth > 50 jobs
- Processing time > 5 minutes average
- Failed job rate > 10%

**Recommended settings** (Railway/Render):
```yaml
autoscaling:
  minReplicas: 1
  maxReplicas: 4
  targetCPU: 70%
  targetMemory: 80%
```

### Worker Monitoring

Monitor these metrics:
- Queue depth: `LLEN bull:post-publish:wait`
- Active jobs: `LLEN bull:post-publish:active`
- Failed jobs: `LLEN bull:post-publish:failed`
- Completed jobs: `LLEN bull:post-publish:completed`

## Logging and Error Monitoring

### Current State
- Basic `console.log`, `console.error`, `console.warn` statements
- No structured logging
- No external monitoring

### Recommended Additions

#### 1. Structured Logging

Add Winston or Pino for structured JSON logs:

```bash
npm install --save winston
```

**Logger setup** (`backend/src/utils/logger.js`):
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'socialhub-backend' },
  transports: [
    new winston.transports.Console()
  ]
});

module.exports = logger;
```

**Replace** `console.log` calls with:
```javascript
logger.info('Backend listening', { port, host });
logger.error('Database connection failed', { error: err.message });
logger.warn('Rate limit exceeded', { userId, clientId });
```

#### 2. Error Monitoring Services

**Option A: Sentry (Recommended)**
- Free tier: 5,000 errors/month
- Cost: $0-26/month (depending on volume)

```bash
npm install --save @sentry/node @sentry/integrations
```

**Setup** (`backend/src/app.js`):
```javascript
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1
  });
}
```

**Option B: LogTail / BetterStack**
- Free tier: 1GB logs/month
- Cost: $0-15/month

**Option C: Self-hosted Grafana Loki**
- Cost: Storage only (~$5/month for S3)
- Requires additional infrastructure

#### 3. Application Performance Monitoring (APM)

**For agencies with > 10 clients, consider:**
- New Relic (free tier available)
- Datadog (pay-per-use)
- Self-hosted: Prometheus + Grafana

### Logging Best Practices

1. **Log levels**:
   - `error`: Failed requests, database errors, publishing failures
   - `warn`: Rate limits, retries, deprecated features
   - `info`: Successful operations, startup messages
   - `debug`: Detailed operation flow (disabled in production)

2. **Include context**:
   ```javascript
   logger.info('Post published', {
     postId,
     clientId,
     platform,
     externalPostId
   });
   ```

3. **Avoid logging secrets**:
   - Never log tokens, passwords, API keys
   - Redact sensitive fields in structured logs

4. **Log retention**:
   - Keep logs for 30 days minimum
   - Archive critical logs (errors) for 90 days

## Media Storage Strategy

### Current Implementation
- Local filesystem storage in `/app/uploads`
- Not suitable for multi-instance deployments
- Not persistent across container restarts

### Production Recommendation: S3-Compatible Storage

**Option A: AWS S3**
- Cost: ~$0.023/GB/month + $0.0004/1000 GET requests
- Expected: ~$5-15/month for 100GB storage

**Option B: DigitalOcean Spaces**
- Cost: $5/month for 250GB + 1TB transfer

**Option C: Cloudflare R2**
- Cost: Free egress, $0.015/GB storage
- Expected: ~$1.50/month for 100GB

### Migration to S3

1. Install AWS SDK:
```bash
npm install --save @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

2. Update `backend/src/config/media.js`:
```javascript
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT; // For DigitalOcean/Cloudflare
```

3. Add environment variables:
```bash
S3_BUCKET=socialhub-media
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=<secret>
S3_SECRET_ACCESS_KEY=<secret>
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com  # Optional
```

## SSL/TLS Configuration

### Managed Platforms (Railway, Render, Vercel)
- Automatic SSL certificates via Let's Encrypt
- No configuration needed

### Self-Hosted (Docker on VPS)
- Use Caddy or Nginx reverse proxy
- Automatic Let's Encrypt certificate provisioning

**Caddy example** (`Caddyfile`):
```
yourdomain.com {
  reverse_proxy frontend:3000
}

api.yourdomain.com {
  reverse_proxy backend:4000
}
```

## Health Checks and Uptime Monitoring

### Backend Health Endpoint

Add to `backend/src/app.js`:
```javascript
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});
```

### Uptime Monitoring Services

**Free Options**:
- UptimeRobot (50 monitors free)
- BetterUptime (10 monitors free)
- Pingdom (free tier)

**Configuration**:
- Monitor: `https://api.yourdomain.com/health`
- Interval: 5 minutes
- Alert channels: Email, Slack, PagerDuty

## Deployment Workflow

### Recommended CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run tests
        run: |
          cd backend && npm test
      
      - name: Deploy to Railway
        uses: railway-app/railway-deploy@v1
        with:
          service: backend
          token: ${{ secrets.RAILWAY_TOKEN }}
```

### Deployment Checklist

- [ ] Run database backups
- [ ] Verify environment variables are set
- [ ] Test OAuth redirect URIs in platform developer consoles
- [ ] Deploy backend first, then worker, then frontend
- [ ] Run smoke tests after deployment
- [ ] Monitor error rates for 15 minutes post-deploy
- [ ] Verify scheduled posts are processing

## Minimal Cost Estimate

### Option 1: Railway (Recommended for MVP)

| Service | Plan | Cost |
|---------|------|------|
| Backend | 1GB RAM, shared CPU | $5/month |
| Worker | 512MB RAM | $5/month |
| Frontend | Static/Next.js | $0 (Vercel free) |
| PostgreSQL | Railway Postgres | $5/month |
| Redis | Railway Redis | $5/month |
| **Total** | | **$20/month** |

**Includes**: Auto-scaling, SSL, CI/CD, monitoring dashboard

### Option 2: DigitalOcean App Platform

| Service | Plan | Cost |
|---------|------|------|
| Backend + Worker | Basic 1GB | $12/month |
| Frontend | Static site | $0 (or $5 for Next.js) |
| PostgreSQL | Managed DB (1GB) | $15/month |
| Redis | Managed Redis (1GB) | $15/month |
| **Total** | | **$42-47/month** |

**Includes**: Automatic backups, SSL, firewall, monitoring

### Option 3: Self-Hosted VPS

| Service | Plan | Cost |
|---------|------|------|
| VPS | 4GB RAM / 2 vCPU | $12/month (Hetzner) |
| Backups | S3-compatible storage | $5/month |
| Domain | .com domain | $12/year (~$1/month) |
| **Total** | | **$18/month** |

**Requires**: DevOps knowledge, manual SSL setup, monitoring configuration

### Additional Costs (Optional)

| Service | Cost | When Needed |
|---------|------|-------------|
| Sentry error tracking | $0-26/month | >5,000 errors/month |
| S3 media storage | $5-15/month | When scaling to multiple instances |
| OpenAI API | Pay-per-use | If using AI Autopilot |
| Custom domain | $12/year | Production launch |
| BetterStack logging | $0-15/month | >1GB logs/month |

### Estimated Monthly Costs by Scale

- **MVP / Single Agency**: $20-30/month (Railway + Vercel)
- **Growing (5-10 clients)**: $50-75/month (DigitalOcean or Railway pro)
- **Established (20+ clients)**: $100-200/month (Scaled workers, monitoring, storage)

## Pre-Deployment Checklist

### Security
- [ ] Generate strong JWT_SECRET (32+ characters)
- [ ] Generate TOKEN_ENCRYPTION_SECRET (exactly 32 characters)
- [ ] Set NODE_ENV=production for all services
- [ ] Configure CORS with specific FRONTEND_URL (no wildcards)
- [ ] Review OAuth redirect URIs match production domains
- [ ] Enable HTTPS/SSL for all services
- [ ] Rotate all secrets from development

### Infrastructure
- [ ] Provision managed PostgreSQL database
- [ ] Provision managed Redis instance
- [ ] Set up automated database backups
- [ ] Configure environment variables for all services
- [ ] Set up health check endpoints
- [ ] Configure uptime monitoring
- [ ] Set up error tracking (Sentry/LogTail)

### Application
- [ ] Test OAuth flows with production URLs
- [ ] Verify media uploads work
- [ ] Test post creation and approval flow
- [ ] Test worker job processing
- [ ] Verify publishing to LinkedIn/Instagram/YouTube
- [ ] Test magic link approvals
- [ ] Verify link tracking and redirection

### Monitoring
- [ ] Set up uptime alerts
- [ ] Configure error notification channels
- [ ] Set up log aggregation
- [ ] Document runbook for common issues
- [ ] Set up on-call rotation (if team-based)

## Troubleshooting Common Production Issues

### Database Connection Failures
```bash
# Check connection string format
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Increase retry attempts
DB_CONNECT_RETRIES=60
```

### Worker Not Processing Jobs
```bash
# Check Redis connection
redis-cli -u $REDIS_URL ping

# Check queue depth
redis-cli -u $REDIS_URL LLEN bull:post-publish:wait

# Check failed jobs
redis-cli -u $REDIS_URL LLEN bull:post-publish:failed
```

### OAuth Redirect Mismatch
- Verify `APP_BASE_URL` matches registered OAuth redirect URI
- Check platform developer console settings
- Ensure no trailing slashes in URLs

### Media Upload Failures
- Check `MAX_MEDIA_UPLOAD_BYTES` setting
- Verify `MEDIA_UPLOAD_DIR` exists and is writable
- Consider switching to S3 for multi-instance deployments

### Rate Limiting Issues
- Check Autopilot rate limit settings
- Review `workspace_ai_generation_usage` table
- Adjust `AUTOPILOT_RATE_LIMIT_*` variables

## Performance Optimization Recommendations

### Database
1. Add connection pooling limits:
   ```javascript
   const pool = new Pool({
     connectionString: process.env.DATABASE_URL,
     max: 20,  // Maximum pool size
     idleTimeoutMillis: 30000,
     connectionTimeoutMillis: 2000,
   });
   ```

2. Create additional indexes for common queries:
   ```sql
   CREATE INDEX CONCURRENTLY idx_posts_status_scheduled ON posts(status, scheduled_time);
   CREATE INDEX CONCURRENTLY idx_posts_approval_status_client ON posts(approval_status, client_id);
   ```

### Redis
1. Enable persistence (RDB + AOF) for managed Redis
2. Set memory eviction policy: `noeviction` (prevent job loss)
3. Monitor memory usage and scale accordingly

### Application
1. Enable response compression (gzip)
2. Add request rate limiting per user
3. Implement response caching for GET endpoints
4. Use database connection pooling
5. Add CDN for static frontend assets

## Disaster Recovery Plan

### Backup Strategy
- **Database**: Daily automated backups (retained 7 days)
- **Redis**: Not critical (jobs can be replayed)
- **Media files**: Sync to S3 (with versioning enabled)
- **Configuration**: Store environment variables in password manager

### Recovery Procedures

**Database corruption**:
1. Restore from most recent backup
2. Replay missed transactions from application logs (if available)
3. Verify data integrity

**Service outage**:
1. Check platform status page
2. Verify health check endpoints
3. Review application logs
4. Scale up resources if needed
5. Restart services via platform dashboard

**Data breach**:
1. Immediately rotate all secrets
2. Review access logs
3. Notify affected users
4. Enable 2FA for platform accounts

## Next Steps After Deployment

1. **Week 1**: Monitor error rates, response times, job processing
2. **Week 2**: Set up automated backups verification
3. **Month 1**: Review costs and optimize resource allocation
4. **Month 3**: Implement application performance monitoring (APM)
5. **Ongoing**: Regular security updates, dependency updates, secret rotation

## Support and Maintenance

### Regular Maintenance Tasks
- **Weekly**: Review error logs, check disk space
- **Monthly**: Update dependencies, review security advisories
- **Quarterly**: Rotate secrets, review access controls, optimize database
- **Annually**: Audit OAuth application permissions, review cost optimization

### Monitoring Dashboards

Set up dashboards for:
1. **Application Health**: Response times, error rates, uptime
2. **Business Metrics**: Posts created, approvals, publish success rate
3. **Infrastructure**: CPU, memory, disk usage, queue depth
4. **Cost Tracking**: Service costs, API usage, storage costs

---

**Document Version**: 1.0  
**Last Updated**: 2026-03-22  
**Maintained By**: Engineering Team
