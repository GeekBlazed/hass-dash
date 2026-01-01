import { useState } from 'react';
import { QuickActions } from './QuickActions';
import { RoomCard, type RoomData } from './RoomCard';
import { WeatherDisplay } from './WeatherDisplay';

function HomeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 68 52" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10,26 L34,10 L58,26" />
      <rect x="18" y="26" width="32" height="26" rx="2" />
      <rect x="30" y="34" width="8" height="10" rx="1" />
    </svg>
  );
}

const initialRooms: RoomData[] = [
  { id: 'living', name: 'Living Room', temperature: 20.1 },
  { id: 'kitchen', name: 'Kitchen', temperature: 17.7 },
  { id: 'bedroom', name: 'Bedroom', temperature: 22.9 },
  { id: 'office', name: 'Office', status: 'on' },
  { id: 'bathroom', name: 'Bathroom', status: 'off' },
  { id: 'garage', name: 'Garage', status: 'dim' },
];

export function Dashboard() {
  const [rooms, setRooms] = useState<RoomData[]>(initialRooms);
  const [, setActiveAction] = useState<string>('warm');

  const handleRoomClick = (room: RoomData) => {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== room.id) return r;
        // Toggle status
        if (r.status) {
          const nextStatus = r.status === 'off' ? 'on' : r.status === 'on' ? 'dim' : 'off';
          return { ...r, status: nextStatus };
        }
        return r;
      })
    );
  };

  const handleAction = (actionId: string) => {
    setActiveAction(actionId);
    // Apply action to all rooms
    if (actionId === 'all-off') {
      setRooms((prev) =>
        prev.map((r) => (r.status ? { ...r, status: 'off' as const } : r))
      );
    } else if (actionId === 'bright') {
      setRooms((prev) =>
        prev.map((r) => (r.status ? { ...r, status: 'on' as const } : r))
      );
    }
  };

  return (
    <div className="min-h-screen bg-warm-gradient">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        {/* Left Sidebar */}
        <aside className="flex w-72 flex-col px-8 py-10">
          {/* Logo / Home */}
          <div className="mb-8 flex items-center gap-4">
            <div className="text-text-primary">
              <HomeIcon />
            </div>
            <h1 className="text-2xl font-semibold text-text-primary">Home</h1>
          </div>

          {/* Divider */}
          <div className="mb-6 h-px bg-panel-border" />

          {/* Quick Actions */}
          <QuickActions onAction={handleAction} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Bottom info */}
          <div className="space-y-2 text-sm text-text-muted">
            <div>Sat, Dec 31</div>
            <div>HassDash v0.1.0</div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex flex-1 flex-col px-8 py-10">
          {/* Header with Weather */}
          <div className="mb-8 flex items-start justify-between">
            <div>
              <h2 className="text-lg text-text-secondary">Welcome back</h2>
              <p className="mt-1 text-2xl font-semibold text-text-primary">
                Your home at a glance
              </p>
            </div>
            <WeatherDisplay
              temperature={4.8}
              condition="Breezy and foggy"
              humidity={47}
            />
          </div>

          {/* Divider */}
          <div className="mb-8 h-px bg-panel-border" />

          {/* Room Grid */}
          <div className="grid flex-1 grid-cols-3 gap-4">
            {rooms.map((room) => (
              <RoomCard key={room.id} room={room} onClick={handleRoomClick} />
            ))}
          </div>

          {/* Bottom Stats */}
          <div className="mt-8 flex items-center justify-between text-sm text-text-muted">
            <span>6 rooms</span>
            <span>•</span>
            <span>12 devices</span>
            <span>•</span>
            <span>3 active</span>
            <span>•</span>
            <span>Last updated: just now</span>
          </div>
        </main>
      </div>
    </div>
  );
}
