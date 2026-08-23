import { useCallback, useEffect, useMemo, useState } from "react";

import PaymentCreateDialog from "./components/PaymentCreateDialog";
import { fetchPaymentManagementData, recordPayment, voidPayment } from "./paymentAdminApi";
import { effectivePaymentState, filterPayments, formatRubles, paymentCounters } from "./paymentManagementModel";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./adminPayments.css";

const STATE_LABELS = { active: "Действует", expiring: "Истекает", expired: "Истёк", voided: "Отменена", upcoming: "Начнётся" };
const formatDate = (value) => value ? new Date(value).toLocaleDateString("ru-RU") : "—";

export default function AdminPayments() {
    const [data, setData] = useState({ payments: [], groups: [], users: [] });
    const [query, setQuery] = useState("");
    const [state, setState] = useState("all");
    const [creating, setCreating] = useState(false);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { setData(await fetchPaymentManagementData()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);
    const counters = useMemo(() => paymentCounters(data.payments), [data.payments]);
    const visible = useMemo(() => filterPayments(data.payments, { query, state }), [data.payments, query, state]);

    const run = async (action, closeDialog = false) => {
        setProcessing(true); setError("");
        try { await action(); if (closeDialog) setCreating(false); await Promise.all([load(), refreshSummary()]); }
        catch (requestError) { setError(requestError.message); }
        finally { setProcessing(false); }
    };
    const cancel = (payment) => {
        const reason = window.prompt("Укажите причину отмены записи об оплате:", "");
        if (reason === null) return;
        run(() => voidPayment(payment.id, reason));
    };

    const counterItems = [["all", "Всего", counters.total], ["active", "Действуют", counters.active], ["expiring", "Истекают", counters.expiring], ["expired", "Истекли", counters.expired], ["voided", "Отменены", counters.voided]];
    return <section className="admin-scaffold-page admin-payments-page"><header className="admin-scaffold-header"><div><h1>Оплата</h1><p>Внутренний журнал договорных оплат за рекламные и коммерческие группы.</p></div><button type="button" onClick={() => { setError(""); setCreating(true); }}>+ Зафиксировать оплату</button></header><div className="admin-payment-counters">{counterItems.map(([id, label, value]) => <button key={id} type="button" className={state === id ? "active" : ""} onClick={() => setState(id)}><span>{label}</span><strong>{loading ? "…" : value}</strong></button>)}</div><div className="admin-payment-toolbar"><label><span>⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Группа, владелец, телефон или комментарий" /></label><select value={state} onChange={(event) => setState(event.target.value)}><option value="all">Все состояния</option><option value="active">Действуют</option><option value="expiring">Истекают за 7 дней</option><option value="upcoming">Ещё не начались</option><option value="expired">Истекли</option><option value="voided">Отменены</option></select><button type="button" onClick={load} disabled={loading}>Обновить</button></div>{error && !creating ? <p className="admin-payment-error" role="alert">{error}</p> : null}<div className="admin-payment-table-wrap"><table className="admin-payment-table"><thead><tr><th>Группа и плательщик</th><th>Сумма</th><th>Оплаченный период</th><th>Получено</th><th>Состояние</th><th></th></tr></thead><tbody>{visible.map((payment) => { const currentState = effectivePaymentState(payment); return <tr key={payment.id}><td data-label="Группа"><strong>{payment.groupRule?.chat?.title || payment.chatId}</strong><span>{payment.owner?.name || "Владелец не указан"}</span><small>{payment.owner?.phone || payment.comment || "—"}</small></td><td data-label="Сумма"><strong>{formatRubles(payment.amount)}</strong>{payment.comment ? <small>{payment.comment}</small> : null}</td><td data-label="Период"><span>{formatDate(payment.periodStartsAt)} — {formatDate(payment.periodEndsAt)}</span></td><td data-label="Получено"><span>{formatDate(payment.paidAt)}</span><small>{payment.recordedBy?.name ? `Внёс: ${payment.recordedBy.name}` : ""}</small></td><td data-label="Состояние"><span className={`admin-payment-status status-${currentState}`}>{STATE_LABELS[currentState]}</span>{payment.voidReason ? <small>{payment.voidReason}</small> : null}</td><td className="admin-payment-action">{payment.status !== "voided" ? <button type="button" onClick={() => cancel(payment)} disabled={processing}>Отменить запись</button> : null}</td></tr>; })}</tbody></table>{loading ? <p className="admin-payment-empty">Загрузка оплат…</p> : null}{!loading && visible.length === 0 ? <p className="admin-payment-empty">Записи не найдены.</p> : null}</div>{creating ? <PaymentCreateDialog groups={data.groups} users={data.users} processing={processing} error={error} onCreate={(draft) => run(() => recordPayment(draft), true)} onClose={() => !processing && setCreating(false)} /> : null}</section>;
}
