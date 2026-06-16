import exifr from 'exifr';

export interface ExtractedMetadata {
  latitude?: number;
  longitude?: number;
  capturedAt?: string;
}

export async function extractMetadata(filepath: string): Promise<ExtractedMetadata> {
  try {
    const data = await exifr.parse(filepath, {
      gps: true,
      pick: ['DateTimeOriginal', 'CreateDate'],
    });

    if (!data) return {};

    const captureDate: Date | undefined = data.DateTimeOriginal ?? data.CreateDate;

    return {
      latitude: data.latitude,
      longitude: data.longitude,
      capturedAt: captureDate?.toISOString(),
    };
  } catch {
    return {};
  }
}
