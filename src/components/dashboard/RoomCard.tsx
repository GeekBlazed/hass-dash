import { useState } from 'react';

export interface RoomData {
  id: string;
  name: string;
  temperature?: number;
  status?: 'on' | 'off' | 'dim';
  lights?: boolean;
  icon?: string;
}

interface RoomCardProps {
  room: RoomData;
  onClick?: (room: RoomData) => void;
}

export function RoomCard({ room, onClick }: RoomCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const getStatusText = () => {
    if (room.temperature !== undefined) {
      return `${room.temperature.toFixed(1)}°C`;
    }
    if (room.status) {
      return room.status === 'on' ? 'ON' : room.status === 'off' ? 'OFF' : 'Dim';
    }
    if (room.lights !== undefined) {
      return room.lights ? 'ON' : 'OFF';
    }
    return '';
  };

  return (
    <button
      onClick={() => onClick?.(room)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex h-40 w-full flex-col rounded-xl
        border border-panel-border bg-panel-surface
        p-4 text-left transition-all duration-200
        hover:border-panel-border-light hover:bg-panel-card
        focus:outline-none focus:ring-2 focus:ring-accent/50
        ${isHovered ? 'scale-[1.02]' : ''}
      `}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-accent" />
        <span className="text-base text-text-secondary">{getStatusText()}</span>
      </div>

      {/* Room name at bottom */}
      <div className="mt-auto">
        <span className="text-lg font-medium text-text-primary">{room.name}</span>
      </div>

      {/* Subtle glow effect on hover */}
      {isHovered && (
        <div className="absolute inset-0 -z-10 rounded-xl bg-accent/5 blur-xl" />
      )}
    </button>
  );
}
