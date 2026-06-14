import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Position } from '../types';

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
  }
  .daily-position-marker {
    z-index: 100 !important;
  }
  
  /* Info box styling */
  .map-info-box {
    background: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: 'Courier New', 'Source Code Pro', 'Inconsolata', 'SF Mono', 'Monaco', 'Roboto Mono', 'Source Code Pro', Courier, monospace !important;
    font-size: 14px;
    line-height: 1.4;
    margin-bottom: 16px;
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

interface InterrailMapProps {
  positions: Position[];
  homeTimezone?: string; // IANA timezone (e.g., "Europe/Stockholm")
  nightStopHour?: number; // Hour of day for night stop detection (0-23)
}

const InterrailMap: React.FC<InterrailMapProps> = ({
  positions,
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
    html: `
      <div style="
        background-color: #ae3c40;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        z-index: 1000;
        position: relative;
      "></div>
    `,
    className: 'night-stop-marker',
    iconSize: [25, 25],
    iconAnchor: [12.5, 12.5],
    popupAnchor: [0, -12.5]
  }), []);

  const dailyPositionIcon = React.useMemo(() => L.divIcon({
    html: `
      <div style="
        background-color:#1f2937;
        opacity=0.7;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        border: 0px solid;
        z-index: 100;
        position: relative;
      "></div>
    `,
    className: 'daily-position-marker',
    iconSize: [12, 12],
    iconAnchor: [6, 6],
    popupAnchor: [0, -6]
  }), []);

  // Create polyline coordinates for the journey path
  const polylineCoordinates: [number, number][] = positions.map(pos => [pos.latitude, pos.longitude]);

  /**
   * Pre-compute which positions are night stops by finding the position
   * closest to the configured hour for each day in the home timezone.
   * 
   * We group positions by calendar day in the home timezone, then for each day,
   * find the position with the time closest to the configured night stop hour.
   * This handles timezone differences automatically since we convert all times
   * to the home timezone first.
   */
  const nightStopPositionIds = React.useMemo(() => {
    const nightStops = new Set<string>();

    if (positions.length === 0) {
      return nightStops;
    }

    /**
     * Convert a timestamp to the home timezone and extract date components
     */
    const getDateInHomeTimezone = (timestamp: string): {
      date: Date;
      year: number;
      month: number;
      day: number;
      hour: number;
      minute: number;
      timeOfDay: number; // Minutes since midnight
    } => {
      const date = new Date(timestamp);

      // Use Intl.DateTimeFormat to get the date/time in the home timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: configuredTimezone,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
      });

      const parts = formatter.formatToParts(date);
      const year = parseInt(parts.find(p => p.type === 'year')?.value || '0', 10);
      const month = parseInt(parts.find(p => p.type === 'month')?.value || '0', 10);
      const day = parseInt(parts.find(p => p.type === 'day')?.value || '0', 10);
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
      const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
      const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

      // Calculate minutes since midnight
      const timeOfDay = hour * 60 + minute + second / 60;

      return {
        date,
        year,
        month,
        day,
        hour,
        minute,
        timeOfDay
      };
    };

    // Group positions by "night" - a night spans from evening of day N to morning of day N+1
    // A position at 02:00 on day N belongs to the night between day N-1 and day N
    // A position at 18:00 on day N belongs to the night between day N and day N+1
    const positionsByNight = new Map<string, Array<{ position: Position; timeOfDay: number }>>();

    positions.forEach(position => {
      const dateInfo = getDateInHomeTimezone(position.timestamp);
      const dayKey = `${dateInfo.year}-${dateInfo.month}-${dateInfo.day}`;

      // Determine which "night" this position belongs to
      // A night spans from evening (18:00) of day N to morning (12:00) of day N+1
      // If it's early morning (before noon), it belongs to the previous day's night
      // Otherwise, it belongs to the current day's night (which ends the next morning)
      let nightKey: string;
      if (dateInfo.hour < 12) {
        // Early morning position (like 02:00) belongs to the previous day's night
        // Calculate previous day by creating a new date and subtracting a day
        const date = new Date(dateInfo.date);
        date.setTime(date.getTime() - 24 * 60 * 60 * 1000);
        const prevDateInfo = getDateInHomeTimezone(date.toISOString());
        nightKey = `${prevDateInfo.year}-${prevDateInfo.month}-${prevDateInfo.day}`;
      } else {
        // Afternoon/evening position belongs to the current day's night
        nightKey = dayKey;
      }

      if (!positionsByNight.has(nightKey)) {
        positionsByNight.set(nightKey, []);
      }

      positionsByNight.get(nightKey)!.push({
        position,
        timeOfDay: dateInfo.timeOfDay
      });
    });

    // For each night, find the position closest to the configured night stop hour
    const targetMinutes = configuredNightStopHour * 60;

    positionsByNight.forEach((nightPositions) => {
      if (nightPositions.length === 0) return;

      // Find the position with the smallest time difference from target hour
      // Handle circular time: positions late at night might be closer to early morning target
      let closestPosition = nightPositions[0];
      let minDifference = Infinity;

      nightPositions.forEach(({ position, timeOfDay }) => {
        // Calculate the minimum circular distance (considering wrap-around at midnight)
        // For example, if target is 02:00 (120 min) and position is 23:30 (1410 min),
        // the distance is min(1290, 30) = 30 minutes (wrapping to next day)
        const diffForward = Math.abs(timeOfDay - targetMinutes);
        const diffWrapNext = Math.abs((timeOfDay + 24 * 60) - targetMinutes);
        const diffWrapPrev = timeOfDay > targetMinutes
          ? Math.abs(timeOfDay - (targetMinutes + 24 * 60))
          : Infinity;

        const minDiff = Math.min(diffForward, diffWrapNext, diffWrapPrev);

        if (minDiff < minDifference) {
          minDifference = minDiff;
          closestPosition = { position, timeOfDay };
        }
      });

      // Only add ONE night stop per night
      nightStops.add(closestPosition.position.id);
    });

    return nightStops;
  }, [positions, configuredTimezone, configuredNightStopHour]);

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
      {/* Info box above map */}
      {latestPosition && (
        <div className="map-info-box">
          <h4>📍 Senaste uppdatering</h4>
          <p>
            {formatDateInfoBox(latestPosition.timestamp)} vid {latestPosition.latitude.toFixed(5)}, {latestPosition.longitude.toFixed(4)} - <button onClick={panToLatestMarker}>Se på karta</button>
          </p>
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
          
          return (
            <Marker
              key={position.id}
              position={[position.latitude, position.longitude]}
              icon={dailyPositionIcon}
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
        
        {/* Night stop markers - rendered after daily positions to appear on top */}
        {positions.map((position, _) => {
          const positionType = getPositionType(position.id);

          // Only render night stops in this pass
          if (positionType !== 'night_stop') return null;
          
          return (
                         <Marker
               key={`night-${position.id}`}
               position={[position.latitude, position.longitude]}
               icon={nightStopIcon}
               zIndexOffset={1000}
             >
              <Popup>
                <div style={{ minWidth: '180px' }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#ae3c40' }}>
                    🌙 Nattens vila
                  </h4>
                  
                  <div style={{ marginBottom: '4px', fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📆 {formatDateNightStop(position.timestamp)}
                  </div>
                  
                  <div style={{ fontSize: '0.9em', color: '#666', fontWeight: 'bold' }}>
                    📍 {position.latitude.toFixed(5)}, {position.longitude.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      </div>
    </div>
  );
};

export default InterrailMap; 