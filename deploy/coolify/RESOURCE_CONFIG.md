# OMA-AI Resource Configuration for Frankie (Coolify Server)

## Server Hardware Profile

| Component | Specification |
|-----------|---------------|
| CPU | AMD Ryzen 5 1400 (4 cores / 8 threads) |
| RAM | 16GB DDR4 |
| Storage | 931GB |

## Resource Allocation Summary

| Service | CPU Limit | Memory Limit | Memory Reservation |
|---------|-----------|--------------|-------------------|
| PostgreSQL | 1.5 cores | 1GB | 512MB |
| Redis | 0.5 cores | 512MB | 256MB |
| API (Node.js) | 2 cores | 2GB | 1GB |
| Frontend (Next.js) | 1 core | 1GB | 512MB |
| **Total** | **5 cores** | **4.5GB** | **2.5GB** |

This leaves ~11.5GB RAM for the host OS, Docker overhead, and Coolify system services.

---

## PostgreSQL Optimizations

### Resource Limits
- **Memory Limit**: 1GB (allows for connections, queries, and internal operations)
- **Memory Reservation**: 512MB (guaranteed minimum)
- **CPU Limit**: 1.5 cores

### PostgreSQL Tuning Parameters

```yaml
shared_buffers=256MB
```
- Sets the amount of memory for shared buffer cache
- Set to ~25% of container memory limit for optimal performance
- Alpine Linux + Docker: use lower value than bare metal

```yaml
work_mem=16MB
```
- Memory for sort operations and hash tables per connection
- Lowered from default (4MB) to support moderate workloads
- With max_connections=50, max potential = 800MB, but actual usage is much lower

```yaml
maintenance_work_mem=64MB
```
- Memory for VACUUM, CREATE INDEX, ALTER TABLE operations
- Typically 10-25% of work_mem; set conservatively for 1GB container

```yaml
effective_cache_size=384MB
```
- Hint to query planner about available OS cache
- Set to ~75% of container memory limit

```yaml
max_connections=50
```
- Reduced from default (100) to limit memory footprint
- OMA-AI typically has fewer concurrent connections

```yaml
log_min_duration_statement=1000
```
- Log queries taking longer than 1 second (1000ms)
- Aids in identifying slow queries for optimization

### Write Performance Optimizations (Data Safety Trade-off)

```yaml
synchronous_commit=off
```
- Transactions commit without waiting for WAL write to disk
- **WARNING**: May lose up to 1 transaction if system crashes
- Provides 2-3x write performance improvement
- Acceptable for non-critical data or if application has its own recovery

```yaml
fsync=off
```
- Disables forced disk writes after each commit
- **WARNING**: Risk of data corruption on crash
- Use only if synchronous_commit=off and data is not critical

```yaml
full_page_writes=off
```
- Reduces overhead of writing full pages after checkpoint
- Pairs with fsync=off for maximum write performance

---

## Redis Optimizations

### Resource Limits
- **Memory Limit**: 512MB
- **Memory Reservation**: 256MB
- **CPU Limit**: 0.5 cores

### Redis Configuration

```yaml
--maxmemory 384mb
```
- Hard limit on Redis memory usage
- Set below container limit (512MB) to leave room for Redis internals and fragmentation
- 384MB is sufficient for OMA-AI caching needs

```yaml
--maxmemory-policy allkeys-lru
```
- When Redis hits memory limit, evict least recently used keys
- Ensures Redis never blocks due to memory exhaustion
- Appropriate for cache use case

```yaml
--maxmemory-reservation 32mb
```
- Memory reservation for Redis core operations even when at maxmemory
- Prevents complete OOM situations

```yaml
--appendfsync everysec
```
- AOF (Append-Only File) syncs to disk every second
- Good balance between persistence and performance
- Maximum 1 second data loss on crash

```yaml
--save ""
```
- Explicitly disables RDB snapshots (background saves)
- Relies on AOF for persistence only
- Reduces disk I/O and CPU overhead

### Memory Efficiency Settings

```yaml
--hash-max-ziplist-entries 512
--hash-max-ziplist-value 64
--list-max-ziplist-size 64
--set-max-intset-entries 512
```
- Use memory-efficient encoding for small data structures
- Reduces memory usage by ~50% for typical cache data

### Lazy Freeing

