/**
 * Ambient TypeScript declarations for Supabase Edge Functions (Deno runtime).
 * Referenced exclusively by `supabase/functions/tsconfig.json` so editor TypeScript
 * checks and `tsc -p supabase/functions/tsconfig.json` pass without modifying runtime imports.
 */

declare namespace Deno {
  const env: {
    get(key: string): string | undefined;
    set(key: string, value: string): void;
    delete(key: string): void;
    toObject(): Record<string, string>;
  };

  function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): { finished: Promise<void>; shutdown: () => Promise<void> };
  function serve(
    options: {
      port?: number;
      hostname?: string;
      onListen?: (localAddr: { hostname: string; port: number; transport: string }) => void;
      onError?: (error: unknown) => Response | Promise<Response>;
    },
    handler: (req: Request) => Response | Promise<Response>,
  ): { finished: Promise<void>; shutdown: () => Promise<void> };
}

declare module 'https://esm.sh/@supabase/supabase-js*' {
  export const createClient: typeof import('@supabase/supabase-js').createClient;
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
}

declare module 'npm:@supabase/supabase-js@2' {
  export const createClient: typeof import('@supabase/supabase-js').createClient;
  export type SupabaseClient = import('@supabase/supabase-js').SupabaseClient;
}

declare module 'npm:@supabase/supabase-js@2/cors' {
  export const corsHeaders: Record<string, string>;
}

declare module 'https://deno.land/std@*/http/server.ts' {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
    options?: Record<string, unknown>,
  ): Promise<void>;
}

declare module 'https://deno.land/x/denomailer@*/mod.ts' {
  export class SMTPClient {
    constructor(config: Record<string, unknown>);
    send(config: Record<string, unknown>): Promise<void>;
    close(): Promise<void>;
  }
}
