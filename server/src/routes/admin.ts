import { Request, Response, Router } from 'express';
import { DatabaseManager } from '../models/database';
import { securityMiddleware } from '../middleware/security';
import { ApiResponse } from '../types';

const router = Router();

export interface Session {
  token: string;
  type: 'user' | 'admin';
  user_agent: string | null;
  ip: string | null;
  created_at: string;
  last_accessed_at: string;
  device_info: string | null;
}

// GET /api/admin/sessions - list all active sessions
router.get('/sessions', securityMiddleware.validateAdminApiKey, async (req: Request, res: Response) => {
  try {
    const db = DatabaseManager.getInstance();
    const sessions: Session[] = await db.all(
      'SELECT token, type, user_agent, ip, created_at, last_accessed_at, device_info FROM sessions ORDER BY last_accessed_at DESC'
    );
    const response: ApiResponse<Session[]> = { success: true, data: sessions };
    res.json(response);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    const response: ApiResponse<null> = { success: false, error: 'Failed to fetch sessions' };
    res.status(500).json(response);
  }
});

// DELETE /api/admin/sessions/:token - revoke a specific session
router.delete('/sessions/:token', securityMiddleware.validateAdminApiKey, async (req: Request, res: Response) => {
  try {
    const db = DatabaseManager.getInstance();
    await db.run('DELETE FROM sessions WHERE token = ?', [req.params.token]);
    const response: ApiResponse<null> = { success: true };
    res.json(response);
  } catch (error) {
    console.error('Error revoking session:', error);
    const response: ApiResponse<null> = { success: false, error: 'Failed to revoke session' };
    res.status(500).json(response);
  }
});

export default router;
