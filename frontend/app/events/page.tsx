'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import EventCard from '@/components/events/EventCard';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/events')
      .then((res) => setEvents(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="evp-root">
      <div className="evp-header">
        <h1 className="evp-title">Tất cả sự kiện</h1>
        <p className="evp-subtitle">Khám phá các sự kiện đang mở bán</p>
      </div>

      {loading && (
        <div className="edp-loading">
          <div className="edp-spinner" />
          <span>Đang tải...</span>
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="evp-empty">Chưa có sự kiện nào.</p>
      )}

      {!loading && events.length > 0 && (
        <div className="evp-grid">
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
