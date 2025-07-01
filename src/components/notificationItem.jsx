import { Bell, ShoppingCart, Package, CheckCircle, X } from "lucide-react";

export const NotificationItem = ({ notification, onMarkAsRead, onDelete }) => {
  // console.log(notification);
  const getIcon = (type) => {
    switch (type) {
      case "order_new":
        return <ShoppingCart className="w-5 h-5 text-green-500" />;
      case "order_update":
        return <Package className="w-5 h-5 text-blue-500" />;
      case "payment_success":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;

    return date.toLocaleDateString();
  };

  return (
    <div
      className={`p-4 border rounded-lg ${
        notification.is_read ? "bg-gray-50" : "bg-blue-50 border-blue-200"
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {getIcon(notification.notification_type)}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h4
                className={`text-sm font-medium ${
                  !notification.is_read ? "text-gray-900" : "text-gray-600"
                }`}
              >
                {notification.title}
              </h4>
              {!notification.is_read && (
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
            <p className="text-xs text-gray-400 mt-2">
              {formatTime(notification.created_at)}
            </p>
          </div>
        </div>
        <div className="flex space-x-2 ml-2">
          {!notification.is_read && (
            <button
              onClick={() => onMarkAsRead(notification.id)}
              className="text-blue-500 hover:text-blue-700 text-xs"
            >
              Mark as read
            </button>
          )}
          <button
            onClick={() => onDelete(notification.id)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
