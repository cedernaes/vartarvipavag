import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface SecurityConfig {
  password?: string;
  adminPassword?: string;
  allowedIPs?: string[];
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class SecurityMiddleware {
  private readonly apiKey: string | undefined;
  private readonly adminApiKey: string | undefined;
  private readonly allowedIPs: string[];

  constructor(config: SecurityConfig = {}) {
    this.apiKey = config.password ? hashPassword(config.password) : undefined;
    this.adminApiKey = config.adminPassword ? hashPassword(config.adminPassword) : undefined;
    this.allowedIPs = config.allowedIPs || ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost'];
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

  public validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    if (this.apiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.apiKey || providedKey !== this.adminApiKey) {
        console.warn(`Unauthorized request from IP: ${this.getClientIP(req)}`);
        res.status(401).json({
          success: false,
          error: 'Invalid or missing API key'
        });
        return;
      }
    }

    next();
  };

  public validateAdminApiKey = (req: Request, res: Response, next: NextFunction): void => {
    if (this.adminApiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.adminApiKey) {
        res.status(401).json({
          success: false,
          error: 'Invalid or missing admin API key'
        });
        return;
      }
    } else {
      res.status(401).json({
        success: false,
        error: 'Admin access not configured'
      });
      return;
    }

    next();
  };

  public requireAdminAndLocalNetwork = (req: Request, res: Response, next: NextFunction): void => {
    const hasProxyHeaders = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];

    if (hasProxyHeaders) {
      res.status(403).json({
        success: false,
        error: 'Admin operations are restricted to internal network only'
      });
      return;
    }

    if (this.adminApiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.adminApiKey) {
        res.status(401).json({
          success: false,
          error: 'Invalid or missing admin API key'
        });
        return;
      }
    } else {
      res.status(401).json({
        success: false,
        error: 'Admin access not configured'
      });
      return;
    }

    next();
  };

  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      'unknown'
    );
  }
}

export const securityMiddleware = new SecurityMiddleware({
  password: process.env.CLIENT_PASSWORD,
  adminPassword: process.env.ADMIN_PASSWORD,
  allowedIPs: process.env.ALLOWED_IPS?.split(','),
});