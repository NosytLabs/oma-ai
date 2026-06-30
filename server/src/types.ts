// "sso" is reserved, not yet implemented. The sso_connections table is in
// the schema but no auth path produces an "sso" session token today.
export type AuthMethod = "siwe" | "account-number" | "sso" | "neon-auth";

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
      allowedModels?: string[] | null;
    } | null;
    correlationId?: string;
    payment?: { txHash?: string; amount: string; networkId: string };
    teamRole?: string;
    /**
     * Neon Auth user id when the request was authenticated via a Neon Auth
     * (managed Better Auth) JWT. `userId` is still set to the OMA user id
     * when a local mapping exists, or to the Neon Auth subject when no
     * local user is linked. Routes that need to distinguish the two
     * identity layers can read this.
     */
    neonAuthUserId?: string;
  };
};
