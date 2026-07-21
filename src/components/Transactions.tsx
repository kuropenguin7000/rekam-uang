"use client";

import { useEffect, useMemo, useState } from "react";
import { useExpenses } from "@/store/ExpenseStore";
import { useI18n } from "./I18nProvider";
import { MonthChip } from "./MonthChip";
import { PeriodTabs } from "./PeriodTabs";
import { EditTransactionModal } from "./EditTransactionModal";
import { Modal } from "./Modal";
import { categoryDisplayName } from "@/lib/categoryName";
import { memberDisplayName } from "@/lib/memberName";
import { formatCurrency, formatDayMonth } from "@/lib/format";
import { periodBounds, type HomePeriod } from "@/lib/period";
import { inBounds } from "@/lib/stats";
import { total } from "@/lib/aggregate";

const PAGE_SIZE = 12;

/**
 * The full transaction list, reached from Beranda's "Lihat semua". Beranda
 * shows only the three most recent, so browsing, filtering by member and
 * editing all live here.
 *
 * It opens on whatever period Beranda was showing — following "Lihat semua"
 * from a week view and landing on the whole month would silently contradict
 * the screen you came from — and the tabs stay so you can widen it here.
 */
export function Transactions({
  onBack,
  initialPeriod,
  initialMonth,
}: {
  onBack: () => void;
  initialPeriod: HomePeriod;
  initialMonth: string;
}) {
  const { transactions, categoryMeta, memberMeta, members, deleteTransaction } =
    useExpenses();
  const { t } = useI18n();
  const [month, setMonth] = useState(initialMonth);
  const [period, setPeriod] = useState<HomePeriod>(initialPeriod);
  const [member, setMember] = useState("");
  const [page, setPage] = useState(1);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const bounds = useMemo(() => periodBounds(period, month), [period, month]);
  const periodRows = useMemo(
    () => inBounds(transactions, bounds),
    [transactions, bounds]
  );
  const rows = useMemo(
    () => (member ? periodRows.filter((x) => x.member === member) : periodRows),
    [periodRows, member]
  );
  const spent = useMemo(() => total(rows), [rows]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => setPage(1), [month, member, period]);
  useEffect(() => setPage((p) => Math.min(p, totalPages)), [totalPages]);

  const visibleMembers = members.filter((m) => !m.hidden);
  const editing = transactions.find((x) => x.id === editId) ?? null;
  const confirming = transactions.find((x) => x.id === confirmId) ?? null;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={onBack}
            aria-label={t("acc.back")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            ‹
          </button>
          <h1 className="truncate text-lg font-semibold">{t("home.allTx")}</h1>
        </div>
        {period === "month" && <MonthChip month={month} onChange={setMonth} />}
      </header>

      <PeriodTabs value={period} onChange={setPeriod} />

      <div className="card flex items-center justify-between p-3.5">
        <span className="text-xs text-muted">{t("dash.expense")}</span>
        <span className="num text-base font-bold">{formatCurrency(spent)}</span>
      </div>

      {visibleMembers.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip active={member === ""} onClick={() => setMember("")}>
            {t("dash.memberAll")}
          </Chip>
          {visibleMembers.map((m) => (
            <Chip key={m.id} active={member === m.id} onClick={() => setMember(m.id)}>
              <span className="mr-1">{m.icon}</span>
              {memberDisplayName(m, t)}
            </Chip>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-muted">{t("dash.noTx")}</p>
      ) : (
        <>
          <ul className="card divide-y divide-border px-4">
            {pageRows.map((tx, i) => {
              const cat = categoryMeta(tx.category);
              const mem = memberMeta(tx.member);
              return (
                <li
                  key={tx.id}
                  style={{ animationDelay: `${Math.min(i, 9) * 30}ms` }}
                  className="animate-row flex items-center gap-3 py-3"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-base"
                    style={{ background: cat.color + "22" }}
                  >
                    {cat.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">
                      {tx.merchant || categoryDisplayName(cat, t)}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {mem ? `${mem.icon} ${memberDisplayName(mem, t)} · ` : ""}
                      {categoryDisplayName(cat, t)} · {formatDayMonth(tx.date)}
                    </p>
                  </div>
                  <span className="num shrink-0 text-[13px] font-semibold">
                    {formatCurrency(tx.amount)}
                  </span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setEditId(tx.id)}
                      aria-label={t("dash.editAria")}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-surface-muted hover:text-primary"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => setConfirmId(tx.id)}
                      aria-label={t("dash.deleteAria")}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted transition hover:bg-danger-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="card px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-40"
              >
                {t("dash.prev")}
              </button>
              <span className="text-xs text-muted">
                {t("dash.pageInfo", { page, total: totalPages })}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="card px-3 py-1.5 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-40"
              >
                {t("dash.next")}
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <EditTransactionModal transaction={editing} onClose={() => setEditId(null)} />
      )}

      {confirming && (
        <Modal onClose={() => setConfirmId(null)} labelledBy="del-title">
          <h3 id="del-title" className="text-base font-semibold">
            {t("dash.confirmTitle")}
          </h3>
          <p className="mt-1.5 text-sm text-muted">
            {t("dash.confirmBody", {
              label:
                confirming.merchant ||
                categoryDisplayName(categoryMeta(confirming.category), t),
              amount: formatCurrency(confirming.amount),
            })}
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirmId(null)}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-surface-muted"
            >
              {t("dash.cancel")}
            </button>
            <button
              onClick={async () => {
                await deleteTransaction(confirming.id);
                setConfirmId(null);
              }}
              className="rounded-lg bg-danger px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("dash.delete")}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active ? "grad-chip" : "card text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
