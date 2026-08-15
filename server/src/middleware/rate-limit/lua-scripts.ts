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
