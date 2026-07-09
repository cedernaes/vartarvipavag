import { Request, Response, Router } from 'express';
import { ApiResponse } from '../types';
import crypto from 'crypto';
import speakeasy from 'speakeasy';
import { DatabaseManager } from '../models/database';

const router = Router();

// Hash password using Node.js crypto (equivalent to client-side Web Crypto API)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function getClientIP(req: Request): string {
  return (
    req.headers['x-forwarded-for'] as string ||
    req.socket.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

interface LoginRequest {
  password: string;
  isAdmin?: boolean;
  totpCode?: string;
}

interface LoginResponse {
  apiKey: string;
}

async function createSession(type: 'user' | 'admin', req: Request): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] ?? null;
  const now = new Date().toISOString();
  const db = DatabaseManager.getInstance();
  await db.run(
    'INSERT INTO sessions (token, type, user_agent, ip, created_at, last_accessed_at) VALUES (?, ?, ?, ?, ?, ?)',
    [token, type, userAgent, ip, now, now]
  );
  return token;
}

// POST /api/auth/login - Validate password and return a session token
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password, isAdmin, totpCode }: LoginRequest = req.body;

    if (!password) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Password is required'
      };
      res.status(400).json(response);
      return;
    }

    const expectedPassword = isAdmin
      ? process.env.ADMIN_PASSWORD
      : process.env.CLIENT_PASSWORD;

    if (!expectedPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: isAdmin ? 'Admin login not configured' : 'Login not configured'
      };
      res.status(503).json(response);
      return;
    }

    if (isAdmin) {
      const totpSecret = process.env.ADMIN_TOTP_SECRET;

      // Validate password and TOTP together so neither can be brute-forced independently.
      // If ADMIN_TOTP_SECRET is not set, TOTP is not required (2FA disabled for this install).
      const hashedPassword = hashPassword(password);
      const expectedHashedPassword = hashPassword(expectedPassword);
      const passwordValid = hashedPassword === expectedHashedPassword;
      const totpValid = totpSecret
        ? speakeasy.totp.verify({ secret: totpSecret, encoding: 'base32', token: totpCode ?? '', window: 1 })
        : !totpCode;

      if (!passwordValid || !totpValid) {
        const response: ApiResponse<null> = {
          success: false,
          error: 'Invalid credentials'
        };
        res.status(401).json(response);
        return;
      }

      const token = await createSession('admin', req);
      const response: ApiResponse<LoginResponse> = {
        success: true,
        data: { apiKey: token }
      };
      res.json(response);
      return;
    }

    // Non-admin: password only
    const hashedPassword = hashPassword(password);
    const expectedHashedPassword = hashPassword(expectedPassword);

    if (hashedPassword !== expectedHashedPassword) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Invalid password'
      };
      res.status(401).json(response);
      return;
    }

    const token = await createSession('user', req);
    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: { apiKey: token }
    };
    res.json(response);
  } catch (error) {
    console.error('Error during login:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to process login'
    };

    res.status(500).json(response);
  }
});

// DELETE /api/auth/session - Invalidate the current session token
router.delete('/session', async (req: Request, res: Response) => {
  const token = req.headers['x-api-key'] as string | undefined;
  if (token) {
    try {
      const db = DatabaseManager.getInstance();
      await db.run('DELETE FROM sessions WHERE token = ?', [token]);
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  }
  res.json({ success: true });
});

export default router;
