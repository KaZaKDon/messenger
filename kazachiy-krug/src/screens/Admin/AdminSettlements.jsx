import { useCallback, useEffect, useMemo, useState } from "react";
import { createManagedSettlement, fetchManagedSettlements, updateManagedSettlement } from "./settlementAdminApi";
import "./adminSettlements.css";

export default function AdminSettlements() {
    const [settlements, setSettlements] = useState([]);
    const [query, setQuery] = useState("");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const load = useCallback(async () => {
        setLoading(true); setError("");
        try { setSettlements(await fetchManagedSettlements()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return needle ? settlements.filter((item) => item.name.toLowerCase().includes(needle)) : settlements;
    }, [query, settlements]);

    const add = async (event) => {
        event.preventDefault();
        if (!name.trim()) return;
        try { await createManagedSettlement(name); setName(""); await load(); }
        catch (requestError) { setError(requestError.message); }
    };

    const rename = async (settlement) => {
        const nextName = window.prompt("Новое название", settlement.name);
        if (!nextName || nextName.trim() === settlement.name) return;
        try { await updateManagedSettlement(settlement.id, { name: nextName }); await load(); }
        catch (requestError) { setError(requestError.message); }
    };

    const toggle = async (settlement) => {
        try { await updateManagedSettlement(settlement.id, { isActive: !settlement.isActive }); await load(); }
        catch (requestError) { setError(requestError.message); }
    };

    return (
        <section className="admin-settlements-page">
            <header><div><h1>Населённые пункты</h1><p>Справочник вариантов для формы объявления.</p></div><button type="button" onClick={load}>Обновить</button></header>
            <form onSubmit={add} className="admin-settlement-add">
                <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название населённого пункта" maxLength={120} />
                <button type="submit">Добавить</button>
            </form>
            <input className="admin-settlement-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" />
            {error ? <p role="alert" className="admin-settlement-error">{error}</p> : null}
            <div className="admin-settlement-list">
                {visible.map((settlement) => (
                    <article key={settlement.id}>
                        <div><strong>{settlement.name}</strong><small>{settlement.isActive ? "Активен" : "Отключён"}</small></div>
                        <div><button type="button" onClick={() => rename(settlement)}>Переименовать</button><button type="button" onClick={() => toggle(settlement)}>{settlement.isActive ? "Отключить" : "Включить"}</button></div>
                    </article>
                ))}
                {loading ? <p>Загрузка…</p> : null}
                {!loading && visible.length === 0 ? <p>Населённые пункты не найдены.</p> : null}
            </div>
        </section>
    );
}
