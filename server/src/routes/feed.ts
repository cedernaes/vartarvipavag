import { Router, Request, Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { join } from 'path';
import { lookup } from 'mime-types';
import { DatabaseManager } from '../models/database';
import { ApiResponse, Post } from '../types';
import { securityMiddleware } from '../middleware/security';

const router = Router();
const db = DatabaseManager.getInstance();
const MEDIA_DIR = join(__dirname, '../../data/media');

// GET /api/feed — all posts, newest first
router.get('/', securityMiddleware.validateApiKey, async (req: Request, res: Response) => {
  try {
    const rows = await db.all(
      `SELECT id, timestamp, type, caption, media_path, latitude, longitude, telegram_user
       FROM posts ORDER BY timestamp DESC`
    );

    const posts: Post[] = rows.map((r: any) => ({
      id: r.id,
      timestamp: r.timestamp,
      type: r.type,
      caption: r.caption ?? undefined,
      media_path: r.media_path ?? undefined,
      latitude: r.latitude ?? undefined,
      longitude: r.longitude ?? undefined,
      telegram_user: r.telegram_user ?? undefined,
    }));

    const response: ApiResponse<Post[]> = { success: true, data: posts };
    res.json(response);
  } catch (error) {
    console.error('Error fetching feed:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch feed' });
  }
});

// GET /api/feed/media/:filename — serve a media file (public, filenames are UUIDs)
router.get('/media/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;

  // Prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    res.status(400).json({ success: false, error: 'Invalid filename' });
    return;
  }

  const filepath = join(MEDIA_DIR, filename);
  if (!existsSync(filepath)) {
    res.status(404).json({ success: false, error: 'File not found' });
    return;
  }

  const mimeType = lookup(filename) || 'application/octet-stream';
  res.setHeader('Content-Type', mimeType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  createReadStream(filepath).pipe(res);
});

export default router;
