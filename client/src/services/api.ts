import axios from 'axios';
import seedrandom from 'seedrandom';
import { ApiResponse, Position, Post } from '../types';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

function metersToLatitudeDegrees(meters: number): number {
  return meters / 111000;
}

function metersToLongitudeDegrees(meters: number, latitude: number): number {
  const metersPerDegree = 111000 * Math.cos(latitude * Math.PI / 180);
  return meters / metersPerDegree;
}

function randomizePosition(rng: () => number, position: Position): Position {
  const noiseMeters = 50;
  const angle = rng() * 2 * Math.PI;
  const latOffset = metersToLatitudeDegrees(noiseMeters * Math.cos(angle));
  const lonOffset = metersToLongitudeDegrees(noiseMeters * Math.sin(angle), position.latitude);
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
  static async login(password: string): Promise<string> {
    try {
      const response = await api.post<ApiResponse<{ apiKey: string }>>('/api/auth/login', {
        password,
        isAdmin: false
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Login failed');
      }
      return response.data.data.apiKey;
    } catch (error: any) {
      if (error.response?.data?.error) throw new Error(error.response.data.error);
      throw error;
    }
  }

  static async adminLogin(password: string, totpCode: string): Promise<string> {
    try {
      const response = await api.post<ApiResponse<{ apiKey: string }>>('/api/auth/login', {
        password,
        isAdmin: true,
        totpCode,
      });
      if (!response.data.success || !response.data.data) {
        throw new Error(response.data.error || 'Admin login failed');
      }
      return response.data.data.apiKey;
    } catch (error: any) {
      if (error.response?.data?.error) throw new Error(error.response.data.error);
      throw error;
    }
  }

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

  static async healthCheck(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.status === 200;
    } catch {
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
    return `${import.meta.env.VITE_API_URL}/api/feed/media/${filename}`;
  }
}

export default PositionService;
