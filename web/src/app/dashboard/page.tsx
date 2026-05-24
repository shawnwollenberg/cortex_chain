"use client";

import { useEffect, useMemo, useState } from "react";

type Row = Record<string, string | number | boolean | null | undefined>;

type Analytics = {
  summary?: Row;
  volume_by_token?: Row[];
  top_merchants?: Row[];
  top_services?: Row[];
  facilitator_volume?: Row[];
};

type EndpointState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3012").replace(/\/$/, "");

const short = (value: unknown) => {
  const text = String(value ?? "");
  if (text.startsWith("0x") && text.length > 14) return `${text.slice(0, 8)}...${text.slice(-6)}`;
  return text || "-";
};

const numberText = (value: unknown) => {
  const text = String(value ?? "0");
  try {
    return BigInt(text).toLocaleString("en-US");
  } catch {
    return text;
  }
};

const useEndpoint = <T,>(path: string): EndpointState<T> => {
  const [state, setState] = useState<EndpointState<T>>({
    data: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetch(`${API_URL}${path}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return (await res.json()) as T;
      })
      .then((data) => {
        if (active) setState({ data, error: null, loading: false });
      })
      .catch((err: Error) => {
        if (active) setState({ data: null, error: err.message, loading: false });
      });

    return () => {
      active = false;
    };
  }, [path]);

  return state;
};

const Stat = ({ label, value, tone = "default" }: { label: string; value: unknown; tone?: "default" | "green" | "amber" }) => (
  <div className="min-h-28 rounded-lg border border-border bg-[#11151c] p-4">
    <div className="text-xs uppercase tracking-normal text-muted">{label}</div>
    <div
      className={`mt-3 text-2xl font-semibold ${
        tone === "green" ? "text-emerald-300" : tone === "amber" ? "text-amber-300" : "text-text"
      }`}
    >
      {numberText(value)}
    </div>
  </div>
);

const DataTable = ({
  title,
  rows,
  columns,
}: {
  title: string;
  rows: Row[];
  columns: { key: string; label: string; numeric?: boolean }[];
}) => (
  <section className="min-w-0">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-xs text-muted">{rows.length} rows</span>
    </div>
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead className="bg-[#151a22] text-xs uppercase tracking-normal text-muted">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-3 py-2 text-left font-medium ${column.numeric ? "text-right" : ""}`}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-[#0d1117]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-muted" colSpan={columns.length}>
                  No indexed records
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="hover:bg-[#131820]">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-3 py-2 ${column.numeric ? "text-right tabular-nums" : ""}`}>
                      {column.numeric ? numberText(row[column.key]) : short(row[column.key])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </section>
);

export default function DashboardPage() {
  const analytics = useEndpoint<Analytics>("/analytics/commerce");
  const merchants = useEndpoint<{ merchants: Row[] }>("/merchants?active=true&limit=8");
  const services = useEndpoint<{ services: Row[] }>("/services?active=true&limit=8");
  const receipts = useEndpoint<{ receipts: Row[] }>("/receipts?limit=8");
  const disputes = useEndpoint<{ disputes: Row[] }>("/disputes?limit=8");

  const summary = analytics.data?.summary ?? {};
  const hasError = [analytics, merchants, services, receipts, disputes].find((item) => item.error);
  const loading = [analytics, merchants, services, receipts, disputes].some((item) => item.loading);

  const status = useMemo(() => {
    if (hasError) return { label: "API disconnected", className: "bg-red-500/15 text-red-200 border-red-500/40" };
    if (loading) return { label: "Syncing", className: "bg-amber-500/15 text-amber-200 border-amber-500/40" };
    return { label: "Live", className: "bg-emerald-500/15 text-emerald-200 border-emerald-500/40" };
  }, [hasError, loading]);

  return (
    <div className="min-h-screen bg-[#090d12]">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-muted">Cortex Commerce</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal">Protocol dashboard</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className={`rounded-md border px-3 py-1 ${status.className}`}>{status.label}</span>
            <span className="rounded-md border border-border bg-[#11151c] px-3 py-1 text-muted">{API_URL}</span>
          </div>
        </div>

        {hasError ? (
          <div className="mb-6 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
            Dashboard fetch failed: {hasError.error}
          </div>
        ) : null}

        <section className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Merchants" value={summary.active_merchants ?? 0} />
          <Stat label="Services" value={summary.active_services ?? 0} />
          <Stat label="Settled volume" value={summary.settled_volume ?? 0} tone="green" />
          <Stat label="Protocol fees" value={summary.settled_protocol_fees ?? 0} tone="amber" />
          <Stat label="Quotes" value={summary.quotes ?? 0} />
          <Stat label="Receipts" value={summary.receipts ?? 0} />
          <Stat label="Facilitators" value={summary.active_facilitators ?? 0} />
          <Stat label="Open disputes" value={summary.open_disputes ?? 0} tone="amber" />
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <DataTable
            title="Token volume"
            rows={analytics.data?.volume_by_token ?? []}
            columns={[
              { key: "token", label: "Token" },
              { key: "receipts", label: "Receipts", numeric: true },
              { key: "settled_volume", label: "Volume", numeric: true },
              { key: "protocol_fees", label: "Fees", numeric: true },
            ]}
          />
          <DataTable
            title="Merchant volume"
            rows={analytics.data?.top_merchants ?? []}
            columns={[
              { key: "merchant_id", label: "Merchant" },
              { key: "owner", label: "Owner" },
              { key: "settled_volume", label: "Volume", numeric: true },
              { key: "protocol_fees", label: "Fees", numeric: true },
            ]}
          />
          <DataTable
            title="Services"
            rows={services.data?.services ?? []}
            columns={[
              { key: "service_numeric_id", label: "ID" },
              { key: "service_id", label: "Service" },
              { key: "merchant_id", label: "Merchant" },
              { key: "active", label: "Active" },
            ]}
          />
          <DataTable
            title="Facilitators"
            rows={analytics.data?.facilitator_volume ?? []}
            columns={[
              { key: "facilitator", label: "Address" },
              { key: "receipts", label: "Receipts", numeric: true },
              { key: "settled_volume", label: "Volume", numeric: true },
              { key: "protocol_fees", label: "Fees", numeric: true },
            ]}
          />
          <DataTable
            title="Recent receipts"
            rows={receipts.data?.receipts ?? []}
            columns={[
              { key: "receipt_id", label: "Receipt" },
              { key: "agent", label: "Agent" },
              { key: "amount", label: "Amount", numeric: true },
              { key: "protocol_fee_amount", label: "Fee", numeric: true },
            ]}
          />
          <DataTable
            title="Disputes"
            rows={disputes.data?.disputes ?? []}
            columns={[
              { key: "dispute_id", label: "Dispute" },
              { key: "receipt_id", label: "Receipt" },
              { key: "status", label: "Status" },
              { key: "opener", label: "Opener" },
            ]}
          />
          <DataTable
            title="Registered merchants"
            rows={merchants.data?.merchants ?? []}
            columns={[
              { key: "merchant_id", label: "ID" },
              { key: "owner", label: "Owner" },
              { key: "payout_address", label: "Payout" },
              { key: "active", label: "Active" },
            ]}
          />
          <DataTable
            title="Service volume"
            rows={analytics.data?.top_services ?? []}
            columns={[
              { key: "service_numeric_id", label: "ID" },
              { key: "service_id", label: "Service" },
              { key: "receipts", label: "Receipts", numeric: true },
              { key: "settled_volume", label: "Volume", numeric: true },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
