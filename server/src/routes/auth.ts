import { Request, Response, Router } from 'express';
import { ApiResponse } from '../types';
import crypto from 'crypto';
import speakeasy from 'speakeasy';

const router = Router();

// Hash password using Node.js crypto (equivalent to client-side Web Crypto API)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

interface LoginRequest {
  password: string;
  isAdmin?: boolean;
  totpCode?: string;
}

interface LoginResponse {
  apiKey: string;
}

// POST /api/auth/login - Validate password and return API key
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

    // Get the expected password from environment
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

      const response: ApiResponse<LoginResponse> = {
        success: true,
        data: { apiKey: hashedPassword }
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

    // Password is valid, return the API key (hashed password)
    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        apiKey: hashedPassword
      }
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

export default router;

