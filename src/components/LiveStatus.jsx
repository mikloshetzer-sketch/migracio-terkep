import React, { useEffect, useState } from "react";

function LiveStatus() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}last-update.json`)
      .then((response) => response.json())
      .then(setData)
      .catch(() => {
        setData({
          status: "offline",
          source: "unknown",
          event_count: 0,
          updated_at: null
        });
      });
  }, []);

  if (!data) return null;

  return (
    <div className="live-status-panel">
      <span className={`live-dot ${data.status}`}></span>
      <strong>{data.status}</strong>
      <small>{data.source}</small>
      <small>{data.event_count} live events</small>
    </div>
  );
}

export default LiveStatus;
