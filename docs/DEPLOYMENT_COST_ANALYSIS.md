# Deployment Cost Analysis - Shift Schedule Manager with OR-Tools

## Executive Summary

**AWS Free Tier**: ❌ **TIDAK CUKUP** - Aplikasi membutuhkan minimal 9.5GB RAM, Free Tier hanya 1GB
**Biaya Minimum AWS**: ~**$50-70/bulan** (EC2 t3.xlarge)
**Alternatif Terbaik**: **Railway.app** atau **Render.com** (~$20-30/bulan)
**Rekomendasi**: **Railway.app** dengan Hobby Plan ($5/bulan per service)

---

## Resource Requirements Analysis

### Production Architecture (docker-compose.yml)

| Service | Memory Limit | CPU Limit | Critical? |
|---------|--------------|-----------|-----------|
| **nginx** | 512MB | 1.0 core | ✅ Yes |
| **ai-server** (2 replicas) | 4GB × 2 = 8GB | 2.0 × 2 = 4.0 cores | ⚠️ Optional (legacy TensorFlow.js) |
| **ortools-optimizer** | 1GB | 2.0 cores | ✅ Yes |
| **go-websocket-server** (3 replicas) | 512MB × 3 = 1.5GB | 1.0 × 3 = 3.0 cores | ✅ Yes |
| **redis** | 512MB | 0.5 core | ✅ Yes |
| **postgres** | 1GB | 1.0 core | ⚠️ Optional (using Supabase) |

### Total Requirements (Full Stack)

**Scenario 1: Full Production (All Services)**
- **Total RAM**: 11.5GB
- **Total CPU**: 11.5 cores
- **Storage**: ~5GB (Docker images + data)
- **Network**: ~10GB/month outbound

**Scenario 2: Minimal Production (Without AI Server)**
- **Total RAM**: 3.5GB (nginx + Go + OR-Tools + Redis)
- **Total CPU**: 4.5 cores
- **Storage**: ~3GB
- **Network**: ~5GB/month outbound

**Scenario 3: Ultra Minimal (Go + OR-Tools only, external Supabase)**
- **Total RAM**: 2.5GB (nginx + Go + OR-Tools)
- **Total CPU**: 4.0 cores
- **Storage**: ~2GB
- **Network**: ~3GB/month outbound

---

## AWS Free Tier Limitations

### What's Available FREE (12 months)

| Service | Free Tier Limit | Your Need | Gap |
|---------|----------------|-----------|-----|
| **EC2 t2.micro** | 750 hours/month, 1GB RAM, 1 vCPU | 3.5GB RAM, 4.5 CPU | ❌ **-2.5GB RAM, -3.5 CPU** |
| **RDS db.t3.micro** | 750 hours/month, 1GB RAM | Not needed (Supabase) | ✅ N/A |
| **EBS Storage** | 30GB | 5GB | ✅ Enough |
| **Data Transfer** | 15GB outbound/month | ~5-10GB | ✅ Enough |
| **Elastic Load Balancer** | Not free | Needed for 3 Go replicas | ❌ **+$16/month** |

### Conclusion: AWS Free Tier ❌ TIDAK CUKUP

Free Tier hanya menyediakan 1GB RAM, aplikasi Anda minimal butuh **3.5GB RAM** (tanpa AI server).

---

## AWS Paid Options

### Option 1: Single EC2 Instance (Minimal Production)

**Instance Type**: `t3.xlarge` (4 vCPU, 16GB RAM)

| Cost Component | Monthly Cost |
|----------------|--------------|
| EC2 t3.xlarge (us-east-1) | $121.76 |
| EBS 30GB gp3 | $2.40 |
| Elastic IP | $3.65 |
| Data Transfer (10GB) | $0.90 |
| **Total** | **~$128.71/month** |

**Pros**: ✅ Cukup untuk semua services + monitoring
**Cons**: ❌ Terlalu mahal untuk fresh graduate portfolio

