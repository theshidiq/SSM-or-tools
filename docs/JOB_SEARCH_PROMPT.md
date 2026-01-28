# Job Search Prompt for Claude Desktop

This document contains prompts for using Claude Desktop with MCP (Model Context Protocol) to search for relevant job opportunities in Japan based on this portfolio project.

---

## Quick Start Prompt (Recommended)

Copy and paste this into Claude Desktop:

```
Search Indeed Japan for software engineering positions matching this profile:

TECH STACK:
React 18, Go, Python, Google OR-Tools, WebSocket, Docker, PostgreSQL

EXPERIENCE:
- Built shift scheduling system with OR-Tools CP-SAT (94% time reduction)
- Hybrid architecture supporting 1000+ concurrent users
- Real-time WebSocket communication (<50ms latency)
- Production deployment with load balancing

TARGET ROLES:
1. Full Stack Engineer (React + Go/Python)
2. Backend Engineer (Go, real-time systems)
3. Optimization Engineer (OR, constraint programming)
4. Software Engineer at product companies

LOCATION: Tokyo, Japan (visa sponsorship needed)
SALARY: ¥6,000,000+ per year
LANGUAGE: English OK or Japanese business level

KEYWORDS:
English: "Software Engineer" React Go Python, "Optimization Engineer", "Backend Engineer" WebSocket
Japanese: ソフトウェアエンジニア React Go Python, 最適化エンジニア, バックエンドエンジニア

FILTER:
- Posted last 30 days
- Full-time positions
- Not SES/派遣/outsourcing
- Visa sponsorship available

PROVIDE FOR EACH RESULT:
- Company name and description
- Position title
- Requirements match percentage
- Salary range
- Location and remote options
- Application link

Please find top 10-15 most relevant positions.
```

---

## Comprehensive Prompt (Detailed Search)

For more detailed search with specific filtering:

```
I need help finding relevant job opportunities in Japan using Indeed MCP integration. Based on my portfolio project, please search for positions that match my technical skills.

MY TECHNICAL PROFILE:

Core Technologies:
- Frontend: React 18, JavaScript/ES6+, Tailwind CSS, React Query
- Backend: Go 1.21+ (WebSocket, concurrency), Python 3.11+ (OR-Tools, Flask)
- Optimization: Google OR-Tools CP-SAT, Constraint Programming
- Database: PostgreSQL (Supabase), SQL, Real-time subscriptions
- Infrastructure: Docker, NGINX, Load Balancing, Horizontal Scaling

Project Highlights:
- Built production shift scheduling system with 94% time reduction
- Implemented Google OR-Tools CP-SAT with 10+ constraints
- Hybrid architecture supporting 1000+ concurrent users
- Achieved <50ms UI response time via WebSocket
- Developed 4 conflict resolution strategies
- Bilingual Japanese/English application
- Research-backed (Design Science Research methodology)

Languages:
- English: Professional working proficiency
- Japanese: Business level (built Japanese-localized app)
- Indonesian: Native

JOB SEARCH CRITERIA:

Target Positions:
1. Software Engineer / Full Stack Developer
   - Optimization, scheduling, operations research
   - React + Go/Python stack
   - Mathematical optimization

2. Backend Engineer (Go/Python)
   - WebSocket/real-time systems
   - Microservices architecture
   - High-concurrency (1000+ users)

3. Optimization Engineer / OR Engineer
   - Operations research applications
   - CP-SAT, linear programming
   - Scheduling, resource allocation

4. Research Engineer / Applied Scientist
   - Design Science Research valued
   - Academic CS background
   - Thesis work relevant

Location:
- Primary: Tokyo
- Secondary: Osaka, Yokohama, Fukuoka
- Open to: Remote from Japanese companies

Company Types:
- Tech startups (Series A-D)
- Product companies (not consulting)
- Engineering-driven culture
- International teams
- Modern stack (React, Go, Python, Docker)

Requirements:
MUST HAVE:
- Visa sponsorship available
- English OK or Japanese support
- Modern tech stack
- Product development (not SES)

NICE TO HAVE:
- Remote work options
- Flexible hours
- Stock options
- English as working language

Salary:
- Minimum: ¥6,000,000/year
- Target: ¥8,000,000 - ¥12,000,000/year
- Senior: ¥10,000,000+/year

SEARCH INSTRUCTIONS:

1. Search Indeed Japan for matching positions
2. Filter by:
   - Posted within 30 days
   - Full-time only
   - Visa sponsorship
   - Salary ≥¥6M (if listed)

3. Provide for each result:
   - Company name and description
   - Position title
   - Requirements match (%)
   - Salary range
   - Location/remote
   - Application deadline
   - Direct link

4. Prioritize:
   - React + Go/Python stack
   - Optimization/scheduling roles
   - English-friendly companies
   - Product over consulting
   - Well-funded startups

5. Flag where:
   - OR-Tools experience is differentiator
   - Portfolio directly relates
   - Constraint programming mentioned
   - Research/engineering hybrid

Portfolio: https://github.com/theshidiq/SSM-or-tools

Please provide top 10-15 most relevant positions.
```

