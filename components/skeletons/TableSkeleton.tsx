export default function TableSkeleton({ rows = 6, cols = 7 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}>
                <div className="skeleton" style={{ height: '12px', width: i === 0 ? '80px' : i === cols - 1 ? '40px' : '100px' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, ri) => (
            <tr key={ri}>
              {Array.from({ length: cols }).map((_, ci) => (
                <td key={ci}>
                  <div className="skeleton" style={{ height: '14px', width: ci === cols - 1 ? '32px' : ci === 0 ? '70px' : `${60 + Math.sin(ri * cols + ci) * 30}px` }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
