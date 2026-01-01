export function DemoStats() {
  const stats = [
    {
      label: 'Devices Online',
      value: '24',
      icon: '🔌',
      color: 'text-green-600 dark:text-green-400',
    },
    {
      label: 'Active Lights',
      value: '8',
      icon: '💡',
      color: 'text-yellow-600 dark:text-yellow-400',
    },
    {
      label: 'Avg Temperature',
      value: '70°F',
      icon: '🌡️',
      color: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Energy Usage',
      value: '2.4 kW',
      icon: '⚡',
      color: 'text-purple-600 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
              <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
            <div className="text-4xl opacity-50">{stat.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
