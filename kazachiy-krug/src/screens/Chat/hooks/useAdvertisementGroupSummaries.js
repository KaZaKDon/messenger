import { useCallback, useEffect, useMemo, useState } from "react";
import {
    fetchAdvertisementGroupSummaries,
    markAdvertisementGroupRead,
} from "../../../shared/advertisementsApi";
import { getSocket } from "../../../shared/socket";

export function useAdvertisementGroupSummaries({ currentUserId, activeGroupId }) {
    const [summaries, setSummaries] = useState([]);

    const refresh = useCallback(async () => {
        if (!currentUserId) return;
        try {
            setSummaries(await fetchAdvertisementGroupSummaries());
        } catch (error) {
            console.error("Не удалось обновить счётчики объявлений:", error);
        }
    }, [currentUserId]);

    useEffect(() => {
        refresh();
        const onFocus = () => refresh();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [refresh]);

    useEffect(() => {
        const socket = getSocket();
        if (!socket) return undefined;
        const onChanged = () => refresh();
        socket.on("advertisement:changed", onChanged);
        socket.on("connect", onChanged);
        return () => {
            socket.off("advertisement:changed", onChanged);
            socket.off("connect", onChanged);
        };
    }, [refresh]);

    useEffect(() => {
        if (!activeGroupId || !summaries.some((summary) => summary.chatId === activeGroupId)) return;
        const summary = summaries.find((item) => item.chatId === activeGroupId);
        if (!summary?.unread) return;

        setSummaries((current) => current.map((item) => (
            item.chatId === activeGroupId ? { ...item, unread: 0 } : item
        )));
        markAdvertisementGroupRead(activeGroupId).catch((error) => {
            console.error("Не удалось отметить объявления прочитанными:", error);
            refresh();
        });
    }, [activeGroupId, refresh, summaries]);

    return useMemo(
        () => Object.fromEntries(summaries.map((summary) => [summary.chatId, summary])),
        [summaries]
    );
}