### Option 2: Multiple Small Instances (NOT RECOMMENDED)

Split services ke multiple t3.small/t3.medium instances.

**Estimated Cost**: $80-120/month
**Why Not**: Kompleksitas tinggi, biaya hampir sama dengan single xlarge

### Option 3: AWS Lightsail

**Instance**: $40/month (8GB RAM, 2 vCPU, 4TB transfer)

| Cost Component | Monthly Cost |
|----------------|--------------|
| Lightsail 8GB | $40 |
| Additional storage | $0-5 |
| **Total** | **~$40-45/month** |

**Pros**: ✅ Lebih murah dari EC2, UI sederhana
**Cons**: ⚠️ RAM cukup tapi CPU kurang (2 vCPU vs need 4.5), tidak ada load balancer

---

## Better Alternatives (RECOMMENDED)

### 🏆 Option A: Railway.app (BEST FOR PORTFOLIO)

**Pricing**: Pay-per-use, $5/month per service (Hobby Plan)

#### Minimal Deployment (3 services)

| Service | RAM | Cost/Month |
|---------|-----|------------|
| nginx + React static | 512MB | $5 |
| go-websocket-server | 1GB | $5 |
| ortools-optimizer | 1GB | $5 |
| **Redis** | Included free | $0 |
| **Supabase** | External (already have) | $0 |
| **Total** | **2.5GB** | **$15/month** |

#### Full Deployment (with AI server)

| Service | RAM | Cost/Month |
|---------|-----|------------|
| nginx + React static | 512MB | $5 |
| go-websocket-server | 1GB | $5 |
| ortools-optimizer | 1GB | $5 |
| ai-server | 2GB | $10 (2 units) |
| Redis | 512MB | $5 |
| **Total** | **5GB** | **$30/month** |

**Why Railway?**
- ✅ Automatic Docker deployment from GitHub
- ✅ Zero-config PostgreSQL/Redis/MySQL
- ✅ Built-in CI/CD and previews
- ✅ Free tier: $5 credit/month (enough for testing)
- ✅ Easy WebSocket support
- ✅ Custom domains + SSL free
- ✅ No credit card untuk trial

**Railway vs AWS**:
- Railway $15/month vs AWS $128/month
- **Savings: $113/month (88% cheaper)**

### Option B: Render.com

**Pricing**: Fixed pricing per service

| Service Type | Specs | Cost/Month |
|--------------|-------|------------|
| Web Service | 512MB RAM | $7 |
| Web Service | 2GB RAM | $25 |
| PostgreSQL | 1GB RAM | $7 (not needed) |
| Redis | 1GB RAM | $10 (not needed) |

#### Minimal Deployment

| Service | Plan | Cost/Month |
|---------|------|------------|
| React + nginx | Static site | $0 (free tier) |
| go-websocket-server | Starter (512MB) | $7 |
| ortools-optimizer | Starter (512MB) | $7 |
| **Total** | | **$14/month** |

**Notes**:
- ⚠️ Free tier has 750h/month limit (same as AWS Free Tier)
- ⚠️ Services sleep after 15 mins inactivity (not good for WebSocket)
- ✅ Upgrade to Starter ($7/month) for always-on

**Why Render?**
- ✅ Even cheaper than Railway for minimal setup
- ✅ Free static site hosting (React build)
- ✅ Automatic SSL + CDN
- ✅ Docker support
- ❌ No built-in Redis (must use external)

### Option C: Fly.io

**Pricing**: Pay-per-use, generous free tier

#### Free Tier (Permanent)

- 3 shared-cpu-1x VMs (256MB RAM each) = 768MB total
- 3GB persistent volume storage
- 160GB outbound data transfer

#### Minimal Deployment (Free Tier)

| Service | RAM | Cost/Month |
|---------|-----|------------|
| go-websocket-server | 256MB | $0 |
| ortools-optimizer | 512MB | $0 (scale down) |
| Static site | 256MB | $0 |
| **Total** | **1GB** | **$0/month (Free!)** |

