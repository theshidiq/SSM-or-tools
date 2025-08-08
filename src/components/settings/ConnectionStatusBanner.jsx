import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, RefreshCcw } from 'lucide-react';

const ConnectionStatusBanner = ({ connectionStatus, onRetryConnection, isRetrying = false }) => {
  if (!connectionStatus) return null;

  const { database, configuration } = connectionStatus;

  // All good - don't show banner
  if (database && configuration) {
    return null;
  }

  // Determine banner type and message
  let bannerType = 'error';
  let icon = AlertTriangle;
  let title = 'Connection Issues';
  let message = '';
  let actionText = 'Retry Connection';

  if (!database) {
    bannerType = 'error';
    icon = AlertTriangle;
    title = 'Database Not Connected';
    message = 'Unable to connect to the database. Settings will use local storage as fallback.';
  } else if (!configuration) {
    bannerType = 'warning';
    icon = AlertCircle;
    title = 'Configuration Tables Unavailable';
    message = 'Database is connected but configuration tables are not accessible. Settings will be saved locally.';
  }

  const bannerClasses = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
  };

  const iconClasses = {
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
  };

  const buttonClasses = {
    error: 'bg-red-100 hover:bg-red-200 text-red-800',
    warning: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800',
    info: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
  };

  const IconComponent = icon;

  return (
    <div className={`mx-6 mt-4 p-4 rounded-lg border flex items-start gap-3 ${bannerClasses[bannerType]}`}>
      <IconComponent size={20} className={`flex-shrink-0 mt-0.5 ${iconClasses[bannerType]}`} />
      <div className="flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm mt-1 opacity-90">{message}</p>
        {bannerType === 'warning' && (
          <p className="text-xs mt-2 opacity-75">
            Your settings will still be saved and work normally, but may not be synchronized across devices until database access is restored.
          </p>
        )}
      </div>
      {onRetryConnection && (
        <button
          onClick={onRetryConnection}
          disabled={isRetrying}
          className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${buttonClasses[bannerType]}`}
        >
          <RefreshCcw size={14} className={`mr-1.5 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : actionText}
        </button>
      )}
    </div>
  );
};

export default ConnectionStatusBanner;