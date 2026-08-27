/**
 * Operational screens for the remaining app modules.
 */
import { useEffect, useState } from "react";
import { useTutorial } from "../context/TutorialContext";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  IndianRupee,
  Package,
  Settings,
  ShieldCheck,
  TrendingUp,
  Warehouse,
  X,
} from "lucide-react";

import AppShell from "../components/layout/AppShell";
import KpiCard from "../components/ui/KpiCard";
import StatusBadge from "../components/ui/StatusBadge";
import AddSaleModal from "../components/sales/AddSaleModal";
import ForecastTrustPanel from "../components/charts/ForecastTrustPanel";
import {
  fetchAlerts,
  acknowledgeAlert,
  markAllAlertsRead,
  fetchAllForecasts,
  fetchProductForecast,
  fetchProducts,
  fetchInventory,
  fetchInventoryPlanning,
  fetchMarketTrends,
  fetchSales,
  fetchSalesAnalytics,
  fetchSettings,
  updateSettings,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const compactNumber = (value) => {
  const n = Number(value || 0);
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(Math.round(n));
};

const formatDate = (dateString) => {
  if (!dateString) return "—";
  try {
    const language = localStorage.getItem("kirana_language") || "en";
    return new Date(dateString).toLocaleDateString(language === "mr" ? "mr-IN" : language === "hi" ? "hi-IN" : "en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

// Map DB payment_method values to kirana-friendly display labels + colours
const PAYMENT_DISPLAY = {
  cash:   { label: "Cash",    cls: "bg-green-100  text-green-700"  },
  upi:    { label: "UPI",     cls: "bg-blue-100   text-blue-700"   },
  credit: { label: "Udhaar",  cls: "bg-amber-100  text-amber-700"  },
  barter: { label: "Barter",  cls: "bg-purple-100 text-purple-700" },
  other:  { label: "Other",   cls: "bg-gray-100   text-gray-600"   },
};
function PaymentBadge({ method }) {
  const { t } = useLanguage();
  const cfg = PAYMENT_DISPLAY[method] ?? PAYMENT_DISPLAY.other;
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${cfg.cls}`}>
      {t(cfg.label)}
    </span>
  );
}

function SalesAnalytics() {
  const { t } = useLanguage();
  const [analytics, setAnalytics] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaleOpen, setIsSaleOpen] = useState(false);

  const refreshSales = () => {
    setLoading(true);
    Promise.all([fetchSalesAnalytics(), fetchSales(30)])
      .then(([salesAnalytics, sales]) => {
        setAnalytics(salesAnalytics);
        setTransactions(safeArray(sales));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { refreshSales(); }, []);

  const kpis = analytics?.kpis ?? {};
  const dailyTrend = safeArray(analytics?.daily_trend);
  const byCategory = safeArray(analytics?.by_category);
  const profit = analytics?.profit ?? {};
  const bestMargin = analytics?.best_margin;
  const deadStock = safeArray(analytics?.dead_stock);
  const maxRevenue = Math.max(...dailyTrend.map((item) => Number(item.revenue || 0)), 1);

  // Dynamic date-range label for the transactions header
  const salesRangeLabel = (() => {
    if (transactions.length === 0) return t("Last 30 days");
    const dates = transactions.map((r) => r.sale_date).filter(Boolean).sort();
    const from = new Date(dates[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const to   = new Date(dates[dates.length - 1]).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `${from} – ${to}`;
  })();

  return (
    <AppShell
      title={t("Sales Analytics")}
      description={t("Historical sales performance, category mix, and transaction trends")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard
          icon={IndianRupee}
          label={t("Total Sales (7d)")}
          value={loading ? "—" : money(kpis.total_sales_7d)}
          trendPct={loading ? undefined : Number(kpis.sales_delta_pct || 0)}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={BarChart3}
          label={t("Sales 30d")}
          value={loading ? "—" : money(kpis.total_sales_30d)}
          trendLabel={t("rolling month")}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={CalendarRange}
          label={t("Orders (7d)")}
          value={loading ? "—" : compactNumber(kpis.total_orders_7d)}
          trendLabel={t("store orders")}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("Avg Order Value")}
          value={loading ? "—" : money(kpis.avg_order_value)}
          trendLabel={t("per invoice")}
          iconBg="bg-amber-50"
          iconColor="text-warning"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard
          icon={IndianRupee}
          label={t("Profit (7d)")}
          value={loading ? "—" : money(profit.total_7d)}
          trendLabel={t("revenue minus cost")}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("Profit (30d)")}
          value={loading ? "—" : money(profit.total_30d)}
          trendLabel={loading ? "" : `${profit.margin_pct_30d || 0}% margin`}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={BarChart3}
          label={t("Best-margin product")}
          value={loading ? "—" : (bestMargin?.product_name || "—")}
          trendLabel={bestMargin ? `${bestMargin.margin_pct}% ${t("margin")}` : t("no sales yet")}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={Warehouse}
          label={t("Capital stuck in slow movers")}
          value={loading ? "—" : money(analytics?.capital_stuck)}
          trendLabel={t("at-cost stock value")}
          iconBg="bg-amber-50"
          iconColor="text-warning"
          loading={loading}
        />
      </div>

      <div className="content-card mb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">{t("Dead stock / spoilage risk")}</h3>
            <p className="text-gray-400 text-xs mt-1">{t("High stock value with the lowest recent sales velocity")}</p>
          </div>
          <AlertTriangle className="w-5 h-5 text-warning" />
        </div>
        {loading ? (
          <div className="skeleton h-16 rounded-lg" />
        ) : deadStock.length > 0 ? (
          <div className="space-y-3">
            {deadStock.map((item) => (
              <div key={item.product_id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg bg-amber-50/70 px-3 py-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800">{item.product_name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {t("Sales velocity")}: {Number(item.daily_velocity || 0).toFixed(1)} {item.unit || t("units")}/{t("day")}
                    {" · "}{t("Stock value")}: {money(item.stock_value)}
                    {item.days_since_last_sale !== null && ` · ${item.days_since_last_sale}${t("d since last sale")}`}
                  </div>
                </div>
                <span className="text-xs font-semibold text-amber-700">{t(item.suggestion)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{t("No dead-stock risk detected.")}</p>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="content-card xl:col-span-2">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Daily Revenue Trend")}</h3>
          <div className="flex items-end gap-2 h-44">
            {dailyTrend.map((item, index) => (
              <div key={`${item.date}-${index}`} className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-xl bg-brand-mid/80"
                  style={{ height: `${Math.max(18, (Number(item.revenue || 0) / maxRevenue) * 100)}%` }}
                />
                <span className="text-[10px] text-gray-400 uppercase">
                  {new Date(item.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Revenue by Category")}</h3>
          <div className="space-y-4">
            {byCategory.map((item) => {
              const total = byCategory.reduce((sum, row) => sum + Number(row.revenue || 0), 0) || 1;
              const width = (Number(item.revenue || 0) / total) * 100;
              return (
                <div key={item.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-700">{t(item.category)}</span>
                    <span className="text-xs font-semibold text-gray-800">{money(item.revenue)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-2 rounded-full bg-brand-mid" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">{t("Recent Transactions")}</h3>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-gray-400 sm:inline">{salesRangeLabel}</span>
            <button type="button" onClick={() => setIsSaleOpen(true)} className="btn-action">+ {t("Add Sale")}</button>
          </div>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Product")}</th>
                <th>{t("Date")}</th>
                <th className="text-right">{t("Qty")}</th>
                <th className="text-right">{t("Amount")}</th>
                <th>{t("Payment")}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium text-gray-800">{row.product_name}</td>
                  <td>{formatDate(row.sale_date)}</td>
                  <td className="numeric">{Number(row.quantity || 0).toFixed(0)}</td>
                  <td className="numeric font-semibold text-gray-800">{money(row.total_amount)}</td>
                  <td><PaymentBadge method={row.payment_method} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AddSaleModal isOpen={isSaleOpen} onClose={() => setIsSaleOpen(false)} onSuccess={refreshSales} />
    </AppShell>
  );
}

function InventoryPage() {
  const { t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventory()
      .then((payload) => setItems(safeArray(payload.items)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalValue = items.reduce((sum, item) => sum + Number(item.stock_value || 0), 0);
  const lowStock = items.filter((item) => item.status === "low_stock").length;
  const outOfStock = items.filter((item) => item.status === "out_of_stock").length;

  return (
    <AppShell
      title={t("Inventory Management")}
      description={t("Current stock health, coverage, and replenishment status")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard
          icon={Warehouse}
          label={t("Inventory Value")}
          value={loading ? "—" : money(totalValue)}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          loading={loading}
        />
        <KpiCard
          icon={Package}
          label={t("Total SKUs")}
          value={loading ? "—" : String(items.length)}
          trendLabel={t("active products")}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("Low Stock")}
          value={loading ? "—" : String(lowStock)}
          trendLabel={t("watch closely")}
          iconBg="bg-amber-50"
          iconColor="text-warning"
          loading={loading}
        />
        <KpiCard
          icon={ShieldCheck}
          label={t("Out of Stock")}
          value={loading ? "—" : String(outOfStock)}
          trendLabel={t("urgent action")}
          iconBg="bg-red-50"
          iconColor="text-danger"
          loading={loading}
        />
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">{t("Stock Overview")}</h3>
          <span className="text-xs text-gray-400">{t("Coverage by product")}</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Product")}</th>
                <th>{t("Category")}</th>
                <th className="text-right">{t("Current")}</th>
                <th className="text-right">{t("Ideal")}</th>
                <th className="text-right">{t("Safety")}</th>
                <th className="text-right">{t("Reorder")}</th>
                <th>{t("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="font-medium text-gray-800">{item.name}</td>
                  <td>{item.category}</td>
                  <td className="numeric">{Number(item.current_stock || 0).toFixed(0)} {item.unit}</td>
                  <td className="numeric">{Number(item.ideal_stock || 0).toFixed(0)} {item.unit}</td>
                  <td className="numeric">{Number(item.safety_stock || 0).toFixed(0)}</td>
                  <td className="numeric">{Number(item.reorder_qty || 0).toFixed(0)}</td>
                  <td><StatusBadge status={item.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function PlanningPage() {
  const { t } = useLanguage();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInventoryPlanning()
      .then((payload) => setPlans(safeArray(payload.plans)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalProduction = plans.reduce((sum, item) => sum + Number(item.recommended_production || 0), 0);
  const totalDemand = plans.reduce((sum, item) => sum + Number(item.expected_demand_7d || 0), 0);

  return (
    <AppShell
      title={t("Inventory Planning")}
      description={t("Recommended production and reorder quantities for the next 7 days")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <KpiCard
          icon={ClipboardList}
          label={t("Recommended Production")}
          value={loading ? "—" : `${Number(totalProduction).toFixed(0)}`}
          unit={t("units")}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("Expected Demand")}
          value={loading ? "—" : `${Number(totalDemand).toFixed(0)}`}
          unit={t("units")}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={AlertTriangle}
          label={t("Shortfall SKUs")}
          value={loading ? "—" : String(plans.filter((item) => Number(item.projected_shortfall || 0) > 0).length)}
          trendLabel={t("need stock-up")}
          iconBg="bg-red-50"
          iconColor="text-danger"
          loading={loading}
        />
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">{t("Production Plan")}</h3>
          <span className="text-xs text-gray-400">{t("Based on 7-day demand + safety stock")}</span>
        </div>
        <div className="overflow-x-auto w-full">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("Product")}</th>
                <th className="text-right">{t("Current")}</th>
                <th className="text-right">{t("Demand")}</th>
                <th className="text-right">{t("Target")}</th>
                <th className="text-right">{t("Production")}</th>
                <th className="text-right">{t("Shortfall")}</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.product_id}>
                  <td className="font-medium text-gray-800">{plan.product_name}</td>
                  <td className="numeric">{Number(plan.current_inventory || 0).toFixed(0)}</td>
                  <td className="numeric">{Number(plan.expected_demand_7d || 0).toFixed(0)}</td>
                  <td className="numeric">{Number(plan.target_stock || 0).toFixed(0)}</td>
                  <td className="numeric font-semibold text-brand-mid">{Number(plan.recommended_production || 0).toFixed(0)}</td>
                  <td className="numeric">{Number(plan.projected_shortfall || 0).toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function MarketTrends() {
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMarketTrends()
      .then((payload) => setData(payload))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categoryTrends = safeArray(data?.category_trends);
  const recentSignals = safeArray(data?.recent_signals);

  return (
    <AppShell
      title={t("Market Trends")}
      description={t("External demand and supply signals impacting pricing and stocking")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard
          icon={TrendingUp}
          label={t("Market Demand Index")}
          value={loading ? "—" : `${Number(data?.market_demand_index || 0).toFixed(0)}`}
          trendLabel={t("across categories")}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={Package}
          label={t("Supply Index")}
          value={loading ? "—" : `${Number(data?.supply_index || 0).toFixed(0)}`}
          trendLabel={t("coverage")}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={IndianRupee}
          label={t("Avg Price")}
          value={loading ? "—" : `₹${Number(categoryTrends.reduce((sum, row) => sum + Number(row.avg_price || 0), 0) / Math.max(categoryTrends.length, 1)).toFixed(0)}`}
          trendLabel={t("per category")}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          loading={loading}
        />
        <KpiCard
          icon={CalendarRange}
          label={t("Signals Tracked")}
          value={loading ? "—" : String(recentSignals.length)}
          trendLabel={t("last 28 days")}
          iconBg="bg-amber-50"
          iconColor="text-warning"
          loading={loading}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
        <div className="content-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Category Trend Snapshot")}</h3>
          <div className="space-y-4">
            {categoryTrends.map((item) => (
              <div key={item.category}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">{item.category}</span>
                  <span className="text-xs text-gray-500">{t("Demand")} {Number(item.demand_index || 0).toFixed(0)}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-brand-mid" style={{ width: `${Math.min(100, Number(item.demand_index || 0))}%` }} />
                </div>
                <div className="mt-1 text-[10px] text-gray-400">{t("Avg price:")} ₹{Number(item.avg_price || 0).toFixed(0)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Recent Market Signals")}</h3>
          <div className="space-y-3">
            {recentSignals.slice(0, 6).map((signal, index) => (
              <div key={`${signal.date}-${index}`} className="flex items-center justify-between border-b border-gray-50 pb-2 last:border-0 last:pb-0">
                <div>
                  <p className="text-xs font-medium text-gray-800">{t(signal.category)}</p>
                  <p className="text-[10px] text-gray-400">{formatDate(signal.date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-800">{t("Demand")} {Number(signal.demand_index || 0).toFixed(0)}</p>
                  <p className="text-[10px] text-gray-400">₹{Number(signal.price || 0).toFixed(0)}/{t("unit")}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ForecastReports() {
  const { language, t } = useLanguage();
  const [fcData,   setFcData]   = useState(null);
  const [productData, setProductData] = useState([]);
  const [trustData, setTrustData] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    Promise.all([fetchAllForecasts(), fetchProducts()])
      .then(([d, products]) => {
        setFcData(d);
        setProductData(products);
        const firstProduct = d.products?.[0];
        if (firstProduct) return fetchProductForecast(firstProduct.product_id, language).then(setTrustData);
        return null;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [language]);

  // Derive KPIs from the same /forecast/business/all response that
  // Demand Prediction uses — guarantees identical numbers across screens.
  const products      = fcData?.products ?? [];
  const overallAcc    = fcData?.overall_accuracy_pct ?? null;
  const total7d       = products.reduce((s, p) => s + (p.total_7d ?? 0), 0);
  const reportCount   = products.length;   // one report card per product

  const reportCards = [
    { id: "demand", title: t("7-Day Demand Summary"),       status: t("Generated"), tone: "optimal" },
    { id: "inventory", title: t("Inventory Coverage Report"),  status: t("Ready"),     tone: "medium"  },
    { id: "accuracy", title: t("Sales Performance Snapshot"), status: t("Queued"),    tone: "low"     },
  ];
  const selectedTitle = reportCards.find((report) => report.id === selectedReport)?.title;
  const forecastDates = products.flatMap((product) => product.daily_forecasts ?? []).map((forecast) => forecast.date);
  const firstForecastDate = forecastDates.sort()[0];
  const lastForecastDate = forecastDates.sort().at(-1);
  const stockByProduct = Object.fromEntries(productData.map((product) => [String(product.id), product]));

  return (
    <AppShell
      title={t("Forecast Reports")}
      description={t("Generated summaries for operations, planning, and executive review")}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <KpiCard
          icon={BarChart3}
          label={t("Forecast Confidence")}
          value={loading ? "—" : overallAcc !== null ? `${overallAcc.toFixed(1)}%` : "—"}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          loading={loading}
        />
        <KpiCard
          icon={TrendingUp}
          label={t("7-Day Demand")}
          value={loading ? "—" : Math.round(total7d).toLocaleString("en-IN")}
          unit={t("units")}
          iconBg="bg-green-50"
          iconColor="text-brand-mid"
          loading={loading}
        />
        <KpiCard
          icon={ClipboardList}
          label={t("Products Forecasted")}
          value={loading ? "—" : String(reportCount)}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          loading={loading}
        />
        <KpiCard
          icon={CalendarRange}
          label={t("Next Run")}
          value={t("Tomorrow")}
          trendLabel={t("8:00 AM")}
          iconBg="bg-amber-50"
          iconColor="text-warning"
        />
      </div>

      <div className="mb-5">
        <ForecastTrustPanel forecastData={trustData} loading={loading} compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {reportCards.map((report) => (
          <div key={report.title} className="content-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 text-sm">{report.title}</h3>
              <StatusBadge status={report.tone} />
            </div>
            <p className="text-gray-500 text-xs leading-relaxed mb-4">
              {t("Summary includes demand drivers, stock coverage, and suggested actions for the next operational cycle.")}
            </p>
            <button type="button" onClick={() => setSelectedReport(report.id)} className="btn-action w-full justify-center">
              {t("Open report")} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4" role="dialog" aria-modal="true" aria-labelledby="report-detail-title">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-mid">{t("Forecast report detail")}</p>
                <h2 id="report-detail-title" className="mt-1 text-xl font-bold text-gray-900">{selectedTitle}</h2>
                <p className="mt-1 text-xs text-gray-500">{t("Forecast window")}: {formatDate(firstForecastDate)} {t("to")} {formatDate(lastForecastDate)}</p>
              </div>
              <button type="button" onClick={() => setSelectedReport(null)} aria-label={t("Close report")} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-blue-50 p-3"><p className="text-xs text-blue-600">{t("7-day forecast")}</p><p className="mt-1 text-lg font-bold text-gray-900">{Math.round(total7d).toLocaleString("en-IN")} {t("units")}</p></div>
              <div className="rounded-xl bg-green-50 p-3"><p className="text-xs text-green-600">{t("Overall accuracy")}</p><p className="mt-1 text-lg font-bold text-gray-900">{overallAcc === null ? "—" : `${overallAcc.toFixed(1)}%`}</p></div>
              <div className="rounded-xl bg-amber-50 p-3"><p className="text-xs text-amber-600">{t("Products forecasted")}</p><p className="mt-1 text-lg font-bold text-gray-900">{products.length}</p></div>
            </div>

            {selectedReport === "inventory" ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-gray-800">{t("Projected coverage by product")}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="border-b border-gray-100 text-xs text-gray-500"><tr><th className="pb-2">{t("Product")}</th><th className="pb-2">{t("Current stock")}</th><th className="pb-2">{t("7-day forecast")}</th><th className="pb-2">{t("Coverage")}</th></tr></thead>
                    <tbody>{products.map((product) => {
                      const stock = Number(stockByProduct[product.product_id]?.current_stock || 0);
                      const dailyDemand = Number(product.total_7d || 0) / 7;
                      return <tr key={product.product_id} className="border-b border-gray-50"><td className="py-3 font-medium text-gray-800">{product.product_name}</td><td className="py-3">{stock.toFixed(0)} {product.unit}</td><td className="py-3">{Number(product.total_7d || 0).toFixed(1)} {product.unit}</td><td className="py-3">{dailyDemand ? `${(stock / dailyDemand).toFixed(1)} days` : "—"}</td></tr>;
                    })}</tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div>
                    <h3 className="mb-3 text-sm font-semibold text-gray-800">{t("Product-wise forecast and accuracy")}</h3>
                <div className="space-y-3">{products.map((product) => (
                  <div key={product.product_id} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold text-gray-800">{product.product_name}</span><span className="text-xs font-semibold text-brand-mid">{Number(product.accuracy_pct || 0).toFixed(1)}% {t("accuracy")}</span></div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500"><span>{Number(product.total_7d || 0).toFixed(1)} {product.unit} {t("over 7 days")}</span><span>{t("Peak:")} {formatDate(product.peak_day)}</span><span>{product.daily_forecasts?.length || 0} {t("dated forecast points")}</span></div>
                  </div>
                ))}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function AlertsPage() {
  const { language, t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchAlerts(language)
      .then((payload) => setItems(safeArray(payload)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [language]);

  const openItems = items.filter((item) => !item.resolved_at);
  const openAlerts = openItems.length;
  const highPriority = openItems.filter((item) => item.priority === "high").length;
  const mediumPriority = openItems.filter((item) => item.priority === "medium").length;
  const lowPriority = openItems.filter((item) => item.priority === "low").length;
  // SLA Risk: derived from open high-priority alert count — not hardcoded
  const slaRisk = highPriority >= 3 ? "High" : highPriority >= 1 ? "Medium" : "Low";

  const acknowledge = async (alertId) => {
    setActionId(alertId);
    setToast(null);
    try {
      const saved = await acknowledgeAlert(alertId);
      setItems((current) => current.map((item) => item.id === alertId ? { ...item, ...saved } : item));
      setToast({ type: "success", message: "Alert acknowledged." });
    } catch (requestError) {
      setToast({ type: "error", message: requestError.response?.data?.detail || "Alert could not be acknowledged." });
    } finally {
      setActionId(null);
    }
  };

  const markAllRead = async () => {
    setActionId("all");
    setToast(null);
    try {
      await markAllAlertsRead();
      const resolvedAt = new Date().toISOString();
      setItems((current) => current.map((item) => item.resolved_at ? item : { ...item, is_read: true, resolved_at: resolvedAt }));
      setToast({ type: "success", message: "All alerts marked as read." });
    } catch (requestError) {
      setToast({ type: "error", message: requestError.response?.data?.detail || "Alerts could not be updated." });
    } finally {
      setActionId(null);
    }
  };

  return (
    <AppShell
      title={t("Alerts & Notifications")}
      description={t("Operational issues, stock risks, and recommended follow-up actions")}
    >
      {toast && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`} role="status">{t(toast.message)}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
        <KpiCard icon={Bell} label={t("Open Alerts")} value={loading ? "—" : String(openAlerts)} iconBg="bg-red-50" iconColor="text-danger" loading={loading} />
        <KpiCard icon={AlertTriangle} label={t("High Priority")} value={loading ? "—" : String(highPriority)} iconBg="bg-amber-50" iconColor="text-warning" loading={loading} />
        <KpiCard icon={AlertTriangle} label={t("Medium Priority")} value={loading ? "—" : String(mediumPriority)} iconBg="bg-orange-50" iconColor="text-orange-500" loading={loading} />
        <KpiCard icon={AlertTriangle} label={t("Low Priority")} value={loading ? "—" : String(lowPriority)} iconBg="bg-slate-50" iconColor="text-slate-500" loading={loading} />
        <KpiCard icon={CheckCircle2} label={t("Resolved")} value={loading ? "—" : String(items.length - openAlerts)} iconBg="bg-green-50" iconColor="text-brand-mid" loading={loading} />
        <KpiCard icon={ShieldCheck} label={t("Stock Risk")} value={loading ? "—" : t(slaRisk)} iconBg="bg-blue-50" iconColor="text-blue-500" loading={loading} />
      </div>

      <div className="content-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">{t("Alert Feed")}</h3>
          <button type="button" onClick={markAllRead} disabled={loading || actionId !== null || openAlerts === 0} className="btn-outline disabled:opacity-60">{actionId === "all" ? t("Updating...") : t("Mark all read")}</button>
        </div>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge status={item.priority === "high" ? "high" : "medium"} />
                  <span className="text-xs font-semibold text-gray-700 uppercase">{t(item.type.toLowerCase().replaceAll("_", " "))}</span>
                </div>
                <p className="text-sm text-gray-700">{item.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400">{formatDate(item.created_at)}</span>
                {item.resolved_at ? <span className="text-xs font-semibold text-green-600">{t("Resolved")}</span> : <button type="button" onClick={() => acknowledge(item.id)} disabled={actionId !== null} className="btn-action disabled:opacity-60">{actionId === item.id ? t("Saving...") : t("Acknowledge")}</button>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function SettingsPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [form, setForm] = useState({ business_name: "", mobile: "", location: "", preferences: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchSettings()
      .then((settings) => setForm(settings))
      .catch(() => setToast({ type: "error", message: t("Settings could not be loaded.") }))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updatePreference = (name) => setForm((current) => ({ ...current, preferences: { ...current.preferences, [name]: !current.preferences[name] } }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setToast(null);
    try {
      const saved = await updateSettings(form);
      setForm(saved);
      setToast({ type: "success", message: t("Settings saved successfully.") });
    } catch (requestError) {
      setToast({ type: "error", message: requestError.response?.data?.detail || t("Settings could not be saved.") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title={t("Settings")}
      description={t("Store preferences, notifications, and forecasting automation")}
    >
      {toast && <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${toast.type === "success" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`} role="status">{toast.message}</div>}
      <form onSubmit={save} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="content-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Business Profile")}</h3>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("Business name")}</label>
              <input name="business_name" value={form.business_name ?? user?.business_name ?? ""} onChange={updateField} disabled={loading || saving} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("Contact number")}</label>
              <input name="mobile" value={form.mobile ?? user?.mobile ?? ""} onChange={updateField} disabled={loading || saving} required inputMode="numeric" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">{t("Operating region")}</label>
              <input name="location" value={form.location ?? user?.location ?? ""} onChange={updateField} disabled={loading || saving} required className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
        </div>

        <div className="content-card">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t("Preferences")}</h3>
          <div className="space-y-3">
            {[ ["daily_ai_forecast", t("Daily AI forecast summary")], ["low_stock_alerts", t("Low-stock alert notifications")], ["weekly_report_emails", t("Weekly demand report emails")], ["auto_reorder_suggestions", t("Auto-generated reorder suggestions")]].map(([name, item]) => (
              <label key={item} className="flex items-center justify-between gap-3 text-sm text-gray-700">
                <span>{item}</span>
                <input type="checkbox" checked={form.preferences[name] ?? true} onChange={() => updatePreference(name)} disabled={loading || saving} className="h-4 w-4 accent-brand-mid" />
              </label>
            ))}
          </div>
        </div>
        <button type="submit" disabled={loading || saving} className="btn-action xl:col-span-2 justify-center disabled:opacity-60">{saving ? t("Saving...") : t("Save Settings")}</button>
      </form>
    </AppShell>
  );
}

function HelpPage() {
  const { t } = useLanguage();
  const topics = [
    { title: t("Forecasting basics"), detail: t("Learn how demand, seasonal spikes, and safety stock affect recommendations.") },
    { title: t("Inventory health"), detail: t("Understand optimal, low-stock, and out-of-stock categories before placing orders.") },
    { title: t("Alerts workflow"), detail: t("Acknowledge alerts and resolve high-priority issues from the alert feed.") },
  ];

  return (
    <AppShell title={t("Help & Support")} description={t("Guides, FAQs, and support details for store operations")}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {topics.map((topic) => (
          <div key={topic.title} className="content-card">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">{topic.title}</h3>
            <p className="text-gray-500 text-xs leading-relaxed">{topic.detail}</p>
          </div>
        ))}
      </div>

      <div className="content-card mt-4">
        <h3 className="font-semibold text-gray-800 text-sm mb-3">{t("Need direct help?")}</h3>
        <div className="flex flex-wrap gap-3">
          <a href="tel:+919876543210" className="btn-action">{t("Call support")}</a>
          <a href="mailto:support@gramforecast.in" className="btn-outline">{t("Email support")}</a>
        </div>
      </div>
    </AppShell>
  );
}

export {
  SalesAnalytics,
  InventoryPage,
  PlanningPage,
  MarketTrends,
  ForecastReports,
  AlertsPage,
  SettingsPage,
  HelpPage,
};
