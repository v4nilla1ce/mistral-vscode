type ConnectionState = "connected" | "disconnected" | "connecting" | "reconnecting" | "error";

interface ConnectionStatusProps {
  state: ConnectionState;
}

function ConnectionStatus({ state }: ConnectionStatusProps) {
  const getStatusText = () => {
    switch (state) {
      case "connected":
        return "Connected";
      case "disconnected":
        return "Disconnected";
      case "connecting":
        return "Connecting...";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return "Connection Error";
      default:
        return "Unknown";
    }
  };

  const getDotClass = () => {
    switch (state) {
      case "connected":
        return "connected";
      case "disconnected":
      case "error":
        return "disconnected";
      case "connecting":
      case "reconnecting":
        return "connecting";
      default:
        return "";
    }
  };

  // Don't show status bar when connected
  if (state === "connected") {
    return null;
  }

  return (
    <div className="connection-status">
      <span className={`connection-dot ${getDotClass()}`} />
      <span>{getStatusText()}</span>
    </div>
  );
}

export default ConnectionStatus;
