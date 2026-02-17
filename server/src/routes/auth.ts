import { Request, Response, Router } from 'express';
import { ApiResponse } from '../types';
import crypto from 'crypto';

const router = Router();

// Hash password using Node.js crypto (equivalent to client-side Web Crypto API)
function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

interface LoginRequest {
  password: string;
  isAdmin?: boolean;
}

interface LoginResponse {
  apiKey: string;
}

// POST /api/auth/login - Validate password and return API key
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { password, isAdmin }: LoginRequest = req.body;

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

    // Hash the provided password
    const hashedPassword = hashPassword(password);

    // Compare with expected hashed password (or hash the expected password if it's not already hashed)
    // Since we're storing passwords in env, we compare the hashed versions
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

