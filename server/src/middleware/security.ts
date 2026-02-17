import crypto from 'crypto';
import { NextFunction, Request, Response } from 'express';

export interface SecurityConfig {
  password?: string;
  apiKey?: string;
  adminPassword?: string;
  adminApiKey?: string;
  allowedIPs?: string[];
}

// Hash password using Node.js crypto (equivalent to client-side Web Crypto API)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export class SecurityMiddleware {
  private config: SecurityConfig;

  constructor(config: SecurityConfig = {}) {
    this.config = {
      password: config.password,
      apiKey: config.apiKey || process.env.API_KEY || (config.password && hashPassword(config.password)),
      adminPassword: config.adminPassword,
      adminApiKey: config.adminApiKey || process.env.ADMIN_API_KEY || (config.adminPassword && hashPassword(config.adminPassword)),
      allowedIPs: config.allowedIPs || ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost']
    };
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
    return this.config.apiKey;
  }

  public validateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    // Check API key if enabled
    if (this.config.apiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.config.apiKey) {
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
    // Check admin API key if enabled
    if (this.config.adminApiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.config.adminApiKey) {
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

  // Middleware that requires both local network AND admin API key
  public requireAdminAndLocalNetwork = (req: Request, res: Response, next: NextFunction): void => {
    // First check local network
    const clientIP = this.getClientIP(req);
    const hasProxyHeaders = req.headers['x-forwarded-for'] || req.headers['x-real-ip'];
    
    if (hasProxyHeaders) {
      res.status(403).json({
        success: false,
        error: 'Admin operations are restricted to internal network only'
      });
      return;
    }

    // Then check admin API key
    if (this.config.adminApiKey) {
      const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!providedKey || providedKey !== this.config.adminApiKey) {
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

// Default instance
export const securityMiddleware = new SecurityMiddleware({
  password: process.env.CLIENT_PASSWORD,
  apiKey: process.env.API_KEY,
  adminPassword: process.env.ADMIN_PASSWORD,
  adminApiKey: process.env.ADMIN_API_KEY,
  allowedIPs: process.env.ALLOWED_IPS?.split(',') || undefined,
});