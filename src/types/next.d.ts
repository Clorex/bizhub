// src/types/next.d.ts
// This file ensures Next.js server types resolve correctly
// even when next-env.d.ts is not yet generated.

declare module 'next/server' {
  import { NextURL } from 'next/dist/server/web/next-url';

  export class NextRequest extends Request {
    readonly nextUrl: NextURL;
    readonly cookies: RequestCookies;
    readonly geo?: {
      city?: string;
      country?: string;
      region?: string;
    };
    readonly ip?: string;

    constructor(input: RequestInfo | URL, init?: RequestInit);
  }

  export class NextResponse<T = unknown> extends Response {
    readonly cookies: ResponseCookies;

    static json<JsonBody>(
      body: JsonBody,
      init?: ResponseInit
    ): NextResponse<JsonBody>;

    static redirect(url: string | NextURL | URL, status?: number): NextResponse;

    static rewrite(
      destination: string | NextURL | URL,
      init?: MiddlewareResponseInit
    ): NextResponse;

    static next(init?: MiddlewareResponseInit): NextResponse;
  }

  interface RequestCookies {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    set(name: string, value: string): this;
    delete(name: string): this;
    has(name: string): boolean;
  }

  interface ResponseCookies {
    get(name: string): { name: string; value: string } | undefined;
    getAll(): { name: string; value: string }[];
    set(
      name: string,
      value: string,
      options?: Partial<{
        domain: string;
        expires: Date;
        httpOnly: boolean;
        maxAge: number;
        path: string;
        sameSite: 'strict' | 'lax' | 'none';
        secure: boolean;
      }>
    ): this;
    delete(name: string): this;
    has(name: string): boolean;
  }

  interface MiddlewareResponseInit extends ResponseInit {
    request?: {
      headers?: HeadersInit;
    };
  }
}