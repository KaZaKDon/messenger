import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "../../shared/config";
import RegistrationCard from "./components/RegistrationCard";
import RejectRegistrationModal from "./components/RejectRegistrationModal";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./admin.css";

async function fetchRegistrationRequests() {
    const token = sessionStorage.getItem("accessToken");
    const response = await fetch(`${API_BASE_URL}/admin/registrations`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Не удалось загрузить заявки");
    return payload;
}

export default function Registrations() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [processingId, setProcessingId] = useState(null);
    const [rejectionRequest, setRejectionRequest] = useState(null);
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const loadRequests = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setRequests(await fetchRegistrationRequests());
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;

        fetchRegistrationRequests()
            .then((payload) => {
                if (active) setRequests(payload);
            })
            .catch((requestError) => {
                if (active) setError(requestError.message);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const decide = async (request, decision, reason = null) => {
        setError("");
        setProcessingId(request.id);
        try {
            const token = sessionStorage.getItem("accessToken");
            const response = await fetch(`${API_BASE_URL}/admin/registrations/${encodeURIComponent(request.id)}`, {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ decision, reason }),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || "Не удалось обработать заявку");
            setRequests((current) => current.filter((item) => item.id !== request.id));
            await refreshSummary();
            return true;
        } catch (requestError) {
            setError(requestError.message);
            return false;
        } finally {
            setProcessingId(null);
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
                    <RegistrationCard
                        key={request.id}
                        request={request}
                        processing={processingId === request.id}
                        onApprove={(item) => decide(item, "approve")}
                        onReject={setRejectionRequest}
                    />
                ))}
            </div>

            {rejectionRequest ? (
                <RejectRegistrationModal
                    key={rejectionRequest.id}
                    request={rejectionRequest}
                    processing={processingId === rejectionRequest.id}
                    onClose={() => setRejectionRequest(null)}
                    onConfirm={(item, reason) => decide(item, "reject", reason)}
                />
            ) : null}
        </section>
    );
}
