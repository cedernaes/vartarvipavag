import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Position, Post } from '../types';
import { computeNightStopPositionIds } from '../utils/nightStops';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom popup styles and marker layering
const mapStyle = `
  .leaflet-popup-content-wrapper {
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .leaflet-popup-content {
    font-family: 'Courier New', 'Source Code Pro', 'Inconsolata', 'SF Mono', 'Monaco', 'Roboto Mono', 'Source Code Pro', Courier, monospace !important;
    font-size: 14px;
    line-height: 1.4;
    margin: 8px 12px;
  }
  .leaflet-popup-close-button {
    font-size: 18px !important;
    line-height: 18px !important;
    width: 24px !important;
    height: 24px !important;
    color: #666 !important;
    font-weight: bold !important;
    padding: 0 !important;
    text-align: center !important;
    top: 6px !important;
    right: 6px !important;
  }
  .leaflet-popup-close-button:hover {
    background-color: #f0f0f0 !important;
    border-radius: 50% !important;
  }
  
  /* Ensure consistent marker layering */
  .night-stop-marker {
    z-index: 1000 !important;
    background-color: #ae3c40;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
  }
  .night-stop-cluster {
    z-index: 1000 !important;
    background-color: #ae3c40;
    border-radius: 50%;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 14px;
    font-family: 'Courier New', monospace;
  }
  .daily-position-marker {
    z-index: 100 !important;
    background-color: #1f2937;
    opacity: 0.7;
    border-radius: 50%;
  }
  
  /* Info box styling */
  .map-info-boxes {
    display: flex;
    gap: 12px;
    margin-bottom: 16px;
  }

  @media (max-width: 600px) {
    .map-info-boxes {
      flex-direction: column;
    }
  }

  .map-info-box {
    flex: 1;
    background: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'Courier New', 'Source Code Pro', 'Inconsolata', 'SF Mono', 'Monaco', 'Roboto Mono', 'Source Code Pro', Courier, monospace !important;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .map-info-box h4 {
    margin: 0 0 6px 0;
    color: #ae3c40;
    font-size: 16px;
    font-weight: bold;
  }
  
  .map-info-box p {
    margin: 0 0 8px 0;
    color: #1f2937;
  }
  
  .map-info-box button {
    background: none;
    color: #ae3c40;
    border: none;
    padding: 0;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    text-decoration: underline;
    font-family: inherit;
    transition: color 0.2s;
  }
  
  .map-info-box button:hover {
    color: #8b2c2f;
  }
`;

const CLUSTER_RADIUS_PX = 20;

// Returns a hot-metal color for a position based on how recently it was recorded
// relative to latestTimestamp. Within the last 24h: black → dark-red → orange → yellow.
function positionHeatColor(posTimestamp: string, latestTimestamp: string): string {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const age = new Date(latestTimestamp).getTime() - new Date(posTimestamp).getTime();
  if (age >= ONE_DAY_MS) return '#1a1a1a';

  const heat = 1 - age / ONE_DAY_MS; // 0 = 24 h old, 1 = newest
  const stops: [number, number, number, number][] = [
    [0.00,  26,  26,  26],  // near-black
    [0.25,  80,  10,   0],  // very dark red
    [0.50, 160,  40,   0],  // dark red
    [0.75, 220, 100,   0],  // orange
    [1.00, 255, 220,  20],  // yellow
  ];

  let lo = stops[0], hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (heat >= stops[i][0] && heat <= stops[i + 1][0]) { lo = stops[i]; hi = stops[i + 1]; break; }
  }

  const t = hi[0] === lo[0] ? 0 : (heat - lo[0]) / (hi[0] - lo[0]);
  const r = Math.round(lo[1] + t * (hi[1] - lo[1]));
  const g = Math.round(lo[2] + t * (hi[2] - lo[2]));
  const b = Math.round(lo[3] + t * (hi[3] - lo[3]));
  return `rgb(${r},${g},${b})`;
}

