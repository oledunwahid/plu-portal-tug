export default function StatCardSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem', marginBottom: '1.25rem' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '1.25rem 1.5rem' }}>
          <div className="skeleton" style={{ height: '10px', width: '60px', marginBottom: '0.625rem' }} />
          <div className="skeleton" style={{ height: '28px', width: '48px', marginBottom: '0.375rem' }} />
          <div className="skeleton" style={{ height: '10px', width: '80px' }} />
        </div>
      ))}
    </div>
  );
}
