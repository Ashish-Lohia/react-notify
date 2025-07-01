import { useState, useEffect, useCallback } from "react";
import { Bell, BellRing, User, LogOut, X } from "lucide-react";
import logo from "./assets/notification.png";
import { LoginForm } from "./pages/Login";
import { NotificationItem } from "./components/notificationItem";

const API_BASE_URL = "http://localhost:8000";
const WS_BASE_URL = "ws://localhost:8000";
const TOKEN_KEY = "notification_app_token";

// Auth token management using localStorage
const getAuthToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error("Error accessing localStorage:", error);
    return null;
  }
};

const setAuthToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error("Error setting token in localStorage:", error);
  }
};

const removeAuthToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error("Error removing token from localStorage:", error);
  }
};

// API functions
const api = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}/api/user/login/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Login failed");
    }

    const data = await response.json();
    console.log("Login response:", data);
    setAuthToken(data.access_token);
    return data;
  },

  getProfile: async () => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/user/profile/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch profile");
    }

    return await response.json();
  },

  getNotifications: async () => {
    const token = getAuthToken();
    const response = await fetch(`${API_BASE_URL}/api/notifications/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch notifications");
    }

    return await response.json();
  },

  markNotificationAsRead: async (notificationId) => {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/notifications/${notificationId}/read/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to mark notification as read");
    }

    return await response.json();
  },

  deleteNotification: async (notificationId) => {
    const token = getAuthToken();
    const response = await fetch(
      `${API_BASE_URL}/api/notifications/${notificationId}/`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to delete notification");
    }
  },
};

// WebSocket hook
const useWebSocket = (userId, onMessage) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const token = getAuthToken();
    if (!token) {
      setConnectionError("No authentication token");
      return;
    }

    // Create WebSocket connection with token in URL or headers
    const wsUrl = `${WS_BASE_URL}/ws/notifications/?token=${token}`;
    console.log("Connecting to WebSocket:", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("WebSocket connected");
      setIsConnected(true);
      setConnectionError(null);
      setSocket(ws);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);

        // Handle different message types based on the fixed structure
        if (data.type === "notification") {
          const notificationData = data.data; // Backend sends data in 'data' field
          onMessage({
            id: notificationData.id || Date.now().toString(),
            title: notificationData.title,
            message: notificationData.message,
            notification_type:
              notificationData.type || notificationData.notification_type,
            data: notificationData.data,
            timestamp: notificationData.created_at || new Date().toISOString(),
            created_at: notificationData.created_at || new Date().toISOString(),
            read: false,
            is_read: false,
          });
        } else if (data.type === "unread_count") {
          console.log("Unread count:", data.count);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
      setIsConnected(false);
      setSocket(null);

      // Attempt to reconnect after 5 seconds for non-normal closures
      if (event.code !== 1000) {
        setTimeout(() => {
          console.log("Attempting to reconnect...");
          // The useEffect will handle reconnection when dependencies change
        }, 5000);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setConnectionError("Connection failed");
      setIsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1000, "Component unmounting");
      }
    };
  }, [userId, onMessage]);

  const sendMessage = useCallback(
    (message) => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    },
    [socket]
  );

  return { isConnected, connectionError, socket, sendMessage };
};

export const NotificationApp = () => {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true); // Start with loading true
  const [showNotifications, setShowNotifications] = useState(false);
  const [error, setError] = useState(null);

  // Check for existing auth token on mount
  useEffect(() => {
    const initializeApp = async () => {
      const token = getAuthToken();
      if (token) {
        try {
          await loadUserProfile();
        } catch (error) {
          console.error("Failed to load user data on mount:", error);
          // If token is invalid, remove it and show login
          removeAuthToken();
          setUser(null);
        }
      }
      setLoading(false);
    };

    initializeApp();
  }, []);

  // Load user profile
  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const profileData = await api.getProfile();
      setUser(profileData);

      // Load existing notifications
      const notificationsData = await api.getNotifications();
      const notificationsList = Array.isArray(notificationsData.notifications)
        ? notificationsData.notifications
        : Array.isArray(notificationsData)
        ? notificationsData
        : [];

      setNotifications(notificationsList);
      setError(null);
    } catch (error) {
      console.error("Failed to load profile:", error);
      setError("Failed to load user data");
      removeAuthToken();
      setUser(null);
      throw error; // Re-throw to handle in calling function
    } finally {
      setLoading(false);
    }
  };

  // Handle new WebSocket messages
  const handleNewNotification = useCallback((notification) => {
    console.log("Adding new notification to state:", notification);
    setNotifications((prev) => {
      // Check if notification already exists to prevent duplicates
      const exists = prev.some((n) => n.id === notification.id);
      if (exists) {
        return prev;
      }
      return [notification, ...prev];
    });

    // Show browser notification if permission is granted
    if (Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.message,
        icon: logo,
      });
    }
  }, []);

  // WebSocket connection
  const { isConnected, connectionError, sendMessage } = useWebSocket(
    user?.id,
    handleNewNotification
  );

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Login handler
  const handleLogin = async (email, password) => {
    setLoading(true);
    setError(null);
    try {
      await api.login(email, password);

      // Get user profile after login
      const profileData = await api.getProfile();
      setUser(profileData);

      // Load existing notifications
      const notificationsData = await api.getNotifications();
      const notificationsList = Array.isArray(notificationsData.notifications)
        ? notificationsData.notifications
        : Array.isArray(notificationsData)
        ? notificationsData
        : [];

      setNotifications(notificationsList);
    } catch (error) {
      console.error("Login failed:", error);
      setError(error.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    removeAuthToken();
    setUser(null);
    setNotifications([]);
    setShowNotifications(false);
    setError(null);
  };

  // Mark notification as read
  const markAsRead = async (notificationId) => {
    try {
      await api.markNotificationAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId
            ? { ...notif, read: true, is_read: true }
            : notif
        )
      );

      // Optionally send WebSocket message to backend
      if (sendMessage) {
        sendMessage({
          type: "mark_read",
          notification_id: notificationId,
        });
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await api.deleteNotification(notificationId);
      setNotifications((prev) =>
        prev.filter((notif) => notif.id !== notificationId)
      );
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    const unreadNotifications = notifications.filter(
      (n) => !n.read && !n.is_read
    );

    try {
      // Mark all unread notifications as read
      await Promise.all(
        unreadNotifications.map((notification) =>
          api.markNotificationAsRead(notification.id)
        )
      );

      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, read: true, is_read: true }))
      );
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read && !n.read).length;

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm onLogin={handleLogin} loading={loading} error={error} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Bell className="w-8 h-8 text-blue-500" />
              <h1 className="text-xl font-semibold text-gray-900">
                Notification Center
              </h1>
              <div className="flex items-center space-x-2">
                {isConnected ? (
                  <div className="flex items-center space-x-2 text-sm text-green-600">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span>Connected</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-2 text-sm text-red-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    <span>Disconnected</span>
                    {connectionError && (
                      <span className="text-xs">({connectionError})</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {/* Notification Bell */}
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
              >
                {unreadCount > 0 ? (
                  <BellRing className="w-6 h-6 text-blue-500" />
                ) : (
                  <Bell className="w-6 h-6" />
                )}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">
                    {user.fullname || user.full_name || user.name || user.email}
                  </span>
                  {(user.role || user.user_type) && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      {user.role || user.user_type}
                    </span>
                  )}
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Your Notifications ({notifications.length})
          </h2>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
            >
              Mark all as read ({unreadCount})
            </button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No notifications yet
            </h3>
            <p className="text-gray-600">
              You'll see your notifications here when they arrive.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Demo notifications will appear automatically!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </main>

      {/* Notification Toast */}
      {showNotifications && notifications.length > 0 && (
        <div className="fixed top-20 right-4 w-80 bg-white rounded-lg shadow-lg border z-50 max-h-96 overflow-y-auto">
          <div className="p-4 border-b">
            <div className="flex justify-between items-center">
              <h3 className="font-medium text-gray-900">
                Recent Notifications ({notifications.slice(0, 5).length})
              </h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className="p-3 border-b last:border-b-0 hover:bg-gray-50"
              >
                <div className="flex items-start space-x-2">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {notification.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(
                        notification.timestamp || notification.created_at
                      ).toLocaleString()}
                    </p>
                  </div>
                  {!(notification.is_read || notification.read) && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationApp;
