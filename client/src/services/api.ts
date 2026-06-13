import axios from 'axios';
import seedrandom from 'seedrandom';
import { ApiResponse, Position, Post } from '../types';
import { apiKey, hashPassword, setApiKey } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

    // Add API key if available
    if (apiKey) {
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
      const hashedPassword = await hashPassword(password);
      setApiKey(hashedPassword);
    } catch (error) {
      console.error('Error during login:', error);
      throw error;
    }
  }

  static async logout(): Promise<void> {
    setApiKey(null);
  }

  static isAuthenticated(): boolean {
    return apiKey !== null;
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

  static getMediaUrl(filename: string): string {
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return `${base}/api/feed/media/${filename}`;
  }
}

export default PositionService;