**With Paid Scaling**:

| Service | RAM | Cost/Month |
|---------|-----|------------|
| go-websocket-server (3 replicas) | 256MB × 3 | ~$5 |
| ortools-optimizer | 1GB | ~$10 |
| nginx + React | 512MB | ~$3 |
| **Total** | **2.5GB** | **$18/month** |

**Why Fly.io?**
- ✅ **FREE TIER yang generous** (256MB × 3 VMs)
- ✅ Global edge network (low latency)
- ✅ Built-in load balancing
- ✅ PostgreSQL included free (not needed, have Supabase)
- ❌ Learning curve lebih tinggi (Fly.toml config)

### Option D: DigitalOcean App Platform

**Pricing**: Similar to Render

| Service | Plan | Cost/Month |
|---------|------|------------|
| Basic (512MB) | Static + 1 service | $5 |
| Professional (1GB) | Per service | $12 |

#### Minimal Deployment

| Service | Plan | Cost/Month |
|---------|-----|------------|
| React static site | Static | $0 |
| go-websocket-server | Basic (512MB) | $5 |
| ortools-optimizer | Basic (512MB) | $5 |
| **Total** | | **$10/month** |

**Why DigitalOcean?**
- ✅ Cheapest for basic deployment
- ✅ Simple UI and documentation
- ✅ Good for beginners
- ⚠️ Limited to 1 region (no global CDN)

### Option E: Heroku (NOT RECOMMENDED)

**Pricing**: Eco Dynos $5/month, Basic $7/month

**Why Not?**:
- ❌ No free tier anymore (sejak Nov 2022)
- ❌ More expensive than Railway/Render
- ❌ Limited memory (512MB max for Eco)
- ⚠️ Better alternatives available

---

## Comparison Table: All Options

| Platform | Minimal Cost | Full Cost | Free Tier? | Docker? | CI/CD? | Ease of Use | Best For |
|----------|--------------|-----------|------------|---------|--------|-------------|----------|
| **AWS EC2** | $128/month | $200+/month | ⚠️ 12 months, insufficient | ✅ | ⚠️ Manual | ⭐⭐ | Enterprise |
| **AWS Lightsail** | $40/month | $80/month | ❌ | ✅ | ⚠️ Manual | ⭐⭐⭐ | Simple apps |
| **Railway** | $15/month | $30/month | ✅ $5 credit | ✅ | ✅ | ⭐⭐⭐⭐⭐ | **Portfolio (BEST)** |
| **Render** | $14/month | $40/month | ✅ 750h | ✅ | ✅ | ⭐⭐⭐⭐ | Budget |
| **Fly.io** | $0/month | $18/month | ✅ Generous | ✅ | ✅ | ⭐⭐⭐ | **Free tier (BEST)** |
| **DigitalOcean** | $10/month | $30/month | ⚠️ $200 credit | ✅ | ✅ | ⭐⭐⭐⭐ | Beginners |
| **Heroku** | $12/month | $40/month | ❌ | ⚠️ | ✅ | ⭐⭐⭐⭐⭐ | Legacy apps |

---

## Recommended Deployment Strategy

### Phase 1: Portfolio Demo (FREE)

**Platform**: Fly.io Free Tier

**Services**:
1. **Go WebSocket Server** (256MB × 3 replicas) - FREE
2. **OR-Tools Optimizer** (256MB, scaled down) - FREE
3. **React Static Build** (nginx) - FREE
4. **Supabase** (external, already have)

**Total Cost**: **$0/month** ✅

**Limitations**:
- OR-Tools might be slow with 256MB RAM (reduce to single-staff optimization)
- No AI server (not critical, TensorFlow.js is legacy)
- Shared CPU (slower than dedicated)

**Perfect For**:
- Portfolio showcase
- Thesis demonstration
- Employer demo during interview

### Phase 2: Job Application Period (LOW COST)

**Platform**: Railway.app Hobby Plan

