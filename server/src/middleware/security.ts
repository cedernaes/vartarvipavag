import { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { DatabaseManager } from '../models/database';

const SESSION_INACTIVITY_DAYS = 30;

export interface SecurityConfig {
  password?: string;
  adminPassword?: string;
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function lookupSession(token: string, requireAdmin: boolean): Promise<boolean> {
  const db = DatabaseManager.getInstance();
  const typeFilter = requireAdmin ? "AND type = 'admin'" : '';
  const session = await db.get(
    `SELECT token, last_accessed_at FROM sessions WHERE token = ? ${typeFilter}`,
    [token]
  );

  if (!session) return false;

  const msSinceAccess = Date.now() - new Date(session.last_accessed_at).getTime();
  if (msSinceAccess > SESSION_INACTIVITY_DAYS * 24 * 60 * 60 * 1000) {
    await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    return false;
  }

  await db.run(
    'UPDATE sessions SET last_accessed_at = ? WHERE token = ?',
    [new Date().toISOString(), token]
  );
  return true;
}

export class SecurityMiddleware {
  private readonly userPasswordConfigured: boolean;
  private readonly adminPasswordConfigured: boolean;

  constructor(config: SecurityConfig = {}) {
    this.userPasswordConfigured = !!config.password;
    this.adminPasswordConfigured = !!config.adminPassword;
    // Keep hashed values only for the legacy /api/login endpoint and status reporting
    this._apiKey = config.password ? hashPassword(config.password) : undefined;
  }

  private readonly _apiKey: string | undefined;

  public getApiKey(): string | undefined {
    return this._apiKey;
  }

  public printConfigurationStatus(): void {
    const is_or_isnt = (configured: boolean) => (configured ? 'is' : 'is not');
    console.log(`🔑 Client API key ${is_or_isnt(this.userPasswordConfigured)} configured (controlled by the env "CLIENT_PASSWORD")`);
    console.log(`🔑 Admin API key ${is_or_isnt(this.adminPasswordConfigured)} configured (controlled by the env "ADMIN_PASSWORD")`);
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

  public validateApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.userPasswordConfigured) {
      next();
      return;
    }

    try {
      const token = req.headers['x-api-key'] as string | undefined;
      if (!token) {
        console.warn(`Unauthorized request from IP: ${this.getClientIP(req)}`);
        res.status(401).json({ success: false, error: 'Invalid or missing API key' });
        return;
      }

      const valid = await lookupSession(token, false);
      if (!valid) {
        console.warn(`Invalid or expired session from IP: ${this.getClientIP(req)}`);
        res.status(401).json({ success: false, error: 'Invalid or missing API key' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  public validateAdminApiKey = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.adminPasswordConfigured) {
      res.status(401).json({ success: false, error: 'Admin access not configured' });
      return;
    }

    try {
      const token = req.headers['x-api-key'] as string | undefined;
      if (!token) {
        res.status(401).json({ success: false, error: 'Invalid or missing admin API key' });
        return;
      }

      const valid = await lookupSession(token, true);
      if (!valid) {
        res.status(401).json({ success: false, error: 'Invalid or missing admin API key' });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  public requireAdminAndLocalNetwork = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
