import { useCallback, useEffect, useState } from "react";

import { fetchSupportUnreadCount, SUPPORT_REQUESTS_UPDATED_EVENT } from "./supportRequestsApi";

export function useSupportUnread(userId) {
    const [unread, setUnread] = useState(0);
    const refresh = useCallback(async () => {
        if (!userId) return setUnread(0);
        try {
            const payload = await fetchSupportUnreadCount();
            setUnread(Number(payload?.unread) || 0);
        } catch {
            setUnread(0);
        }
    }, [userId]);

    useEffect(() => {
        refresh();
        window.addEventListener(SUPPORT_REQUESTS_UPDATED_EVENT, refresh);
        return () => window.removeEventListener(SUPPORT_REQUESTS_UPDATED_EVENT, refresh);
    }, [refresh]);
    return unread;
}