**Services**:
1. **nginx + React static** (512MB) - $5/month
2. **go-websocket-server** (1GB) - $5/month
3. **ortools-optimizer** (1GB) - $5/month
4. **Redis** (included free)
5. **Supabase** (external)

**Total Cost**: **$15/month** ✅

**Benefits**:
- Always-on (no cold starts)
- Full 1GB RAM for OR-Tools (fast optimization)
- Custom domain + SSL
- GitHub auto-deploy

**Perfect For**:
- Active job search (3-6 months)
- Employer live testing
- Interview technical demos

### Phase 3: If Hired (SCALE UP)

**Platform**: Railway.app or AWS Lightsail

**Option A**: Railway Full Stack - $30/month
- Add AI server (2GB) + monitoring

**Option B**: AWS Lightsail 8GB - $40/month
- More resources, professional setup
- Good impression for employer

---

## Architecture Optimization for Cost Reduction

### 1. Remove AI Server (TensorFlow.js)

**Current**: AI server uses 8GB RAM (2 replicas × 4GB)
**Status**: Legacy system, replaced by OR-Tools
**Action**: Remove from docker-compose.yml

**Savings**: -8GB RAM, -$20/month on Railway

### 2. Reduce Go Server Replicas

**Current**: 3 replicas × 512MB = 1.5GB
**Minimal**: 1 replica × 1GB = 1GB
**Action**: Change `replicas: 3` to `replicas: 1` in docker-compose.yml

**Savings**: -512MB RAM, not critical for portfolio (1000+ users testing not needed)

### 3. Use Supabase (Already Implemented)

**Current**: postgres service in docker-compose (optional)
**Status**: Already using external Supabase
**Action**: Don't deploy postgres container

**Savings**: -1GB RAM, -$7/month

### 4. Optimize OR-Tools Memory

**Current**: 1GB RAM limit
**Optimization**:
```python
# In scheduler.py, reduce solver workers
solver.parameters.num_search_workers = 2  # Instead of 4
```

**Potential**: Run on 512MB for small datasets (15-20 staff)

---

## Ultra-Minimal Deployment (Recommended for Portfolio)

### Configuration

**File**: `docker-compose.minimal.yml` (create new)

```yaml
services:
  nginx:
    # Same as production
    deploy:
      resources:
        limits:
          memory: 256M  # Reduced from 512M

  go-websocket-server:
    # Single replica instead of 3
    deploy:
      replicas: 1
      resources:
        limits:
          memory: 512M
          cpus: '1.0'

  ortools-optimizer:
    deploy:
      resources:
        limits:
          memory: 512M  # Reduced from 1GB
          cpus: '1.0'

  # Remove: ai-server, postgres
  # External: Supabase, no Redis needed for demo
```

**Total Requirements**:
- RAM: 1.3GB (nginx 256MB + Go 512MB + OR-Tools 512MB)
- CPU: 2.0 cores
- Storage: 2GB

**Deployment Cost**:
- **Fly.io Free Tier**: $0/month ✅ (fits in 3 × 256MB VMs with scaling)
- **Railway**: $10/month (2 services × $5)
- **Render**: $7/month (1 service + free static)

---

## Cost Breakdown by Use Case

### Use Case 1: Thesis Defense Demo (1-2 weeks)

**Platform**: Fly.io Free Tier
**Cost**: **$0**
**Setup Time**: 2-3 hours
**Justification**: Short-term, free, sufficient for thesis committee demo

### Use Case 2: Portfolio for Job Applications (3-6 months)

**Platform**: Railway.app Hobby Plan
**Cost**: **$15/month × 6 months = $90 total**
**Setup Time**: 1 hour (GitHub auto-deploy)
**Justification**: Always-on, professional domain, fast response, good impression

### Use Case 3: Production Use by Hotel (Paid Client)

**Platform**: AWS Lightsail or DigitalOcean
**Cost**: **$40-80/month** (billed to client)
**Setup Time**: 4-8 hours (full monitoring, backup, SSL)
**Justification**: Reliable, scalable, professional SLA

