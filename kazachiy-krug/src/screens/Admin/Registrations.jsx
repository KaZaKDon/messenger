import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../shared/config";
import "./admin.css";

export default function Registrations() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const token = sessionStorage.getItem("accessToken");
            const response = await fetch(`${API_BASE_URL}/admin/registrations`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Не удалось загрузить заявки");
            setRequests(payload);
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRequests();
    }, [loadRequests]);

    const decide = async (userId, decision) => {
        setError("");
        try {
            const token = sessionStorage.getItem("accessToken");
            const response = await fetch(`${API_BASE_URL}/admin/registrations/${encodeURIComponent(userId)}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ decision }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Не удалось обработать заявку");
            setRequests((current) => current.filter((request) => request.id !== userId));
        } catch (requestError) {
            setError(requestError.message);
        }
    };

    return (
        <section className="admin-page">
            <header className="admin-header">
                <div>
                    <h1>Заявки на регистрацию</h1>
                    <p>Сверьте код и номер входящего звонка перед подтверждением.</p>
                </div>
                <button type="button" onClick={loadRequests}>Обновить</button>
            </header>

            {error && <p className="admin-error" role="alert">{error}</p>}
            {loading && <p>Загрузка…</p>}
            {!loading && requests.length === 0 && <p className="admin-empty">Новых заявок нет.</p>}

            <div className="admin-registration-list">
                {requests.map((request) => (
                    <article className="admin-registration-card" key={request.id}>
                        <div>
                            <h2>{request.name}</h2>
                            <p><span>Логин:</span> {request.login}</p>
                            <p><span>Телефон:</span> <a href={`tel:${request.phone}`}>{request.phone}</a></p>
                            <p><span>Код:</span> <strong>{request.approvalCode}</strong></p>
                            <p><span>Создана:</span> {new Date(request.createdAt).toLocaleString("ru-RU")}</p>
                        </div>
                        <div className="admin-registration-actions">
                            <button className="approve" type="button" onClick={() => decide(request.id, "approve")}>Подтвердить</button>
                            <button className="reject" type="button" onClick={() => decide(request.id, "reject")}>Отклонить</button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}