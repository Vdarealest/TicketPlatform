'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import SeatDesigner, { DesignerLayout, DesignerSection, DesignerStage } from '@/components/admin/SeatDesigner';

interface TicketInfo { id: number; type: string; price: number; quantity: number; }

export default function SeatDesignerPage() {
  const params = useParams();
  const eventId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [eventTitle, setEventTitle] = useState('');
  const [venueName, setVenueName] = useState<string | null>(null);
  const [initialSections, setInitialSections] = useState<DesignerSection[]>([]);
  const [initialStage, setInitialStage] = useState<DesignerStage | null>(null);

  useEffect(() => {
    Promise.all([
      api.get(`/admin/events/${eventId}/seat-layout`),
      api.get(`/admin/events/${eventId}`),
    ]).then(([lr, er]) => {
      setTickets(lr.data.tickets || []);
      setEventTitle(er.data.title || '');
      setVenueName(lr.data.venueName || null);
      const layout = lr.data.layout;
      if (layout?.sections?.length) setInitialSections(layout.sections);
      if (layout?.stage) setInitialStage(layout.stage);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [eventId]);

  const saveLayout = async (layout: DesignerLayout) => {
    await api.put(`/admin/events/${eventId}/seat-layout`, layout);
  };

  if (loading) return <div className="adm-loading"><div className="edp-spinner" /><span>Đang tải...</span></div>;

  return (
    <SeatDesigner
      title={`Sơ đồ ghế — ${eventTitle}`}
      subtitle={venueName}
      initialSections={initialSections}
      initialStage={initialStage}
      tickets={tickets}
      emptyHint='Nhấn "+ Thêm khu" để tạo khu ghế, hoặc nhấn vào khu / sân khấu trên canvas để chỉnh sửa. Khi xong, nhấn "Tạo ghế" để sinh ghế cho khách đặt.'
      onSave={saveLayout}
      secondaryAction={{
        label: 'Tạo ghế',
        busyLabel: 'Đang tạo...',
        run: async (layout) => {
          // Save first so generation always uses what's on screen
          await saveLayout(layout);
          const res = await api.post(`/admin/events/${eventId}/generate-seats`);
          return res.data.message ?? 'Đã tạo ghế!';
        },
      }}
    />
  );
}
