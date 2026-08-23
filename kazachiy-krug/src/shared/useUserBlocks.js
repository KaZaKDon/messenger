import { useCallback, useEffect, useMemo, useState } from "react";
import { blockContact, fetchBlockedUsers, unblockContact } from "./userBlocksApi.js";

const CHANGE_EVENT = "kazachiy:user-blocks-changed";

export function useUserBlocks(currentUserId) {
    const [blockedUsers, setBlockedUsers] = useState([]);
    const [loading, setLoading] = useState(false);

    const refresh = useCallback(async () => {
        if (!currentUserId) return;
        setLoading(true);
        try { setBlockedUsers(await fetchBlockedUsers()); }
        finally { setLoading(false); }
    }, [currentUserId]);

    useEffect(() => {
        refresh().catch(() => {});
        const listener = () => refresh().catch(() => {});
        window.addEventListener(CHANGE_EVENT, listener);
        return () => window.removeEventListener(CHANGE_EVENT, listener);
    }, [refresh]);

    const block = useCallback(async (userId) => {
        const user = await blockContact(userId);
        setBlockedUsers((items) => [user, ...items.filter((item) => item.id !== userId)]);
        window.dispatchEvent(new Event(CHANGE_EVENT));
        return user;
    }, []);

    const unblock = useCallback(async (userId) => {
        await unblockContact(userId);
        setBlockedUsers((items) => items.filter((item) => item.id !== userId));
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    const blockedIds = useMemo(() => new Set(blockedUsers.map((user) => user.id)), [blockedUsers]);
    return { blockedUsers, blockedIds, loading, block, unblock, refresh };
}
