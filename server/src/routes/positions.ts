import { Request, Response, Router } from 'express';
import { securityMiddleware } from '../middleware/security';
import { PositionModel } from '../models/Position';
import { ApiResponse, CreatePositionRequest, Position, UpdatePositionRequest } from '../types';

const router = Router();
const positionModel = new PositionModel();

// GET /api/positions - Get all positions (require API key for external requests)
router.get('/', securityMiddleware.validateApiKey, async (req: Request, res: Response) => {
  try {
    const positions = await positionModel.findAll();

    const response: ApiResponse<Position[]> = {
      success: true,
      data: positions
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching positions:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch positions'
    };

    res.status(500).json(response);
  }
});

// POST /api/positions - Create new position (internal network only)
router.post('/', securityMiddleware.onlyInternalNetwork, async (req: Request, res: Response) => {
  try {
    const positionData: CreatePositionRequest = req.body;

    // Validate required fields
    if (!positionData.latitude || !positionData.longitude) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Latitude and longitude are required'
      };

      res.status(400).json(response);
      return;
    }

    // Validate coordinate ranges
    if (positionData.latitude < -90 || positionData.latitude > 90) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Latitude must be between -90 and 90'
      };

      res.status(400).json(response);
      return;
    }

    if (positionData.longitude < -180 || positionData.longitude > 180) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Longitude must be between -180 and 180'
      };

      res.status(400).json(response);
      return;
    }

    const position = await positionModel.create(positionData);

    const response: ApiResponse<Position> = {
      success: true,
      data: position
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating position:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to create position'
    };

    res.status(500).json(response);
  }
});

// PUT /api/positions/:id - Update position (internal network only)
router.put('/:id', securityMiddleware.onlyInternalNetwork, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData: UpdatePositionRequest = req.body;

    // Validate coordinate ranges if provided
    if (updateData.latitude !== undefined && (updateData.latitude < -90 || updateData.latitude > 90)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Latitude must be between -90 and 90'
      };

      res.status(400).json(response);
      return;
    }

    if (updateData.longitude !== undefined && (updateData.longitude < -180 || updateData.longitude > 180)) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Longitude must be between -180 and 180'
      };

      res.status(400).json(response);
      return;
    }

    const position = await positionModel.update(id, updateData);

    if (!position) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Position not found'
      };

      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Position> = {
      success: true,
      data: position
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating position:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to update position'
    };

    res.status(500).json(response);
  }
});

// DELETE /api/positions/:id - Delete position (admin + internal network only)
router.delete('/:id', securityMiddleware.requireAdminAndLocalNetwork, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await positionModel.delete(id);

    if (!deleted) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'Position not found'
      };

      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<null> = {
      success: true
    };

    res.json(response);
  } catch (error) {
    console.error('Error deleting position:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to delete position'
    };

    res.status(500).json(response);
  }
});

// GET /api/positions/latest - Get latest position (require API key for external requests)
router.get('/latest', securityMiddleware.validateApiKey, async (req: Request, res: Response) => {
  try {
    const position = await positionModel.getLatestPosition();

    if (!position) {
      const response: ApiResponse<null> = {
        success: false,
        error: 'No positions found'
      };

      res.status(404).json(response);
      return;
    }

    const response: ApiResponse<Position> = {
      success: true,
      data: position
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching latest position:', error);

    const response: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch latest position'
    };

    res.status(500).json(response);
  }
});

export default router;