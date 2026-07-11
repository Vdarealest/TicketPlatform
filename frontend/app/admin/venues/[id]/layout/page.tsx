'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import SeatDesigner, { DesignerLayout, DesignerSection, DesignerStage } from '@/components/admin/SeatDesigner';

export default function VenueLayoutPage() {
  const params = useParams();
  const venueId = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [venueName, setVenueName] = useState('');
  const [initialSections, setInitialSections] = useState<DesignerSection[]>([]);
  const [initialStage, setInitialStage] = useState<DesignerStage | null>(null);

  useEffect(() => {
    api.get(`/admin/venues/${venueId}`)
      .then((r) => {
        setVenueName(r.data.name || '');
        const layout = r.data.layout;
        if (layout?.sections?.length) setInitialSections(layout.sections);
        if (layout?.stage) setInitialStage(layout.stage);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [venueId]);

  if (loading) return <div className="adm-loading"><div className="edp-spinner" /><span>Đang tải...</span></div>;

  return (
    <SeatDesigner
      title={`Sơ đồ ghế — ${venueName}`}
      initialSections={initialSections}
      initialStage={initialStage}
      emptyHint="Sơ đồ của địa điểm này sẽ được dùng cho mọi sự kiện tổ chức tại đây. Nhấn '+ Thêm khu' để bắt đầu; loại vé sẽ được gán ở trang sơ đồ ghế của từng sự kiện."
      onSave={async (layout: DesignerLayout) => {
        await api.put(`/admin/venues/${venueId}/layout`, layout);
      }}
    />
  );
}
