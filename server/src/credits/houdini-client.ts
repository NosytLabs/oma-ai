import { config } from "../config.js";
import { WebSocket as Ws } from "ws";

const BASE_URL = config.HOUDINI_API_URL;
const POLL_INTERVAL_MS = 30_000;

export enum OrderStatus {
  NEW = "NEW",
  WAITING = "WAITING",
  CONFIRMING = "CONFIRMING",
  EXCHANGING = "EXCHANGING",
  ANONYMIZING = "ANONYMIZING",
  FINISHED = "FINISHED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  EXPIRED = "EXPIRED",
}

export enum SwapType {
  PRIVATE = "private",
  STANDARD = "standard",
  DEX = "dex",
}

const TERMINAL_STATUSES: OrderStatus[] = [
  OrderStatus.FINISHED,
  OrderStatus.FAILED,
  OrderStatus.REFUNDED,
  OrderStatus.EXPIRED,
];

export interface ComplianceContext {
  ip: string;
  userAgent: string;
  timezone: string;
}

export interface Token {
  id: string;
  name: string;
  symbol: string;
  blockchain: string;
  decimals: number;
  address?: string;
  image?: string;
}

export interface Chain {
  id: string;
  name: string;
  blockchain: string;
}

export interface Quote {
  id: string;
  fromToken: string;
  toToken: string;
  amount: string;
  estimatedAmount: string;
  swapType: SwapType;
  rate: string;
  fee: string;
  minAmount?: string;
  maxAmount?: string;
}

export interface Order {
  id: string;
  status: OrderStatus;
  fromToken: string;
  toToken: string;
  fromAmount: string;
  toAmount: string;
  depositAddress: string;
  refundAddress?: string;
  swapType: SwapType;
  createdAt: string;
  updatedAt: string;
  transactionHash?: string;
}

export class HoudiniClient {
  private apiKey: string;
  private apiSecret: string;
  private partnerId: string;
  private addressTo: string;
  private wsUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private ws: Ws | null = null;
  private wsSubscriptions = new Map<string, Set<(order: Order) => void>>();

  constructor(apiKey: string, apiSecret: string, partnerId: string, addressTo: string, wsUrl: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.partnerId = partnerId;
    this.addressTo = addressTo;
    this.wsUrl = wsUrl;
  }

