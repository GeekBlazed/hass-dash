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
      className={`border-panel-border bg-panel-surface hover:border-panel-border-light hover:bg-panel-card focus:ring-accent/50 relative flex h-40 w-full flex-col rounded-xl border p-4 text-left transition-all duration-200 focus:ring-2 focus:outline-none ${isHovered ? 'scale-[1.02]' : ''} `}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-3">
        <div className="bg-accent h-3 w-3 rounded-full" />
        <span className="text-text-secondary text-base">{getStatusText()}</span>
      </div>

      {/* Room name at bottom */}
      <div className="mt-auto">
        <span className="text-text-primary text-lg font-medium">{room.name}</span>
      </div>

      {/* Subtle glow effect on hover */}
      {isHovered && <div className="bg-accent/5 absolute inset-0 -z-10 rounded-xl blur-xl" />}
    </button>
  );
}
