import { getRedisClient, isRedisReady } from "./redis-client.js";
import { createHash } from "crypto";

export interface SemanticCacheOptions {
  similarityThreshold?: number;
  ttlSeconds?: number;
  keyPrefix?: string;
  maxCacheSize?: number;
}

const DEFAULT_SIMILARITY_THRESHOLD = 0.85;
const DEFAULT_TTL = 300;
const DEFAULT_KEY_PREFIX = "semantic";
const DEFAULT_MAX_CACHE_SIZE = 10000;

interface CacheEntry {
  response: unknown;
  createdAt: number;
  expiresAt: number;
  embedding: number[];
  requestHash: string;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function simpleEmbedding(text: string): number[] {
  const words = normalizeText(text).split(" ");
  const embedding: number[] = [];
  
  for (let i = 0; i < 128; i++) {
    const wordIndex = i % words.length;
    const word = words[wordIndex] ?? "";
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash = hash & hash;
    }
    embedding.push((hash % 1000) / 1000);
  }
  
  return embedding;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

function hashPrompt(messages: unknown[]): string {
  const content = messages.map(m => {
    if (typeof m === "object" && m !== null && "content" in m) {
      return String((m as { content: unknown }).content);
    }
    return "";
  }).join("|");
  
  return createHash("sha256").update(content).digest("hex").slice(0, 32);
}

export class SemanticCache {
  private similarityThreshold: number;
  private ttlSeconds: number;
  private keyPrefix: string;
  private maxCacheSize: number;

  constructor(options: SemanticCacheOptions = {}) {
    this.similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
    this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL;
    this.keyPrefix = options.keyPrefix ?? DEFAULT_KEY_PREFIX;
    this.maxCacheSize = options.maxCacheSize ?? DEFAULT_MAX_CACHE_SIZE;
  }

  private async getRedis() {
    const redis = await getRedisClient();
    if (redis && isRedisReady()) return redis;
    return null;
  }

  private buildCacheKey(requestHash: string): string {
    return `${this.keyPrefix}:cache:${requestHash}`;
  }

  private buildIndexKey(indexType: "hash" | "set"): string {
    return `${this.keyPrefix}:index:${indexType}`;
  }

  async get(messages: unknown[], _model?: string): Promise<{ hit: boolean; response: unknown; similarity?: number } | null> {
    const redis = await this.getRedis();
    if (!redis) return null;

    try {
      const requestHash = hashPrompt(messages);
      const cacheKey = this.buildCacheKey(requestHash);
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        const entry: CacheEntry = JSON.parse(cached);
        const now = Date.now();
        
        if (entry.expiresAt < now) {
          await redis.del(cacheKey);
          return null;
        }
        
        return { hit: true, response: entry.response };
      }

      const messagesText = messages.map(m => {
        if (typeof m === "object" && m !== null && "content" in m) {
          return String((m as { content: unknown }).content);
        }
        return "";
      }).join(" ");

      const currentEmbedding = simpleEmbedding(messagesText);
      
      const indexKey = this.buildIndexKey("set");
      const candidates = await redis.sMembers(indexKey);
      
      let bestMatch: { key: string; similarity: number } | null = null;
      
      for (const candidateHash of candidates) {
        const candidateKey = this.buildCacheKey(candidateHash);
        const candidateCached = await redis.get(candidateKey);
        
        if (!candidateCached) {
          await redis.sRem(indexKey, candidateHash);
          continue;
        }
        
        const candidateEntry: CacheEntry = JSON.parse(candidateCached);
        const similarity = cosineSimilarity(currentEmbedding, candidateEntry.embedding);
        
        if (similarity >= this.similarityThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { key: candidateKey, similarity };
          }
        }
      }
      
      if (bestMatch && bestMatch.similarity > this.similarityThreshold) {
        const cached = await redis.get(bestMatch.key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          const now = Date.now();
          
          if (entry.expiresAt >= now) {
            return { hit: true, response: entry.response, similarity: bestMatch.similarity };
          }
        }
      }
      
      return null;
    } catch (err) {
      console.error("[semantic-cache] Get error:", err);
      return null;
    }
  }

  async set(
    messages: unknown[],
    response: unknown,
    _model?: string
  ): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) return;

    try {
      const requestHash = hashPrompt(messages);
      const cacheKey = this.buildCacheKey(requestHash);
      
      const messagesText = messages.map(m => {
        if (typeof m === "object" && m !== null && "content" in m) {
          return String((m as { content: unknown }).content);
        }
        return "";
      }).join(" ");

      const embedding = simpleEmbedding(messagesText);
      const now = Date.now();
      
      const entry: CacheEntry = {
        response,
        createdAt: now,
        expiresAt: now + this.ttlSeconds * 1000,
        embedding,
        requestHash,
      };
      
      await redis.setEx(cacheKey, this.ttlSeconds, JSON.stringify(entry));
      
      const indexKey = this.buildIndexKey("set");
      const size = await redis.sCard(indexKey);
      
      if (size >= this.maxCacheSize) {
        const oldestKey = await redis.sRandMember(indexKey);
        if (oldestKey) {
          await redis.del(this.buildCacheKey(oldestKey));
          await redis.sRem(indexKey, oldestKey);
        }
      }
      
      await redis.sAdd(indexKey, requestHash);
      await redis.expire(indexKey, this.ttlSeconds * 2);
    } catch (err) {
      console.error("[semantic-cache] Set error:", err);
    }
  }

  async invalidate(pattern: string): Promise<number> {
    const redis = await this.getRedis();
    if (!redis) return 0;

    try {
      const keys = await redis.keys(`${this.keyPrefix}:cache:${pattern}*`);
      if (keys.length === 0) return 0;
      return await redis.del(keys);
    } catch (err) {
      console.error("[semantic-cache] Invalidate error:", err);
      return 0;
    }
  }

  async clear(): Promise<void> {
    const redis = await this.getRedis();
    if (!redis) return;

    try {
      const indexKey = this.buildIndexKey("set");
      const members = await redis.sMembers(indexKey);
      
      for (const hash of members) {
        await redis.del(this.buildCacheKey(hash));
      }
      await redis.del(indexKey);
    } catch (err) {
      console.error("[semantic-cache] Clear error:", err);
    }
  }
}

export const defaultSemanticCache = new SemanticCache();

export function createSemanticCache(options: SemanticCacheOptions): SemanticCache {
  return new SemanticCache(options);
}

export async function getSemanticCacheStats(): Promise<{
  size: number;
  hitRate: number;
  entries: number;
} | null> {
  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return null;

  try {
    const indexKey = `${DEFAULT_KEY_PREFIX}:index:set`;
    const entries = await redis.sCard(indexKey);
    
    return {
      size: entries,
      hitRate: 0,
      entries,
    };
  } catch {
    return null;
  }
}