/**
 * TestFeature Component
 *
 * A simple test component to demonstrate feature flags in action.
 * This component is behind the FLOOR_PLAN feature flag.
 */

export function TestFeature() {
  return (
    <div className="mt-4 rounded-lg border-2 border-green-500/30 bg-green-50 p-4 dark:bg-green-900/20">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">✨</span>
        <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
          Feature Flag Test - SUCCESS!
        </h3>
      </div>
      <p className="text-sm text-green-700 dark:text-green-300">
        If you can see this, the <code className="font-mono">FLOOR_PLAN</code> feature flag is
        enabled!
      </p>
      <p className="mt-2 text-sm text-green-700 dark:text-green-300">
        Try toggling it off in the Debug Panel below to see this component disappear.
      </p>
    </div>
  );
}
