// Lua script for atomic token bucket operations
// Returns: [allowed (0/1), remaining_tokens, ms_until_full]
export const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local bucket_size = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2]) -- tokens per second
local requested = tonumber(ARGV[3])

local time_result = redis.call('TIME')
local now = math.floor(tonumber(time_result[1]) * 1000 + tonumber(time_result[2]) / 1000)

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
		tokens = bucket_size
		last_refill = now
end

local elapsed = (now - last_refill) / 1000
local new_tokens = elapsed * refill_rate
tokens = math.floor(math.min(bucket_size, tokens + new_tokens))

last_refill = now

if tokens >= requested then
		tokens = tokens - requested
		redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
		redis.call('EXPIRE', key, 3600)
		return {1, tokens, 0}
else
		local tokens_needed = requested - tokens
		local ms_until_full = math.ceil((tokens_needed / refill_rate) * 1000)
		redis.call('HMSET', key, 'tokens', tokens, 'last_refill', last_refill)
		redis.call('EXPIRE', key, 3600)
		return {0, tokens, ms_until_full}
end
`;

// Lua script for the fixed-window request counter used by `rateLimit()`.
//
// WHY THIS IS ONE SCRIPT (P0)
// The previous implementation ran three separate round-trips:
//
//     const current = await redis.incr(key);
//     if (current === 1) await redis.expire(key, windowSec);
//     const ttl = await redis.ttl(key);
//
// INCR and EXPIRE are not atomic. If the process died, the connection
// dropped, or the Redis node failed over BETWEEN the two calls, INCR had
// already created the key but EXPIRE never ran. Such a key has NO TTL and
// persists forever, so `current` keeps climbing past maxRequests and the
// caller is 429'd permanently — for the lifetime of the key. Nothing evicts
// it, and no log line says why. Doing INCR + PEXPIRE inside a single script
// makes the window's expiry part of the same atomic operation: a key either
// exists with a TTL, or it does not exist at all.
//
// PEXPIRE (ms) is used rather than EXPIRE (s) so sub-second windows are not
// rounded up to a full second.
//
// Returns: [allowed (0/1), current_count, ttl_ms]
export const FIXED_WINDOW_SCRIPT = `
local key = KEYS[1]
local window_ms = tonumber(ARGV[1])
local max_requests = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
	-- First hit in this window: set the TTL atomically with the INCR so the
	-- key can never be orphaned without an expiry.
	redis.call('PEXPIRE', key, window_ms)
end

local ttl = redis.call('PTTL', key)
if ttl < 0 then
	-- Defence in depth. A key that somehow lost its TTL (restored from a
	-- backup, or an orphan left by the pre-fix INCR/EXPIRE code) is re-armed
	-- rather than 429'ing that client forever.
	redis.call('PEXPIRE', key, window_ms)
	ttl = window_ms
end

if current > max_requests then
	return {0, current, ttl}
end
return {1, current, ttl}
`;

// Lua script for weighted token-per-minute (TPM) enforcement.
//
// The token bucket counts REQUESTS, which is the wrong unit for inference:
// one 10k-token prompt costs ~10,000x a 1-token ping. MODEL_LIMITS declares
// a `tpm` for every model and nothing consumed it, so a single caller could
// burn an entire minute's token budget in one request.
//
// Each request is one member of a sorted set scored by arrival time; its
// weight (prompt tokens + max_tokens) lives in a parallel hash. Members
// older than the window are evicted from BOTH structures together, so the
// hash cannot accumulate orphaned weights that no eviction pass would clear.
//
// Returns: [allowed (0/1), tokens_used_in_window, reset_ms]
export const TPM_LIMIT_SCRIPT = `
local zset_key = KEYS[1]
local hash_key = KEYS[2]
local window_ms = tonumber(ARGV[1])
local max_tokens = tonumber(ARGV[2])
local requested = tonumber(ARGV[3])
local member = ARGV[4]

local time_result = redis.call('TIME')
local now = math.floor(tonumber(time_result[1]) * 1000 + tonumber(time_result[2]) / 1000)
local cutoff = now - window_ms

-- Evict expired entries from BOTH structures. HDEL is driven by the exact
-- member list ZRANGEBYSCORE returns, not by a time range, so a hash weight
-- can never outlive its sorted-set entry.
local expired = redis.call('ZRANGEBYSCORE', zset_key, '-inf', cutoff)
if #expired > 0 then
	redis.call('ZREM', zset_key, unpack(expired))
	for i = 1, #expired do
		redis.call('HDEL', hash_key, expired[i])
	end
end

-- Sum the weights currently inside the window.
local members = redis.call('ZRANGE', zset_key, 0, -1)
local used = 0
for i = 1, #members do
	used = used + tonumber(redis.call('HGET', hash_key, members[i]) or '0')
end

if used + requested <= max_tokens then
	redis.call('ZADD', zset_key, now, member)
	redis.call('HSET', hash_key, member, requested)
	used = used + requested
	-- TTL on BOTH keys: the hash must not outlive the sorted set, or the
	-- next window's HGET-by-member could read a stale weight.
	local ttl_sec = math.ceil(window_ms / 1000) + 1
	redis.call('EXPIRE', zset_key, ttl_sec)
	redis.call('EXPIRE', hash_key, ttl_sec)
	return {1, used, 0}
end

-- Denied. Report how long until the oldest entry leaves the window so the
-- caller can send an honest Retry-After instead of a fixed guess.
local oldest = redis.call('ZRANGE', zset_key, 0, 0, 'WITHSCORES')
local reset_ms = 0
if #oldest > 0 then
	reset_ms = math.ceil(tonumber(oldest[2]) + window_ms - now)
	if reset_ms < 0 then reset_ms = 0 end
end
return {0, used, reset_ms}
`;

// Lua script for atomic daily spend-limit check-and-increment.
// Prevents the TOCTOU race where two concurrent trackSpend calls both
// read `spent < limit` and collectively overspend. The script:
//   1. reads the current counter,
//   2. refuses the increment if `current + cost > limit` (returns -1),
//   3. otherwise INCRBYFLOATs atomically and sets the TTL on key creation.
// Returns: new counter value (>= cost on success), or -1 if the increment
// would exceed the daily limit.


// Lua script for checking RPM limits (sliding window counter)
// Returns: [allowed (0/1), current_count, ms_until_reset]
export const RPM_LIMIT_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local window = tonumber(ARGV[2]) -- window in milliseconds
local requested = tonumber(ARGV[3])

local time_result = redis.call('TIME')
local now = math.floor(tonumber(time_result[1]) * 1000 + tonumber(time_result[2]) / 1000)

redis.call('ZREMRANGEBYSCORE', key, 0, math.floor(now - window))

local count = redis.call('ZCARD', key)

if count + requested <= limit then
		for i = 1, requested do
				redis.call('ZADD', key, now, math.floor(now + i))
		end
		redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)
		return {1, count + requested, 0}
else
		local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
		local reset_time = 0
		if #oldest > 0 then
				reset_time = math.ceil(oldest[2] + window - now)
		end
		return {0, count, reset_time}
end
`;
