import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Download, ShoppingCart } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { adminApi } from '../adminApi';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '../adminConstants';
import { useAdminListPage } from '../hooks/useAdminListPage';
import { downloadBlob } from '../utils/downloadBlob';
import StatusBadge from '../components/StatusBadge';
import PaymentStatusBadge from '../components/PaymentStatusBadge';
import OrderDetailPanel from '../components/OrderDetailPanel';
import { useAdminStats } from '../context/AdminStatsContext';
import Button from '../../components/ui/Button';
import { formatPrice } from '../../utils/formatters';
import { AdminListPage, ListFilterSelect } from '../components/list';
import { useToast } from '../components';

export default function OrdersPage() {
  const { language } = useLanguage();
  const isAr = language === 'ar';
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const orderFromUrl = searchParams.get('order');
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [exporting, setExporting] = useState(false);

  const list = useAdminListPage({
    fetchFn: (params) => adminApi.getOrders(params),
    initialFilters: {
      orderStatus: '',
      paymentStatus: '',
      dateFrom: '',
      dateTo: '',
    },
  });

  const loadDetail = useCallback(async (orderId) => {
    setDetailLoading(true);
    try {
      const { data } = await adminApi.getOrder(orderId);
      setSelected(data.order);
    } catch {
      setSelected(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectOrder = (order) => {
    setSelectedId(order._id);
    loadDetail(order._id);
  };

  useEffect(() => {
    if (!orderFromUrl) return;
    setSelectedId(orderFromUrl);
    loadDetail(orderFromUrl);
  }, [orderFromUrl, loadDetail]);

  useEffect(() => {
    if (!list.loadError) return;
    toast.error(list.loadError);
  }, [list.loadError, toast]);

  const { refreshStats } = useAdminStats();

  const patchOrder = async (fields) => {
    if (!selectedId) return;
    setUpdating(true);
    try {
      const { data } = await adminApi.updateOrderStatus(selectedId, fields);
      setSelected(data.order);
      list.reload();
      refreshStats();
      if (fields.orderStatus) {
        toast.success(isAr ? 'تم تحديث الحالة' : 'Status updated');
      } else if (fields.adminNotes !== undefined) {
        toast.success(isAr ? 'تم حفظ الملاحظات' : 'Notes saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || (isAr ? 'حدث خطأ' : 'Update failed'));
    } finally {
      setUpdating(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data } = await adminApi.exportOrders(list.queryParams);
      downloadBlob(data, 'orders.csv');
    } catch {
      toast.error(isAr ? 'فشل التصدير' : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const columns = [
    {
      key: 'orderNumber',
      header: '#',
      sortKey: 'orderNumber',
      render: (order) => <span className="font-medium">{order.orderNumber}</span>,
    },
    {
      key: 'customer',
      header: isAr ? 'العميل' : 'Customer',
      render: (order) => order.user?.name || order.phone,
    },
    {
      key: 'total',
      header: isAr ? 'المبلغ' : 'Total',
      sortKey: 'total',
      render: (order) => formatPrice(order.total),
    },
    {
      key: 'status',
      header: isAr ? 'الحالة' : 'Status',
      render: (order) => (
        <div className="flex flex-col gap-1">
          <StatusBadge status={order.orderStatus || order.status} language={language} />
          <PaymentStatusBadge status={order.paymentStatus} language={language} />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <AdminListPage
            isAr={isAr}
            q={list.q}
            onSearchChange={list.setQ}
            searchPlaceholder={isAr ? 'بحث برقم الطلب أو الهاتف...' : 'Search order # or phone...'}
            sort={list.sort}
            onSort={list.toggleSort}
            actions={(
              <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
                <Download className="h-4 w-4" />
                {isAr ? 'تصدير CSV' : 'Export CSV'}
              </Button>
            )}
            filters={(
              <>
                <ListFilterSelect
                  label={isAr ? 'حالة الطلب' : 'Order status'}
                  value={list.filters.orderStatus}
                  onChange={(v) => list.setFilter('orderStatus', v)}
                  options={[
                    { value: '', label: isAr ? 'كل الحالات' : 'All statuses' },
                    ...ORDER_STATUSES.map((s) => ({
                      value: s.value,
                      label: isAr ? s.labelAr : s.labelEn,
                    })),
                  ]}
                />
                <ListFilterSelect
                  label={isAr ? 'الدفع' : 'Payment'}
                  value={list.filters.paymentStatus}
                  onChange={(v) => list.setFilter('paymentStatus', v)}
                  options={[
                    { value: '', label: isAr ? 'الكل' : 'All' },
                    ...PAYMENT_STATUSES.map((s) => ({
                      value: s.value,
                      label: isAr ? s.labelAr : s.labelEn,
                    })),
                  ]}
                />
                <input
                  type="date"
                  value={list.filters.dateFrom}
                  onChange={(e) => list.setFilter('dateFrom', e.target.value)}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? 'من تاريخ' : 'From date'}
                />
                <input
                  type="date"
                  value={list.filters.dateTo}
                  onChange={(e) => list.setFilter('dateTo', e.target.value)}
                  className="rounded-xl border border-border px-3 py-2 text-sm"
                  aria-label={isAr ? 'إلى تاريخ' : 'To date'}
                />
              </>
            )}
            columns={columns}
            data={list.data}
            loading={list.loading}
            onRowClick={handleSelectOrder}
            rowClassName={(order) => (selectedId === order._id ? 'bg-primary-50' : '')}
            pagination={list.pagination}
            onPageChange={list.setPage}
            emptyIcon={ShoppingCart}
            emptyTitle={isAr ? 'لا توجد طلبات' : 'No orders'}
          />
        </div>

        <div className="rounded-2xl border border-border bg-white p-5 shadow-sm xl:col-span-3 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <OrderDetailPanel
            order={selected}
            loading={detailLoading}
            isAr={isAr}
            updating={updating}
            onPatch={patchOrder}
          />
        </div>
      </div>
    </div>
  );
}
