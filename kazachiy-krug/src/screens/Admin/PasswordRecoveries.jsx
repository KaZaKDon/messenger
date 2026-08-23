import { useCallback, useEffect, useState } from "react";

import PasswordRecoveryCard from "./components/PasswordRecoveryCard";
import RejectPasswordRecoveryModal from "./components/RejectPasswordRecoveryModal";
import { decidePasswordRecovery, fetchPasswordRecoveries } from "./passwordRecoveryAdminApi";
import { useAdminSummaryContext } from "./adminSummaryContext";
import "./admin.css";

export default function PasswordRecoveries() {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [rejectionRequest, setRejectionRequest] = useState(null);
    const [error, setError] = useState("");
    const { refresh: refreshSummary } = useAdminSummaryContext();

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try { setRequests(await fetchPasswordRecoveries()); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const decide = async (request, decision, reason = null) => {
        setProcessingId(request.id);
        setError("");
        try {
            await decidePasswordRecovery(request.id, decision, reason);
            await Promise.all([load(), refreshSummary()]);
            return true;
        } catch (requestError) {
            setError(requestError.message);
            return false;
        } finally {
            setProcessingId(null);
        }
    };

    return <section className="admin-page"><header className="admin-header"><div><h1>Восстановление пароля</h1><p>Сверьте фамилию, код заявки и номер входящего звонка.</p></div><button type="button" onClick={load} disabled={loading}>Обновить</button></header>{error ? <p className="admin-error" role="alert">{error}</p> : null}{loading ? <p>Загрузка…</p> : null}{!loading && requests.length === 0 ? <p className="admin-empty">Активных заявок нет.</p> : null}<div className="admin-registration-list">{requests.map((request) => <PasswordRecoveryCard key={request.id} request={request} processing={processingId === request.id} onApprove={(item) => decide(item, "approve")} onReject={setRejectionRequest} />)}</div>{rejectionRequest ? <RejectPasswordRecoveryModal request={rejectionRequest} processing={processingId === rejectionRequest.id} onClose={() => setRejectionRequest(null)} onConfirm={(item, reason) => decide(item, "reject", reason)} /> : null}</section>;
}
