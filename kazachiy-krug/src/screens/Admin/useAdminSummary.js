import { useCallback, useEffect, useState } from "react";
import { fetchAdminSummary } from "./adminApi";

export function useAdminSummary(role) {
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const refresh = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            setSummary(await fetchAdminSummary(role));
        } catch (requestError) {
            setError(requestError.message);
        } finally {
            setLoading(false);
        }
    }, [role]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { summary, loading, error, refresh };
}