```yaml
--lazyfree-lazy-eviction yes
--lazyfree-lazy-expire yes
--lazyfree-lazy-delivery yes
```
- Free memory in background thread instead of blocking operations
- Improves responsiveness but uses slightly more memory

```yaml
--activerehashing yes
```
- Incremental hash table rehashing in background
- Prevents latency spikes from rehashing

---

## Node.js API Server Optimizations

### Resource Limits
- **Memory Limit**: 2GB
- **Memory Reservation**: 1GB
- **CPU Limit**: 2 cores

### Node.js Options

```yaml
NODE_OPTIONS: --max-old-space-size=1536 --gc-interval=3
```

`--max-old-space-size=1536`
- Limits V8 heap to 1.5GB (1536MB)
- Leaves ~512MB for Node.js internals, system libraries, and OS
- Prevents container OOM kills

`--gc-interval=3`
- Runs garbage collection every 3 allocations instead of every allocation
- Reduces GC CPU overhead by ~10-15%
- Minor increase in memory usage is acceptable with 1.5GB heap

### Health Check Optimization

```yaml
interval: 10s
timeout: 5s
retries: 5
start_period: 40s
```
- Faster detection of unhealthy instances (10s vs 30s interval)
- Longer start_period (40s) to account for database migrations and connections

---

## Next.js Frontend Optimizations

### Resource Limits
- **Memory Limit**: 1GB
- **Memory Reservation**: 512MB
- **CPU Limit**: 1 core

### Node.js Memory for Next.js

```yaml
NODE_OPTIONS: --max-old-space-size=768
```
- Limits Node.js heap to 768MB during runtime
- Prevents memory issues during client-side operations
- Applied both at build time (Dockerfile ARG) and runtime

### Health Check Optimization

```yaml
start_period: 90s
```
- Extended start period for Next.js cold starts and compilation
- Next.js needs time to compile pages on first request

---

## Health Check Improvements

| Service | Original Interval | New Interval | Improvement |
|---------|------------------|--------------|-------------|
| PostgreSQL | 10s | 5s | 2x faster detection |
| Redis | 10s | 5s | 2x faster detection |
| API | 30s | 10s | 3x faster detection |
| Frontend | 30s | 10s | 3x faster detection |

Health checks now use `CMD-SHELL` with proper exit codes:
- PostgreSQL: Uses `pg_isready` with proper shell execution
- Redis: Uses `redis-cli ping`
- API/Frontend: Uses `wget` with `|| exit 1` for reliable exit codes

---

## Estimated Total Resource Usage

| Metric | Value |
|--------|-------|
| Total Memory Limit | 4.5GB / 16GB (28%) |
| Total Memory Reservation | 2.5GB / 16GB (16%) |
| Total CPU Cores | 5 / 8 (63%) |

### Headroom
- **~11.5GB RAM** available for OS, Coolify, and other services
- **3 CPU threads** available for system operations
- Room to add monitoring (cAdvisor, Prometheus) or reverse proxy (Nginx)

---

## Recommendations

### Monitoring
Add cAdvisor container for real-time resource monitoring:
```yaml
cadvisor:
  image: gcr.io/cadvisor/cadvisor:latest
  deploy:
    resources:
      limits:
        memory: 256M
        cpus: '0.5'
```

### Vertical Scaling
If load increases, scale in this order:
1. PostgreSQL memory to 1.5GB (if DB is bottleneck)
2. API memory to 2.5GB (if application is bottleneck)
3. Frontend memory to 1.5GB (if frontend is bottleneck)

### Horizontal Scaling
For multiple instances:
- Use Coolify's built-in load balancing
- Ensure Redis connection pool handles concurrent connections
- Consider external PostgreSQL for high-write workloads

---

## Troubleshooting

### OOM Kills
If containers are being OOM killed:
1. Reduce `max-old-space-size` by 128MB increments
2. Check PostgreSQL `work_mem` - high values per connection can cause issues
3. Monitor actual memory usage with `docker stats`

### Slow Startup
If services take long to become healthy:
1. Increase `start_period` for that service
2. Check database migration scripts for optimization opportunities
3. Consider adding indexes before health checks begin

### High CPU Usage
If CPU is bottleneck:
1. Reduce PostgreSQL `shared_buffers` to free memory for OS cache
2. Lower `max_connections` in PostgreSQL
3. Review query performance with `log_min_duration_statement` logs