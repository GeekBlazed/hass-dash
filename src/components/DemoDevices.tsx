import { useState } from 'react';

interface Device {
  id: string;
  name: string;
  icon: string;
  room: string;
  status: boolean;
  type: 'light' | 'switch' | 'sensor';
}

export function DemoDevices() {
  const [devices, setDevices] = useState<Device[]>([
    {
      id: '1',
      name: 'Living Room Lamp',
      icon: '💡',
      room: 'Living Room',
      status: true,
      type: 'light',
    },
    {
      id: '2',
      name: 'Kitchen Overhead',
      icon: '💡',
      room: 'Kitchen',
      status: false,
      type: 'light',
    },
    { id: '3', name: 'Bedroom Light', icon: '💡', room: 'Bedroom', status: false, type: 'light' },
    { id: '4', name: 'Office Desk Lamp', icon: '💡', room: 'Office', status: true, type: 'light' },
    { id: '5', name: 'Smart Plug', icon: '🔌', room: 'Living Room', status: true, type: 'switch' },
    { id: '6', name: 'Motion Sensor', icon: '👁️', room: 'Hallway', status: true, type: 'sensor' },
  ]);

  const toggleDevice = (id: string) => {
    setDevices((prev) =>
      prev.map((device) =>
        device.id === id && device.type !== 'sensor'
          ? { ...device, status: !device.status }
          : device
      )
    );
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg dark:border-gray-700 dark:bg-gray-800">
      <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">Device Controls</h3>
      <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
        Interactive demo - toggle lights and switches
      </p>

      <div className="space-y-3">
        {devices.map((device) => (
          <div
            key={device.id}
            className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-900"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{device.icon}</span>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{device.room}</p>
              </div>
            </div>

            {device.type === 'sensor' ? (
              <span className="text-sm font-medium text-green-600 dark:text-green-400">Active</span>
            ) : (
              <button
                onClick={() => toggleDevice(device.id)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  device.status
                    ? 'bg-primary hover:bg-primary-dark dark:bg-primary-light text-white'
                    : 'bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100'
                }`}
              >
                {device.status ? 'ON' : 'OFF'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
