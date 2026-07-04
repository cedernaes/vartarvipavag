import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface SecurityConfig {
  password?: string;
  adminPassword?: string;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class SecurityMiddleware {
  private readonly apiKey: string | undefined;
  private readonly adminApiKey: string | undefined;

  constructor(config: SecurityConfig = {}) {
    this.apiKey = config.password ? hashPassword(config.password) : undefined;
    this.adminApiKey = config.adminPassword ? hashPassword(config.adminPassword) : undefined;
  }

  public onlyInternalNetwork = (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = this.getClientIP(req);

    console.log(`Write request from IP: ${clientIP}`);

    // Check if the request has proxy headers (indicating it came from outside)
    const hasProxyHeaders = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    if (hasProxyHeaders) {
      res.status(403).json({
        success: false,
        error: 'Write operations are restricted to internal network only'
      });
      return;
    }

    next();
  };

  public getApiKey(): string | undefined {
    return this.apiKey;
  }

  public printConfigurationStatus(): void {
    const is_or_isnt = (key: string | undefined) => (key ? 'is' : 'is not');
    console.log(`🔑 Client API key ${is_or_isnt(this.apiKey)} configured (controlled by the env "CLIENT_PASSWORD")`);
    console.log(`🔑 Admin API key ${is_or_isnt(this.adminApiKey)} configured (controlled by the env "ADMIN_PASSWORD")`);
  }

  public validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.apiKey) {
      next();
      return;
    }

    const providedKey = req.headers['x-api-key'];
    if (!providedKey || (providedKey !== this.apiKey && providedKey !== this.adminApiKey)) {
      console.warn(`Unauthorized request from IP: ${this.getClientIP(req)}`);
      res.status(401).json({
        success: false,
        error: 'Invalid or missing API key'
      });
      return;
    }

    next();
  };

  public validateAdminApiKey = (req: Request, res: Response, next: NextFunction): void => {
    if (!this.adminApiKey) {
      res.status(401).json({
        success: false,
        error: 'Admin access not configured'
      });
      return;
    }

    const providedKey = req.headers['x-api-key'];
    if (!providedKey || providedKey !== this.adminApiKey) {
      res.status(401).json({
        success: false,
        error: 'Invalid or missing admin API key'
      });
      return;
    }

    next();
  };

  public requireAdminAndLocalNetwork = (req: Request, res: Response, next: NextFunction): void => {
    const wentThroughProxy = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];

    if (wentThroughProxy) {
      res.status(403).json({
        success: false,
        error: 'Admin operations are restricted to internal network only'
      });
      return;
    }

    this.validateAdminApiKey(req, res, next);
  };

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}

export const securityMiddleware = new SecurityMiddleware({
  password: process.env.CLIENT_PASSWORD,
  adminPassword: process.env.ADMIN_PASSWORD,
});