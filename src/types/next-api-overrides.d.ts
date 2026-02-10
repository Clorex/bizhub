declare module 'next/server' {
  interface RequestContext {
    params: { [key: string]: string };
  }
}