---

## Follow-up Prompts

After initial search results, use these prompts for deeper analysis:

### Analyze Match Quality
```
For the top 5 positions from the search results, analyze:
1. Technical skills match percentage
2. How my OR-Tools portfolio gives competitive advantage
3. Gaps in my experience (if any)
4. Recommended talking points for each position
```

### Customize Application Materials
```
For [Company Name] - [Position Title], help me:
1. Draft cover letter highlighting relevant portfolio achievements
2. Suggest 3 specific examples from my project to mention
3. Identify keywords from job description to emphasize
4. Recommend portfolio sections to highlight in application
```

### Salary Negotiation
```
Based on these positions and my portfolio:
1. Analyze salary ranges in Japan for my skill level
2. Calculate my market value (mid-level vs senior)
3. Suggest negotiation strategy
4. Estimate total compensation including benefits
```

### Company Research
```
For these companies:
1. Research their tech stack and engineering culture
2. Find news about recent funding or growth
3. Identify mutual connections (if any)
4. Assess work-life balance and visa support reputation
```

### Resume Tailoring
```
Optimize my resume for Japan job market:
1. Highlight OR-Tools and optimization experience
2. Quantify achievements (94% improvement, 1000+ users)
3. Format for Japanese ATS systems
4. Balance technical depth with readability
```

---

## Search Keywords Reference

### English Keywords

**Primary**:
- "Software Engineer" + "React" OR "Go" OR "Python"
- "Full Stack Developer" + "WebSocket" OR "Real-time"
- "Backend Engineer" + "Go" OR "Golang"
- "Optimization Engineer" OR "OR Engineer"
- "Mathematical Optimization" OR "Constraint Programming"

**Domain-Specific**:
- "Scheduling System" OR "Resource Allocation"
- "Operations Research"
- "Real-time Collaboration"
- "Microservices Architecture"

### Japanese Keywords (日本語)

**Primary**:
- ソフトウェアエンジニア React OR Go OR Python
- フルスタックエンジニア WebSocket OR リアルタイム
- バックエンドエンジニア Go OR Golang
- 最適化エンジニア OR オペレーションズリサーチ

**Domain-Specific**:
- 数理最適化 OR 制約プログラミング
- スケジューリングシステム OR リソース配分
- リアルタイム通信
- マイクロサービスアーキテクチャ

---

## Target Companies (Examples)

Companies in Japan that might value this skillset:

### Tech Startups
- **Mercari** - E-commerce platform (Go, microservices)
- **SmartNews** - News aggregation (optimization, real-time)
- **Preferred Networks** - Deep learning, optimization
- **PKSHA Technology** - AI/optimization solutions

