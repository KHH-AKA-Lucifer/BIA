import React, { useEffect } from 'react'
import L from 'leaflet'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface LocationData {
  location: string
  revenue: number
  latitude: number
  longitude: number
}

interface LocationMapProps {
  locations: LocationData[]
  onSelectLocation?: (location: string) => void
}

const compactCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

// Custom marker with revenue color badge
const createCustomIcon = (revenue: number, maxRevenue: number) => {
  const percentage = (revenue / maxRevenue) * 100
  let color = '#ef4444' // red
  if (percentage >= 80) color = '#10b981' // green
  else if (percentage >= 60) color = '#84cc16' // lime
  else if (percentage >= 40) color = '#eab308' // yellow
  else if (percentage >= 20) color = '#f97316' // orange

  return L.divIcon({
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
      ">
        <div style="
          background-color: ${color};
          color: white;
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 2px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          white-space: nowrap;
        ">
          ${compactCurrency(revenue)}
        </div>
        <div style="
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid ${color};
        "></div>
      </div>
    `,
    iconSize: [50, 35],
    iconAnchor: [25, 35],
    popupAnchor: [0, -35],
    className: 'custom-marker-icon',
  })
}

// Component to fit all markers in view
const FitBoundsComponent: React.FC<{ locations: LocationData[] }> = ({ locations }) => {
  const map = useMap()

  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds(locations.map(l => [l.latitude, l.longitude]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 8 })
    }
  }, [locations, map])

  return null
}

export const LocationMap: React.FC<LocationMapProps> = ({ locations, onSelectLocation }) => {
  // Calculate map center (will be overridden by FitBounds)
  const center: L.LatLngExpression = locations.length > 0
    ? [
        locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length,
        locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length,
      ]
    : [40.0, -95.0]

  // Calculate max revenue for color scaling
  const maxRevenue = Math.max(...locations.map(loc => loc.revenue), 1)

  return (
    <MapContainer
      center={center}
      zoom={4}
      style={{ width: '100%', height: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <FitBoundsComponent locations={locations} />

      {locations.map((location, idx) => (
        <Marker
          key={`loc-${idx}`}
          position={[location.latitude, location.longitude]}
          icon={createCustomIcon(location.revenue, maxRevenue)}
          eventHandlers={{
            click: () => onSelectLocation?.(location.location),
          }}
        >
          <Popup>
            <div style={{ fontSize: '12px', fontWeight: '500', minWidth: '180px' }}>
              <div style={{ marginBottom: '6px' }}>
                <strong style={{ fontSize: '13px', color: '#111' }}>{location.location}</strong>
              </div>
              <div style={{ color: '#555', marginBottom: '4px' }}>
                Revenue: <span style={{ fontWeight: '600', color: '#333' }}>{compactCurrency(location.revenue)}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>
                Coordinates: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