---

## Final Recommendation

### For Your Current Situation (Fresh Graduate Portfolio)

**Best Choice**: **Railway.app** - $15/month

**Why?**
1. ✅ **Affordable**: $15/month vs AWS $128/month (88% cheaper)
2. ✅ **Professional**: Custom domain, SSL, always-on
3. ✅ **Zero DevOps**: GitHub push = auto-deploy
4. ✅ **Impressive**: Employer can test anytime, no cold starts
5. ✅ **Scalable**: Easy to upgrade when needed
6. ✅ **Portfolio Ready**: Perfect for job interviews

**Alternative Free Option**: **Fly.io** - $0/month
- Good for thesis demo
- Acceptable for portfolio with caveat ("optimized for cost")
- Upgrade to paid when actively applying

### Deployment Timeline

**Week 1**: Deploy to Fly.io Free Tier (portfolio demo)
**When Applying**: Upgrade to Railway $15/month (professional impression)
**If Hired**: Migrate to AWS/DO $40/month (production-ready)

---

## Action Items

### Immediate (This Week)

1. ✅ Create Railway.app account (free, no credit card)
2. ✅ Test Fly.io free deployment
3. ✅ Create `docker-compose.minimal.yml` for cost optimization
4. ✅ Update README.md with deployment options

### Before Job Applications (Next Month)

1. Deploy to Railway Hobby Plan ($15/month)
2. Setup custom domain (portfolio.yourname.com)
3. Add SSL certificate (Railway provides free)
4. Test with 10+ concurrent users
5. Setup monitoring (Railway dashboard)

### Optional (If Budget Allows)

1. Add Sentry error tracking ($0 - free tier)
2. Add Google Analytics ($0)
3. Setup automated backups (Railway)
4. Create staging environment (Railway preview)

---

## Appendix: Detailed Cost Calculations

### AWS EC2 t3.xlarge Breakdown (Tokyo Region ap-northeast-1)

| Component | Specs | Unit Price | Monthly Cost |
|-----------|-------|------------|--------------|
| EC2 Instance | 4 vCPU, 16GB RAM | $0.1664/hour | $121.76 |
| EBS Volume | 30GB gp3 | $0.08/GB-month | $2.40 |
| Elastic IP | 1 IP | $3.65/month | $3.65 |
| Data Transfer | 10GB outbound | $0.09/GB | $0.90 |
| Application Load Balancer | 1 ALB | $16.20/month | $16.20 |
| **Total** | | | **$144.91/month** |

**With 1-year Reserved Instance**: $86/month (40% cheaper)
**With 3-year Reserved Instance**: $55/month (62% cheaper)

### Railway.app Detailed Pricing

**Pricing Model**: $0.000231/GB-hour RAM usage

**Example**: 1GB service running 24/7
- Hours per month: 730 hours
- Usage: 1GB × 730 hours = 730 GB-hours
- Cost: 730 × $0.000231 = $0.17/month

**BUT**: Railway charges minimum $5/month per service (Hobby Plan)

**Your Deployment**:
- nginx (512MB): $5/month
- Go server (1GB): $5/month
- OR-Tools (1GB): $5/month
- **Total**: $15/month

**If using Pro Plan** ($20/month base + usage):
- Same services: $20 + $0.51 = $20.51/month
- **Not worth it** for minimal deployment

---

## Conclusion

**AWS Free Tier**: ❌ Tidak cukup untuk production deployment
**Minimum AWS Cost**: ~$128/month (terlalu mahal untuk portfolio)

**Recommended Solution**:
- **Railway.app** - $15/month untuk active job search
- **Fly.io** - $0/month untuk portfolio demo only

**Cost Savings**: Up to 100% (free) or 88% (Railway vs AWS)

**Best Strategy**: Start free (Fly.io), upgrade to Railway when applying, scale to AWS/DO if hired.
