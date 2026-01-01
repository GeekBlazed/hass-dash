import { useState } from 'react';

interface Room {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  temp: number;
  lights: boolean;
}

export function DemoFloorPlan() {
  const [rooms, setRooms] = useState<Room[]>([
    { id: '1', name: 'Living Room', x: 20, y: 20, width: 200, height: 150, temp: 72, lights: true },
    { id: '2', name: 'Kitchen', x: 240, y: 20, width: 150, height: 150, temp: 70, lights: false },
    { id: '3', name: 'Bedroom', x: 20, y: 190, width: 150, height: 120, temp: 68, lights: false },
    { id: '4', name: 'Office', x: 240, y: 190, width: 150, height: 120, temp: 71, lights: true },
  ]);

  const toggleLights = (roomId: string) => {
    setRooms((prev) =>
      prev.map((room) => (room.id === roomId ? { ...room, lights: !room.lights } : room))
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
        Floor Plan Preview
      </h3>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Interactive demo - click rooms to toggle lights
      </p>

      {/* SVG Floor Plan */}
      <svg
        viewBox="0 0 410 330"
        className="mx-auto w-full max-w-2xl rounded-lg border border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900"
      >
        {/* Rooms */}
        {rooms.map((room) => (
          <g key={room.id} onClick={() => toggleLights(room.id)} className="cursor-pointer">
            {/* Room background */}
            <rect
              x={room.x}
              y={room.y}
              width={room.width}
              height={room.height}
              fill={room.lights ? '#fef3c7' : '#e5e7eb'}
              stroke="#6b7280"
              strokeWidth="2"
              className="transition-all hover:opacity-80"
            />

            {/* Room name */}
            <text
              x={room.x + room.width / 2}
              y={room.y + 30}
              textAnchor="middle"
              className="fill-gray-900 text-sm font-semibold"
            >
              {room.name}
            </text>

            {/* Temperature */}
            <text
              x={room.x + room.width / 2}
              y={room.y + 60}
              textAnchor="middle"
              className="fill-gray-700 text-xs"
            >
              🌡️ {room.temp}°F
            </text>

            {/* Light status */}
            <text
              x={room.x + room.width / 2}
              y={room.y + 85}
              textAnchor="middle"
              className="text-2xl"
            >
              {room.lights ? '💡' : '🔘'}
            </text>

            <text
              x={room.x + room.width / 2}
              y={room.y + 105}
              textAnchor="middle"
              className="fill-gray-600 text-xs"
            >
              {room.lights ? 'Lights ON' : 'Lights OFF'}
            </text>
          </g>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border-2 border-gray-600 bg-yellow-100"></div>
          <span>Lights On</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded border-2 border-gray-600 bg-gray-200"></div>
          <span>Lights Off</span>
        </div>
        <div className="flex items-center gap-2">
          <span>🌡️</span>
          <span>Temperature</span>
        </div>
      </div>
    </div>
  );
}
