import { useMemo, useState } from "react";

import { validPaymentDraft } from "../paymentManagementModel";

function dateValue(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 10);
}

function initialDraft() {
    const now = new Date();
    const end = new Date(now); end.setMonth(end.getMonth() + 1);
    return {
        chatId: "", ownerId: "", amount: "", paidAt: new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16),
        periodStartsAt: dateValue(now), periodEndsAt: dateValue(end), comment: "",
    };
}

export default function PaymentCreateDialog({ groups, users, processing, error, onCreate, onClose }) {
    const [draft, setDraft] = useState(initialDraft);
    const selectedGroup = useMemo(() => groups.find((group) => group.chatId === draft.chatId), [draft.chatId, groups]);
    const changeGroup = (chatId) => {
        const group = groups.find((item) => item.chatId === chatId);
        setDraft((current) => ({ ...current, chatId, ownerId: group?.owner?.id || "" }));
    };
    return <div className="admin-payment-modal" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !processing && onClose()}><form className="admin-payment-dialog" onSubmit={(event) => { event.preventDefault(); if (validPaymentDraft(draft)) onCreate(draft); }}><header><div><span>Внутренняя запись</span><h2>Зафиксировать оплату</h2></div><button type="button" onClick={onClose} disabled={processing}>×</button></header><label>Платная группа<select required value={draft.chatId} onChange={(event) => changeGroup(event.target.value)}><option value="">Выберите группу</option>{groups.map((group) => <option key={group.chatId} value={group.chatId}>{group.title}</option>)}</select></label><label>Кто оплатил<select required value={draft.ownerId} onChange={(event) => setDraft({ ...draft, ownerId: event.target.value })}><option value="">Выберите пользователя</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.phone} · {user.phone}</option>)}</select></label>{selectedGroup && !selectedGroup.owner ? <small className="admin-payment-hint">У группы пока не назначен владелец. Выбранный плательщик сохранится в записи, но владельца группы нужно назначить отдельно в разделе «Группы».</small> : null}<div className="admin-payment-fields"><label>Сумма, ₽<input required inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} placeholder="1500" /></label><label>Дата оплаты<input required type="datetime-local" value={draft.paidAt} onChange={(event) => setDraft({ ...draft, paidAt: event.target.value })} /></label><label>Период с<input required type="date" value={draft.periodStartsAt} onChange={(event) => setDraft({ ...draft, periodStartsAt: event.target.value })} /></label><label>Период по<input required type="date" value={draft.periodEndsAt} onChange={(event) => setDraft({ ...draft, periodEndsAt: event.target.value })} /></label></div><label>Комментарий<textarea maxLength={1000} value={draft.comment} onChange={(event) => setDraft({ ...draft, comment: event.target.value })} placeholder="Договорённость, номер договора или примечание" /></label>{error ? <p className="admin-payment-error">{error}</p> : null}<footer><button type="button" onClick={onClose} disabled={processing}>Отмена</button><button type="submit" className="primary" disabled={processing || !validPaymentDraft(draft)}>{processing ? "Сохраняем…" : "Сохранить запись"}</button></footer></form></div>;
}
