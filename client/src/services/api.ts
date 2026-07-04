import axios from 'axios';
import seedrandom from 'seedrandom';
import { ApiResponse, Position, Post } from '../types';
import { apiKey, adminApiKey, setApiKey, setAdminApiKey } from './auth';

// In development without VITE_API_URL, use relative paths to go through Vite proxy
// In production or when VITE_API_URL is set, use the explicit URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth header and logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);

    // Add admin API key if available (takes precedence), otherwise use regular API key
    if (adminApiKey) {
      config.headers['x-api-key'] = adminApiKey;
    } else if (apiKey) {
      config.headers['x-api-key'] = apiKey;
    }

    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error);

    if (error.response?.status === 403) {
      console.error('Write operations are restricted to localhost');
    }

    // Handle authentication errors
    if (error.response?.status === 401) {
      console.error('Authentication failed - clearing stored credentials');
      setApiKey(null);
      setAdminApiKey(null);
    }

    return Promise.reject(error);
  }
);

/**
 * Convert meters to degrees of latitude
 * 1 degree of latitude ≈ 111,000 meters (constant)
 */
function metersToLatitudeDegrees(meters: number): number {
  return meters / 111000;
}

/**
 * Convert meters to degrees of longitude at a given latitude
 * 1 degree of longitude ≈ 111,000 * cos(latitude) meters
 */
function metersToLongitudeDegrees(meters: number, latitude: number): number {
  const metersPerDegree = 111000 * Math.cos(latitude * Math.PI / 180);
  return meters / metersPerDegree;
}

function randomizePosition(rng: () => number, position: Position): Position {
  // Apply exactly 50 meters of noise in a random direction
  const noiseMeters = 50;

  // Pick a random angle (0 to 2π)
  const angle = rng() * 2 * Math.PI;

  // Calculate offset components in meters
  // North-south component (latitude)
  const latOffsetMeters = noiseMeters * Math.cos(angle);
  // East-west component (longitude)
  const lonOffsetMeters = noiseMeters * Math.sin(angle);

  // Convert meter offsets to degrees
  const latOffset = metersToLatitudeDegrees(latOffsetMeters);
  const lonOffset = metersToLongitudeDegrees(lonOffsetMeters, position.latitude);

  return {
    ...position,
    latitude: position.latitude + latOffset,
    longitude: position.longitude + lonOffset,
  };
}

export function deterministicRandomizePosition(positions: Position[]): Position[] {
  const rng = seedrandom("42");
  return positions.map((position) => randomizePosition(rng, position));
}

export class PositionService {
  static async login(password: string): Promise<void> {
    try {
      const response = await api.post<ApiResponse<{ apiKey: string }>>('/api/auth/login', {
        password,
        isAdmin: false
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Login failed');
      }

      setApiKey(response.data.data.apiKey);
    } catch (error: any) {
      console.error('Error during login:', error);
      // Re-throw with proper error message
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  static async adminLogin(password: string): Promise<void> {
    try {
      const response = await api.post<ApiResponse<{ apiKey: string }>>('/api/auth/login', {
        password,
        isAdmin: true
      });

      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Admin login failed');
      }

      setAdminApiKey(response.data.data.apiKey);
    } catch (error: any) {
      console.error('Error during admin login:', error);
      // Re-throw with proper error message
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error);
      }
      throw error;
    }
  }

  static async logout(): Promise<void> {
    setApiKey(null);
    setAdminApiKey(null);
  }

  static isAuthenticated(): boolean {
    return apiKey !== null || adminApiKey !== null;
  }

  static isAdminAuthenticated(): boolean {
    return adminApiKey !== null;
  }

  /**
   * Fetch all positions from the API
   */
  static async getAllPositions(): Promise<Position[]> {
    try {
      const response = await api.get<ApiResponse<Position[]>>('/api/positions');

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to fetch positions');
      }

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching positions:', error);
      throw error;
    }
  }

  /**
   * Delete a position by ID (admin only)
   */
  static async deletePosition(id: string): Promise<void> {
    try {
      const response = await api.delete<ApiResponse<null>>(`/api/positions/${id}`);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete position');
      }
    } catch (error) {
      console.error('Error deleting position:', error);
      throw error;
    }
  }

  /**
   * Check server health
   */
  static async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export class FeedService {
  static async getFeed(): Promise<Post[]> {
    const response = await api.get<ApiResponse<Post[]>>('/api/feed');
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to fetch feed');
    }
    return response.data.data || [];
  }

  static async deletePost(id: string): Promise<void> {
    const response = await api.delete<ApiResponse<null>>(`/api/feed/${id}`);
    if (!response.data.success) {
      throw new Error(response.data.error || 'Failed to delete post');
    }
  }

  static getMediaUrl(filename: string): string {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return `${base}/api/feed/media/${filename}`;
  }
}

export default PositionService;