### Product Companies
- **Rakuten** - E-commerce (multi-language, scale)
- **LINE** - Messaging platform (real-time, Go)
- **CyberAgent** - Media/Ad tech (optimization)
- **DeNA** - Gaming/tech (real-time systems)

### Research-Oriented
- **NTT Data** - R&D divisions
- **Hitachi** - AI/Optimization labs
- **Fujitsu** - Research centers
- **Sony** - AI research

### International Companies
- **Google Japan** - Engineering roles
- **Amazon Japan** - Optimization teams
- **Microsoft Japan** - Cloud engineering
- **Meta** - Engineering roles

---

## Application Strategy

### Resume Highlights (Top 3 Points)

1. **Optimization Expertise**
   - "Implemented Google OR-Tools CP-SAT solver achieving 94% time reduction"
   - "Designed penalty-based optimization handling 10+ hard/soft constraints"

2. **Production System Experience**
   - "Built hybrid architecture supporting 1000+ concurrent users"
   - "Achieved <50ms UI latency through WebSocket optimization"

3. **Full-Stack & Research**
   - "Developed bilingual (Japanese/English) production application"
   - "Research-backed implementation using Design Science methodology"

### Portfolio Presentation

**GitHub README**: https://github.com/theshidiq/SSM-or-tools
- Leads with quantifiable metrics (94% improvement)
- Professional documentation (no excessive emojis)
- Complete architecture documentation
- Academic rigor (trilingual thesis)

**Key Talking Points**:
- Mathematical optimization in production environment
- Real-world problem solving (hotel shift scheduling)
- Scalable architecture design (1000+ users)
- Bilingual development capability
- Research methodology application

---

## Visa Sponsorship Information

### Work Visa Types in Japan

**Highly Skilled Professional Visa (HSP)**:
- Points-based system
- Faster processing
- Path to permanent residence
- Recommended for engineers with portfolio

**Engineer/Specialist in Humanities/International Services**:
- Standard work visa
- Requires bachelor's degree
- Sponsorship from employer

### Portfolio Advantages for Visa

This portfolio demonstrates:
- Advanced technical skills (70 points potential)
- Academic achievement (thesis, research)
- Professional experience (production system)
- Language capability (Japanese localization)
- Innovation (OR-Tools implementation)

**Estimated HSP Points**: 70-80 points (threshold: 70)

---

## Expected Timeline

### Job Search Process in Japan

1. **Application**: 1-2 weeks
   - Submit resume + cover letter + portfolio link
   - Initial screening

2. **Interviews**: 2-4 weeks
   - 2-3 rounds (HR, technical, culture fit)
   - May include coding test or system design

3. **Offer**: 1-2 weeks
   - Negotiation period
   - Contract review

4. **Visa Processing**: 1-3 months
   - Certificate of Eligibility (COE)
   - Visa application at embassy
   - Entry to Japan

**Total Timeline**: 3-6 months from application to start date

---

## Resources

### Job Search Platforms
- **Indeed Japan**: https://jp.indeed.com/
- **Wantedly**: https://www.wantedly.com/
- **Green**: https://www.green-japan.com/
- **LinkedIn Japan**: https://www.linkedin.com/jobs/

### Visa Information
- **Japan Immigration**: https://www.moj.go.jp/isa/
- **HSP Points Calculator**: Available on immigration website

### Salary Research
- **Salary.jp**: https://salary.jp/
- **OpenWork**: https://www.vorkers.com/
- **Levels.fyi**: Tech company compensation data

---

## Notes

- Update search keywords based on results and trends
- Adjust salary expectations based on company size and funding
- Consider total compensation: base + bonus + stock + benefits
- Research company culture and work-life balance
- Verify visa sponsorship during application process
- Prepare for technical interviews (coding + system design)
- Be ready to discuss portfolio in detail (architecture decisions, trade-offs, results)

---

**Last Updated**: January 2026
**Portfolio**: https://github.com/theshidiq/SSM-or-tools
