import { useState } from 'react';
import { useNavigate } from '../../app/router';
import { Calendar, Receipt } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import { AdminListPage, ListFilterSelect } from '../components/list';
import OrderNumberChip from '../components/OrderNumberChip';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import { useToast } from '../components';
import { PAYMENT_STATUSES } from '../adminConstants';
import { formatPrice } from '../../utils/formatters';

const INITIAL_FILTERS = {
  paymentStatus: '',
  dateFrom: '',
  dateTo: '',
};

function formatDate(value, isAr) {
  if (!value) return '';
  return new Date(value).toLocaleDateString(isAr ? 'ar-EG' : 'en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function InvoicesPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const navigate = useNavigate();
  const [downloadingId, setDownloadingId] = useState(null);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getOrders(params),
    initialFilters: INITIAL_FILTERS,
  });

  const handleDownload = async (order) => {
    setDownloadingId(order._id);
    try {
      const res = await adminApi.downloadInvoice(order._id, isAr ? 'ar' : 'en');
      downloadBlob(res.data, `invoice-${order.orderNumber}.pdf`);
    } catch {
      toast.error(isAr ? 'تعذر تحميل الفاتورة' : 'Could not download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = [
    {
      key: 'orderNumber',
      header: isAr ? 'رقم الفاتورة' : 'Invoice #',
      sortKey: 'orderNumber',
      render: (o) => <OrderNumberChip orderNumber={o.orderNumber} size="sm" short />,
    },
    {
      key: 'date',
      header: isAr ? 'التاريخ' : 'Date',
      sortKey: 'createdAt',
      render: (o) => (
        <div className="flex items-center gap-1.5 text-sm text-text">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden />
          <span dir="ltr">{formatDate(o.createdAt, isAr)}</span>
        </div>
      ),
    },
    {
      key: 'customer',
      header: isAr ? 'العميل' : 'Customer',
      render: (o) => (
        <div className="min-w-[9rem]">
          <p className="truncate text-sm font-semibold text-text">
            {o.user?.name || (isAr ? 'عميل' : 'Customer')}
          </p>
          <p className="mt-0.5 text-xs text-text-muted" dir="ltr">{o.phone}</p>
        </div>
      ),
    },
    {
      key: 'payment',
      header: isAr ? 'الدفع' : 'Payment',
      render: (o) => <PaymentStatusBadge status={o.paymentStatus} language={language} compact variant="subtle" />,
    },
    {
      key: 'total',
      header: isAr ? 'الإجمالي' : 'Total',
      sortKey: 'total',
      render: (o) => <span className="text-sm font-bold tabular-nums text-text">{formatPrice(o.total)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-text-muted">
        {isAr
          ? 'كل فواتير الطلبات في مكان واحد — ابحث برقم الفاتورة أو رقم الهاتف، أو نزّل نسخة PDF لأي طلب.'
          : 'Every order invoice in one place — search by invoice number or phone, or download a PDF copy for any order.'}
      </p>

      <AdminListPage
        isAr={isAr}
        q={list.q}
        onSearchChange={list.setQ}
        searchPlaceholder={isAr ? 'بحث برقم الفاتورة أو الهاتف…' : 'Search invoice number or phone…'}
        sort={list.sort}
        onSort={list.toggleSort}
        filters={(
          <>
            <ListFilterSelect
              label={isAr ? 'الدفع' : 'Payment'}
              value={list.filters.paymentStatus}
              onChange={(v) => list.setFilter('paymentStatus', v)}
              options={[
                { value: '', label: isAr ? 'الكل' : 'All' },
                ...PAYMENT_STATUSES.map((s) => ({ value: s.value, label: isAr ? s.labelAr : s.labelEn })),
              ]}
            />
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'من تاريخ' : 'From'}
              </span>
              <input
                type="date"
                value={list.filters.dateFrom}
                onChange={(e) => list.setFilter('dateFrom', e.target.value)}
                className="rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                {isAr ? 'إلى تاريخ' : 'To'}
              </span>
              <input
                type="date"
                value={list.filters.dateTo}
                onChange={(e) => list.setFilter('dateTo', e.target.value)}
                className="rounded-xl border border-border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/15"
              />
            </label>
          </>
        )}
        columns={columns}
        data={list.data}
        loading={list.loading}
        rowActions={(o) => [
          {
            label: isAr ? 'تحميل الفاتورة' : 'Download invoice',
            disabled: downloadingId === o._id,
            onClick: () => handleDownload(o),
          },
          {
            label: isAr ? 'عرض الطلب' : 'View order',
            onClick: () => navigate(`/admin/orders?order=${o._id}`),
          },
        ]}
        pagination={list.pagination}
        onPageChange={list.setPage}
        emptyIcon={Receipt}
        emptyTitle={isAr ? 'لا توجد فواتير' : 'No invoices yet'}
        emptyDescription={isAr
          ? 'ستظهر هنا فواتير الطلبات فور استلامها'
          : 'Order invoices will show up here as orders come in'}
      />
    </div>
  );
}