  private ensureConfigured(): void {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error(
        "HoudiniSwap API key and secret are not configured. Set HOUDINI_API_KEY and HOUDINI_API_SECRET environment variables."
      );
    }
  }

  async authenticate(): Promise<void> {
    this.ensureConfigured();
    const res = await fetch(`${BASE_URL}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        partnerId: this.partnerId,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HoudiniSwap auth failed (${res.status}): ${text}`);
    }
    const data = (await res.json()) as { accessToken: string; expiresIn: number };
    this.accessToken = data.accessToken;
    this.tokenExpiresAt = Date.now() + (data.expiresIn ?? 86400) * 1000 - 60_000;
  }

  private async ensureAuth(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.authenticate();
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    complianceCtx?: ComplianceContext
  ): Promise<T> {
    await this.ensureAuth();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };
    if (complianceCtx) {
      headers["x-user-ip"] = complianceCtx.ip;
      headers["x-user-agent"] = complianceCtx.userAgent;
      headers["x-user-timezone"] = complianceCtx.timezone;
    }
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HoudiniSwap ${method} ${path} failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<T>;
  }

  async getTokens(blockchain?: string): Promise<Token[]> {
    this.ensureConfigured();
    const path = blockchain
      ? `/tokens?blockchain=${encodeURIComponent(blockchain)}`
      : "/tokens";
    const data = await this.request<{ tokens: Token[] }>("GET", path);
    return data.tokens;
  }

  async getChains(): Promise<Chain[]> {
    this.ensureConfigured();
    const data = await this.request<{ chains: Chain[] }>("GET", "/chains");
    return data.chains;
  }

  async getQuotes(
    fromToken: string,
    toToken: string,
    amount: string,
    swapType?: SwapType
  ): Promise<Quote[]> {
    this.ensureConfigured();
    const body: Record<string, unknown> = { fromToken, toToken, amount };
    if (swapType) body.swapType = swapType;
    const data = await this.request<{ quotes: Quote[] }>("POST", "/quotes", body);
    return data.quotes;
  }

  async createExchange(
    quoteId: string,
    addressTo?: string,
    refundAddress?: string
  ): Promise<Order> {
    this.ensureConfigured();
    const body: Record<string, unknown> = {
      quoteId,
      addressTo: addressTo ?? this.addressTo,
    };
    if (refundAddress) body.refundAddress = refundAddress;
    return this.request<Order>("POST", "/exchange", body);
  }

  async getOrder(orderId: string): Promise<Order> {
    this.ensureConfigured();
    return this.request<Order>("GET", `/orders/${encodeURIComponent(orderId)}`);
  }

  async waitForCompletion(
    orderId: string,
    timeoutMs = 1_800_000
  ): Promise<Order> {
    this.ensureConfigured();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const order = await this.getOrder(orderId);
      if (TERMINAL_STATUSES.includes(order.status)) return order;
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error(
      `HoudiniSwap order ${orderId} did not reach terminal status within ${timeoutMs}ms`
    );
  }

  async getDepositStatus(orderId: string): Promise<Order> {
    return this.getOrder(orderId);
  }

  async subscribeToOrder(orderId: string, callback: (order: Order) => void): Promise<() => void> {
    this.ensureConfigured();
    if (!this.wsSubscriptions.has(orderId)) {
      this.wsSubscriptions.set(orderId, new Set());
    }
    this.wsSubscriptions.get(orderId)!.add(callback);

    await this.ensureWsConnected();

    this.ws!.send(JSON.stringify({ action: "subscribe", orderId }));

    let unsubscribed = false;
    return () => {
      if (unsubscribed) return;
      unsubscribed = true;
      const subs = this.wsSubscriptions.get(orderId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.wsSubscriptions.delete(orderId);
          if (this.ws && this.ws.readyState === Ws.OPEN) {
            this.ws.send(JSON.stringify({ action: "unsubscribe", orderId }));
          }
        }
      }
    };
  }

  private async ensureWsConnected(): Promise<void> {
    if (this.ws && this.ws.readyState === Ws.OPEN) return;
    if (this.ws && this.ws.readyState === Ws.CONNECTING) {
      await new Promise<void>((resolve, reject) => {
        const onOpen = () => { this.ws!.removeEventListener("open", onOpen); resolve(); };
        const onError = () => { this.ws!.removeEventListener("error", onError); reject(new Error("WebSocket connection failed")); };
        this.ws!.addEventListener("open", onOpen);
        this.ws!.addEventListener("error", onError);
      });
      return;
    }

    await this.ensureAuth();
    const url = new URL(this.wsUrl);
    url.searchParams.set("token", this.accessToken!);

    this.ws = new Ws(url.toString());
    const ws = this.ws;
    if (!ws) return;
    ws.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; orderId?: string; order?: Order };
        if (msg.type === "order_update" && msg.orderId && msg.order) {
          const subs = this.wsSubscriptions.get(msg.orderId);
          if (subs) {
            for (const cb of subs) cb(msg.order);
          }
        }
      } catch (err) {
      console.warn("[houdini] Malformed WebSocket message:", err);
    }
    });
    ws.addEventListener("close", () => { this.ws = null; });
    ws.addEventListener("error", () => { this.ws = null; });

    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("WebSocket connection failed")), { once: true });
    });
  }

  async getSupportedChains(): Promise<Chain[]> {
    return this.getChains();
  }

  async getTokensForChain(blockchain: string): Promise<Token[]> {
    return this.getTokens(blockchain);
  }
}

export const houdiniClient = new HoudiniClient(
  config.HOUDINI_API_KEY ?? "",
  config.HOUDINI_API_SECRET ?? "",
  config.HOUDINI_PARTNER_ID ?? "",
  config.HOUDINI_ADDRESS_TO ?? "",
  config.HOUDINI_WS_URL
);
