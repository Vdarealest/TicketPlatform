'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import EventCard from '@/components/events/EventCard';

interface Filters {
  search: string;
  category: string;
  location: string;
  dateFrom: string;
  dateTo: string;
  minPrice: string;
  maxPrice: string;
  sort: string;
}

const EMPTY_FILTERS: Filters = {
  search: '',
  category: '',
  location: '',
  dateFrom: '',
  dateTo: '',
  minPrice: '',
  maxPrice: '',
  sort: 'soonest',
};

const SORT_OPTIONS = [
  { value: 'soonest', label: 'Sắp diễn ra' },
  { value: 'latest', label: 'Mới nhất' },
  { value: 'priceAsc', label: 'Giá thấp → cao' },
  { value: 'priceDesc', label: 'Giá cao → thấp' },
];

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 42,
  padding: '0 12px',
  borderRadius: 10,
  border: '1.5px solid #E5E7EA',
  background: '#fff',
  fontSize: 14,
  fontWeight: 500,
  color: '#24292E',
  outline: 'none',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: '#6b7280',
  marginBottom: 6,
  display: 'block',
};

export default function EventsPage() {
  const searchParams = useSearchParams();
  const [events, setEvents] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(() => ({
    ...EMPTY_FILTERS,
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
  }));
  const [showAdvanced, setShowAdvanced] = useState(
    !!(searchParams.get('category')),
  );

  // Đồng bộ khi điều hướng từ navbar (URL ?search=... đổi trong khi trang đã mở)
  useEffect(() => {
    const s = searchParams.get('search') || '';
    setFilters((f) => (f.search === s ? f : { ...f, search: s }));
  }, [searchParams]);

  // Lấy danh sách thể loại một lần
  useEffect(() => {
    api.get('/events/categories').then((res) => setCategories(res.data)).catch(() => {});
  }, []);

  // Debounce filters → gọi API
  useEffect(() => {
    const handler = setTimeout(() => {
      const params: Record<string, string> = {};
      if (filters.search.trim()) params.search = filters.search.trim();
      if (filters.category) params.category = filters.category;
      if (filters.location.trim()) params.location = filters.location.trim();
      if (filters.dateFrom) params.dateFrom = filters.dateFrom;
      if (filters.dateTo) params.dateTo = filters.dateTo;
      if (filters.minPrice) params.minPrice = filters.minPrice;
      if (filters.maxPrice) params.maxPrice = filters.maxPrice;
      if (filters.sort) params.sort = filters.sort;

      setLoading(true);
      api
        .get('/events', { params })
        .then((res) => setEvents(res.data))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, 350);

    return () => clearTimeout(handler);
  }, [filters]);

  const set = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const activeCount = useMemo(() => {
    let n = 0;
    if (filters.category) n++;
    if (filters.location.trim()) n++;
    if (filters.dateFrom) n++;
    if (filters.dateTo) n++;
    if (filters.minPrice) n++;
    if (filters.maxPrice) n++;
    return n;
  }, [filters]);

  const hasAnyFilter =
    activeCount > 0 || filters.search.trim() !== '' || filters.sort !== 'soonest';

  return (
    <main className="evp-root">
      <div className="evp-header">
        <h1 className="evp-title">Tất cả sự kiện</h1>
        <p className="evp-subtitle">Khám phá các sự kiện đang mở bán</p>
      </div>

      {/* ── Thanh tìm kiếm & lọc ── */}
      <div
        style={{
          background: '#fff',
          border: '1px solid #EEF0F2',
          borderRadius: 16,
          padding: 16,
          boxShadow: 'rgba(0,0,0,0.04) 0px 4px 16px 0px',
          marginBottom: 28,
        }}
      >
        {/* Hàng trên: search + sort + nút lọc */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 280px', minWidth: 220 }}>
            <svg
              width="16" height="16" viewBox="0 0 16 16" fill="none"
              style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="7" cy="7" r="5" stroke="#9EA5AD" strokeWidth="1.6" />
              <path d="M11 11l3 3" stroke="#9EA5AD" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Tìm sự kiện theo tên..."
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </div>

          <select
            value={filters.sort}
            onChange={(e) => set('sort', e.target.value)}
            style={{ ...inputStyle, width: 'auto', minWidth: 150, flex: '0 0 auto', cursor: 'pointer' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            style={{
              height: 42, padding: '0 16px', borderRadius: 10, cursor: 'pointer',
              border: showAdvanced || activeCount > 0 ? '1.5px solid #0F35FF' : '1.5px solid #E5E7EA',
              background: showAdvanced || activeCount > 0 ? '#EEF2FF' : '#fff',
              color: showAdvanced || activeCount > 0 ? '#0F35FF' : '#24292E',
              fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8,
              flex: '0 0 auto', fontFamily: 'inherit',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            Bộ lọc
            {activeCount > 0 && (
              <span style={{
                background: '#0F35FF', color: '#fff', fontSize: 11, fontWeight: 700,
                minWidth: 18, height: 18, borderRadius: 9, display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 5px',
              }}>{activeCount}</span>
            )}
          </button>
        </div>

        {/* Hàng dưới: bộ lọc nâng cao */}
        {showAdvanced && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 12, marginTop: 16, paddingTop: 16, borderTop: '1px solid #F0F2F5',
          }}>
            <div>
              <label style={labelStyle}>Thể loại</label>
              <select
                value={filters.category}
                onChange={(e) => set('category', e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">Tất cả</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>Địa điểm</label>
              <input
                type="text"
                placeholder="VD: Hà Nội"
                value={filters.location}
                onChange={(e) => set('location', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Từ ngày</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => set('dateFrom', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Đến ngày</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => set('dateTo', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Giá từ (VND)</label>
              <input
                type="number"
                placeholder="0"
                min={0}
                value={filters.minPrice}
                onChange={(e) => set('minPrice', e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Giá đến (VND)</label>
              <input
                type="number"
                placeholder="Không giới hạn"
                min={0}
                value={filters.maxPrice}
                onChange={(e) => set('maxPrice', e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        )}

        {hasAnyFilter && (
          <div style={{ marginTop: showAdvanced ? 14 : 12, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#CD3636', fontSize: 13, fontWeight: 600, padding: 0,
                display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="edp-loading">
          <div className="edp-spinner" />
          <span>Đang tải...</span>
        </div>
      )}

      {!loading && (
        <p style={{ fontSize: 13, color: '#9EA5AD', marginBottom: 16, fontWeight: 500 }}>
          {events.length > 0
            ? `Tìm thấy ${events.length} sự kiện`
            : ''}
        </p>
      )}

      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className="evp-empty" style={{ marginBottom: 8 }}>
            {hasAnyFilter
              ? 'Không tìm thấy sự kiện phù hợp.'
              : 'Chưa có sự kiện nào.'}
          </p>
          {hasAnyFilter && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{
                marginTop: 6, padding: '8px 18px', borderRadius: 10, cursor: 'pointer',
                border: '1.5px solid #E5E7EA', background: '#fff', color: '#24292E',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              Xóa bộ lọc
            </button>
          )}
        </div>
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
