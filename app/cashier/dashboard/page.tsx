import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import StatusBadge from '@/components/StatusBadge';
import Link from 'next/link';
import { formatDate, formatPrice } from '@/lib/utils';
import { PlusCircle } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  NEW_ITEM: 'New Item',
  UPDATE_PRICE: 'Update Price',
  UPDATE_NAME: 'Update Name',
  UPDATE_PRINTER: 'Change Printer',
  UPDATE_FULL: 'Full Update',
};

export default async function CashierDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const requests = await prisma.pLURequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.75rem' }}>
        <div>
          <h1 className="page-title">My Requests</h1>
          <p style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {requests.length} total submission{requests.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/cashier/request/new"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--bg-dark)',
            color: 'var(--accent-gold)',
            padding: '0.5rem 1.125rem',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            transition: 'all 200ms ease',
          }}
        >
          <PlusCircle size={15} />
          New Request
        </Link>
      </div>

      {requests.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: '0.5rem',
            padding: '3rem',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            You haven't submitted any requests yet.
          </p>
          <Link
            href="/cashier/request/new"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-dark)',
              color: 'var(--accent-gold)',
              padding: '0.5rem 1.125rem',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            <PlusCircle size={15} />
            Submit your first request
          </Link>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Item Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => (
                  <tr key={req.id}>
                    <td style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {formatDate(req.createdAt)}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-secondary)',
                          background: 'var(--bg-cream)',
                          border: '1px solid var(--border)',
                          padding: '0.15rem 0.5rem',
                          borderRadius: '0.25rem',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {TYPE_LABELS[req.requestType] ?? req.requestType}
                      </span>
                    </td>
                    <td style={{ fontWeight: 500 }}>{req.name}</td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{req.category}</td>
                    <td style={{ fontSize: '0.8rem' }}>{req.price ? formatPrice(req.price) : '—'}</td>
                    <td>
                      <StatusBadge status={req.status} />
                    </td>
                    <td
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--text-secondary)',
                        maxWidth: '200px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {req.adminNote ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
