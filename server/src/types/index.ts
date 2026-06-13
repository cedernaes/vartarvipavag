export interface Position {
  id: string;
  timestamp: string; // ISO string format
  latitude: number;
  longitude: number;
}

export interface CreatePositionRequest {
  latitude: number;
  longitude: number;
}

export interface UpdatePositionRequest {
  latitude?: number;
  longitude?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PositionWithDistance extends Position {
  distanceFromPrevious?: number; // in kilometers
}

export interface Post {
  id: string;
  timestamp: string;
  type: 'photo' | 'video' | 'text';
  caption?: string;
  media_path?: string;
  latitude?: number;
  longitude?: number;
  telegram_user?: string;
} 