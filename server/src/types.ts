export type AuthMethod = "siwe" | "solana" | "account-number" | "sso";

export type OmaEnv = {
  Variables: {
    userId: string;
    authMethod?: AuthMethod;
    rateLimit?: { remaining: number; reset: number };
    apiKey: {
      id: string;
      userId: string;
      keyPrefix: string;
      keyHash: string;
      name: string;
      active: boolean;
      createdAt: Date;
    } | null;
    correlationId?: string;
    payment?: { txHash?: string; amount: string; networkId: string };
    teamRole?: string;
  };
};
