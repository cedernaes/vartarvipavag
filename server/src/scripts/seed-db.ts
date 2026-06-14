import { DatabaseManager } from '../models/database';

interface SeedPosition {
  id: string;
  timestamp: string;
  latitude: number;
  longitude: number;
}

// Fake Interrail trip used for local development / trying out the app and the
// Telegram bot without real Home Assistant data. Stockholm -> Paris.
const seedPositions: SeedPosition[] = [
  // Day 1 - Stockholm to Copenhagen journey
  { id: '1', timestamp: '2024-12-15T00:00:00Z', latitude: 59.3293, longitude: 18.0686 }, // Stockholm hotel (midnight = night stop)
  { id: '2', timestamp: '2024-12-15T08:00:00Z', latitude: 59.3300, longitude: 18.0590 }, // Stockholm Central Station
  { id: '3', timestamp: '2024-12-15T09:00:00Z', latitude: 59.2741, longitude: 18.0652 }, // Leaving Stockholm
  { id: '4', timestamp: '2024-12-15T10:00:00Z', latitude: 58.9700, longitude: 17.6400 }, // Södertälje
  { id: '5', timestamp: '2024-12-15T11:00:00Z', latitude: 58.5800, longitude: 16.1800 }, // Katrineholm
  { id: '6', timestamp: '2024-12-15T12:00:00Z', latitude: 58.4108, longitude: 15.6214 }, // Linköping
  { id: '7', timestamp: '2024-12-15T13:00:00Z', latitude: 57.7826, longitude: 14.1618 }, // Växjö
  { id: '8', timestamp: '2024-12-15T14:00:00Z', latitude: 56.8777, longitude: 14.8091 }, // Alvesta
  { id: '9', timestamp: '2024-12-15T15:00:00Z', latitude: 56.0465, longitude: 12.6945 }, // Helsingborg
  { id: '10', timestamp: '2024-12-15T16:00:00Z', latitude: 55.6761, longitude: 12.5683 }, // Arriving in Copenhagen

  // Day 2 - Copenhagen night stop
  { id: '11', timestamp: '2024-12-16T00:00:00Z', latitude: 55.6761, longitude: 12.5683 }, // Copenhagen hotel (midnight = night stop)
  { id: '12', timestamp: '2024-12-16T09:00:00Z', latitude: 55.6730, longitude: 12.5640 }, // Exploring Copenhagen
  { id: '13', timestamp: '2024-12-16T10:00:00Z', latitude: 55.6794, longitude: 12.5950 }, // Nyhavn area
  { id: '14', timestamp: '2024-12-16T11:00:00Z', latitude: 55.6867, longitude: 12.5700 }, // Rosenborg Castle
  { id: '15', timestamp: '2024-12-16T12:00:00Z', latitude: 55.6760, longitude: 12.5680 }, // Back to central Copenhagen
  { id: '16', timestamp: '2024-12-16T13:00:00Z', latitude: 55.6740, longitude: 12.5650 }, // Copenhagen Central Station
  { id: '17', timestamp: '2024-12-16T14:00:00Z', latitude: 55.4038, longitude: 12.5150 }, // Roskilde
  { id: '18', timestamp: '2024-12-16T15:00:00Z', latitude: 55.0500, longitude: 12.0800 }, // Crossing Denmark
  { id: '19', timestamp: '2024-12-16T16:00:00Z', latitude: 54.9100, longitude: 11.4000 }, // Fehmarn crossing
  { id: '20', timestamp: '2024-12-16T17:00:00Z', latitude: 54.3233, longitude: 10.1394 }, // Kiel
  { id: '21', timestamp: '2024-12-16T18:00:00Z', latitude: 53.8667, longitude: 10.6833 }, // Lübeck
  { id: '22', timestamp: '2024-12-16T19:00:00Z', latitude: 53.5511, longitude: 9.9937 }, // Hamburg
  { id: '23', timestamp: '2024-12-16T20:00:00Z', latitude: 53.0759, longitude: 8.8072 }, // Bremen
  { id: '24', timestamp: '2024-12-16T21:00:00Z', latitude: 52.3759, longitude: 9.7320 }, // Hannover
  { id: '25', timestamp: '2024-12-16T22:00:00Z', latitude: 52.5200, longitude: 13.4050 }, // Arriving in Berlin

  // Day 3 - Berlin night stop
  { id: '26', timestamp: '2024-12-17T00:00:00Z', latitude: 52.5200, longitude: 13.4050 }, // Berlin hotel (midnight = night stop)
  { id: '27', timestamp: '2024-12-17T09:00:00Z', latitude: 52.5163, longitude: 13.3777 }, // Brandenburg Gate
  { id: '28', timestamp: '2024-12-17T10:00:00Z', latitude: 52.5200, longitude: 13.4050 }, // Alexanderplatz
  { id: '29', timestamp: '2024-12-17T11:00:00Z', latitude: 52.5070, longitude: 13.4026 }, // Potsdamer Platz
  { id: '30', timestamp: '2024-12-17T12:00:00Z', latitude: 52.5014, longitude: 13.4133 }, // Checkpoint Charlie
  { id: '31', timestamp: '2024-12-17T13:00:00Z', latitude: 52.5200, longitude: 13.4050 }, // Back to central Berlin
  { id: '32', timestamp: '2024-12-17T14:00:00Z', latitude: 52.5244, longitude: 13.4105 }, // Berlin Hauptbahnhof
  { id: '33', timestamp: '2024-12-17T15:00:00Z', latitude: 52.1315, longitude: 11.6399 }, // Magdeburg
  { id: '34', timestamp: '2024-12-17T16:00:00Z', latitude: 51.9606, longitude: 7.6261 }, // Münster
  { id: '35', timestamp: '2024-12-17T17:00:00Z', latitude: 51.2277, longitude: 6.7735 }, // Düsseldorf
  { id: '36', timestamp: '2024-12-17T18:00:00Z', latitude: 50.9375, longitude: 6.9603 }, // Cologne
  { id: '37', timestamp: '2024-12-17T19:00:00Z', latitude: 50.7753, longitude: 6.0839 }, // Aachen
  { id: '38', timestamp: '2024-12-17T20:00:00Z', latitude: 50.8503, longitude: 4.3517 }, // Brussels
  { id: '39', timestamp: '2024-12-17T21:00:00Z', latitude: 50.6292, longitude: 3.0573 }, // Lille
  { id: '40', timestamp: '2024-12-17T22:00:00Z', latitude: 48.8566, longitude: 2.3522 }, // Arriving in Paris

  // Day 4 - Paris night stop
  { id: '41', timestamp: '2024-12-18T00:00:00Z', latitude: 48.8566, longitude: 2.3522 }, // Paris hotel (midnight = night stop)

  // Day 5 - Paris night stop
  { id: '42', timestamp: '2024-12-19T00:00:00Z', latitude: 48.8566, longitude: 2.3522 }, // Paris hotel (midnight = night stop)
];

async function seed(): Promise<void> {
  const db = DatabaseManager.getInstance();

  for (const p of seedPositions) {
    await db.run(
      `INSERT OR REPLACE INTO positions (id, timestamp, latitude, longitude, source)
       VALUES (?, ?, ?, ?, ?)`,
      [p.id, p.timestamp, p.latitude, p.longitude, 'seed']
    );
  }

  console.log(`Seeded ${seedPositions.length} positions into the database`);
  db.close();
}

seed().catch((error) => {
  console.error('Failed to seed database:', error);
  process.exit(1);
});