function NightStopClusters({
  positions,
  nightStopPositionIds,
  singleIcon,
  formatDate,
}: {
  positions: Position[];
  nightStopPositionIds: Set<string>;
  singleIcon: L.DivIcon;
  formatDate: (d: string) => string;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const clusters = useMemo(() => {
    const nightStops = positions.filter(p => nightStopPositionIds.has(p.id));

    const withPixels = nightStops.map(pos => ({
      pos,
      px: map.project([pos.latitude, pos.longitude], zoom),
    }));

    const assigned = new Set<string>();
    const result: { lat: number; lng: number; count: number; items: Position[]; icon: L.DivIcon }[] = [];

    for (const item of withPixels) {
      if (assigned.has(item.pos.id)) continue;

      const group = withPixels.filter(other => {
        if (assigned.has(other.pos.id)) return false;
        const dx = item.px.x - other.px.x;
        const dy = item.px.y - other.px.y;
        return Math.sqrt(dx * dx + dy * dy) <= CLUSTER_RADIUS_PX;
      });

      group.forEach(g => assigned.add(g.pos.id));

      const lat = group.reduce((s, g) => s + g.pos.latitude, 0) / group.length;
      const lng = group.reduce((s, g) => s + g.pos.longitude, 0) / group.length;
      const count = group.length;

      const icon = count === 1
        ? singleIcon
        : L.divIcon({
            html: String(count),
            className: 'night-stop-cluster',
            iconSize: [25, 25],
            iconAnchor: [12.5, 12.5],
            popupAnchor: [0, -12.5],
          });

      result.push({ lat, lng, count, items: group.map(g => g.pos), icon });
    }

    return result;
  }, [map, zoom, positions, nightStopPositionIds, singleIcon]);

  return (
    <>
      {clusters.map((cluster, i) => (
        <Marker
          key={i}
          position={[cluster.lat, cluster.lng]}
          icon={cluster.icon}
          zIndexOffset={1000}
        >
          <Popup>
            <div style={{ minWidth: '180px' }}>
              {cluster.count === 1 ? (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: '#ae3c40' }}>🌙 Nattens vila</h4>
                  <div style={{ marginBottom: '4px', fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📆 {formatDate(cluster.items[0].timestamp)}
                  </div>
                  <div style={{ fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📍 {cluster.items[0].latitude.toFixed(5)}, {cluster.items[0].longitude.toFixed(4)}
                  </div>
                </>
              ) : (
                <>
                  <h4 style={{ margin: '0 0 8px 0', color: '#ae3c40' }}>🌙 {cluster.count} nätter</h4>
                  {cluster.items.map((pos, j) => (
                    <div key={j} style={{ marginBottom: '4px', fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                      📆 {formatDate(pos.timestamp)}
                    </div>
                  ))}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </>
  );
}

interface InterrailMapProps {
  positions: Position[];
  posts?: Post[];
  homeTimezone?: string; // IANA timezone (e.g., "Europe/Stockholm")
  nightStopHour?: number; // Hour of day for night stop detection (0-23)
}

const InterrailMap: React.FC<InterrailMapProps> = ({
  positions,
  posts,
  homeTimezone,
  nightStopHour
}) => {
  const [map, setMap] = useState<L.Map | null>(null);

  // Get configuration from props, environment variables, or defaults
  const configuredTimezone = homeTimezone ||
    import.meta.env.VITE_HOME_TIMEZONE ||
    'Europe/Stockholm';
  const configuredNightStopHour = nightStopHour !== undefined
    ? nightStopHour
    : (import.meta.env.VITE_NIGHT_STOP_HOUR
      ? parseInt(import.meta.env.VITE_NIGHT_STOP_HOUR, 10)
      : 2);

  // Europe center coordinates
  const europeCenter: [number, number] = [50.0, 10.0];
  const europeZoom = 4;

  // Get the latest position (last in array)
  const latestPosition = positions[positions.length - 1];

  // Get the latest feed post (posts are sorted newest first)
  const latestPost = posts && posts.length > 0 ? posts[0] : null;

  // Function to pan to latest marker
  const panToLatestMarker = () => {
    if (map && latestPosition) {
      map.setView([latestPosition.latitude, latestPosition.longitude], 10, {
        animate: true,
        duration: 1.5
      });
    }
  };

  // Create custom marker icons for different position types with unique class names
  const nightStopIcon = React.useMemo(() => L.divIcon({
    html: '',
    className: 'night-stop-marker',
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
    popupAnchor: [0, -12.5]
  }), []);


  // Create polyline coordinates for the journey path
  const polylineCoordinates: [number, number][] = positions.map(pos => [pos.latitude, pos.longitude]);

  /**
   * Pre-compute which positions are night stops. See computeNightStopPositionIds
   * for the full algorithm (timezone-aware grouping, one stop per night, and the
   * requirement that the night actually ended).
   */
  const nightStopPositionIds = React.useMemo(
    () => computeNightStopPositionIds(positions, configuredTimezone, configuredNightStopHour),
    [positions, configuredTimezone, configuredNightStopHour]
  );

  /**
   * Determine if a position is a night stop
   */
  const getPositionType = (positionId: string): 'night_stop' | 'daily_position' => {
    return nightStopPositionIds.has(positionId) ? 'night_stop' : 'daily_position';
  };

  // Format date for night stops: "Tis 13 december"
  // Shows the date of the evening/night
  const formatDateNightStop = (dateString: string): string => {
    const date = new Date(dateString);

    // For night stops, we want to show the date of the evening before
    // If timestamp is 2024-07-03T00:15:00Z, we want to show July 2nd
    // because that's the night between July 2nd and July 3rd
    const nightDate = new Date(date.getTime() - 24 * 60 * 60 * 1000); // Subtract 24 hours

    const weekday = nightDate.toLocaleDateString('sv-SE', { weekday: 'short' });
    const day = nightDate.getDate();
    const month = nightDate.toLocaleDateString('sv-SE', { month: 'long' });

    return `${weekday} ${day} ${month}`;
  };

  // Format date for daily positions: "Tis kl HH:MM"
  const formatDateDailyPosition = (dateString: string): string => {
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString('sv-SE', { weekday: 'short' });
    const time = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    const day = date.getDate();
    const month = date.getMonth() + 1;
    return `${weekday} ${day}/${month} kl ${time}`;
  };

  // Format date for info box: "Monday, 13 dec, kl HH:XX"
  const formatDateInfoBox = (dateString: string): string => {
    const date = new Date(dateString);
    const weekday = date.toLocaleDateString('sv-SE', { weekday: 'long' });
    const day = date.getDate();
    const month = date.toLocaleDateString('sv-SE', { month: 'long' });
    const time = date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

    // Capitalize first letter of weekday
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);

    return `${capitalizedWeekday}, ${day} ${month}, kl ${time}`;
  };

  // Auto-fit map to show all positions
  useEffect(() => {
    if (map && positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(pos => [pos.latitude, pos.longitude]));
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [map, positions]);

  // Add custom styles to the document head
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.innerHTML = mapStyle;
    document.head.appendChild(styleElement);

    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  if (positions.length === 0) {
    return (
      <div className="map-container">
        <div className="loading">
          <div style={{ textAlign: 'center' }}>
            <h3>📍 Snart drar vi iväg!</h3>
            <p>Inga positioner spårade ännu.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Info boxes above map */}
      {latestPosition && (
        <div className="map-info-boxes">
          <div className="map-info-box">
            <h4>📍 Senaste plats</h4>
            <p>
              {formatDateInfoBox(latestPosition.timestamp)} - <button onClick={panToLatestMarker}>Se på karta</button>
            </p>
          </div>
          {latestPost && (
            <div className="map-info-box">
              <h4>📸 Senaste uppdatering</h4>
              <p>
                {formatDateInfoBox(latestPost.timestamp)} - <button onClick={() => document.getElementById('feed')?.scrollIntoView({ behavior: 'smooth' })}>Se uppdatering</button>
              </p>
            </div>
          )}
        </div>
      )}

      <div className="map-container">
        <MapContainer
          center={europeCenter}
          zoom={europeZoom}
          style={{ height: '100%', width: '100%' }}
          ref={setMap}
        >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Journey path polyline */}
        {positions.length > 1 && (
          <Polyline
            positions={polylineCoordinates}
            color="#1f2937"
            weight={2.5}
            opacity={0.7}
            dashArray="3, 6"
          />
        )}
        
        {/* Position markers - render daily positions first, then night stops on top */}
        {positions.map((position, _) => {
          const positionType = getPositionType(position.id);

          // Only render daily positions in this pass
          if (positionType !== 'daily_position') return null;

          const color = positionHeatColor(position.timestamp, latestPosition.timestamp);
          const heatIcon = L.divIcon({
            html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};opacity:0.85;"></div>`,
            className: '',
            iconSize: [8, 8],
            iconAnchor: [4, 4],
            popupAnchor: [0, 4],
          });

          return (
            <Marker
              key={position.id}
              position={[position.latitude, position.longitude]}
              icon={heatIcon}
              zIndexOffset={100}
            >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <div style={{ marginBottom: '4px', fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📆 {formatDateDailyPosition(position.timestamp)}
                  </div>
                  
                  <div style={{ fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📍 {position.latitude.toFixed(5)}, {position.longitude.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {/* Night stop markers - clustered by zoom level */}
        <NightStopClusters
          positions={positions}
          nightStopPositionIds={nightStopPositionIds}
          singleIcon={nightStopIcon}
          formatDate={formatDateNightStop}
        />
      </MapContainer>
      </div>
    </div>
  );
};

export default InterrailMap; 