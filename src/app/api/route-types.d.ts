import { NextRequest, NextResponse } from 'next/server';

declare module 'next/server' {
  export interface NextRouteParams {
    params: Record<string, string | string[]>;
  }
  
  export interface NextRouteContext {
    params: Record<string, string | string[]>;
  }
}

export type RouteHandlerFunction = (
  req: NextRequest,
  context: NextRouteContext
) => Response | Promise<Response>; 