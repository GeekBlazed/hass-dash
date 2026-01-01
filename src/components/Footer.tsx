import { container } from '../core/di-container';
import { TYPES } from '../core/types';
import type { IConfigService } from '../interfaces/IConfigService';

/**
 * Application footer with version info and links
 * Minimal, unobtrusive design
 */
export function Footer(): React.ReactElement {
  const configService = container.get<IConfigService>(TYPES.IConfigService);
  const version = configService.getAppVersion();

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
      {/* Left: Version */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        <span className="font-semibold">HassDash</span> v{version}
      </div>

      {/* Center/Right: Links */}
      <div className="flex items-center gap-4">
        <a
          href="https://github.com/GeekBlazed/hass-dash"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded text-sm font-medium"
        >
          GitHub
        </a>
        <span className="text-gray-300 dark:text-gray-600">•</span>
        <a
          href="https://github.com/GeekBlazed/hass-dash/blob/main/README.md"
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary-dark transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded text-sm font-medium"
        >
          Documentation
        </a>
        <span className="text-gray-300 dark:text-gray-600">•</span>
        <a
          href="https://github.com/GeekBlazed/hass-dash/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          MIT License
        </a>
      </div>
    </div>
  );
}
