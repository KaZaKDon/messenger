import { useEffect, useState } from "react";
import { connectSocket } from "./socket";

export function useContacts(currentUserId = null) {
    const [contacts, setContacts] = useState([]);
    const [loadingState, setLoadingState] = useState(Boolean(currentUserId));

    useEffect(() => {
        if (!currentUserId) return undefined;
        const socket = connectSocket();
        let isResolved = false;

        const requestUsers = () => {
            socket.emit("users:get");
        };

        const onUsersList = (users = []) => {
            const onlyContacts = users.filter((user) => !user?.isGroup);
            setContacts(onlyContacts);
            setLoadingState(false);
            isResolved = true;
        };

        const onUsersError = () => {
            setLoadingState(false);
            isResolved = true;
        };

        socket.on("users:list", onUsersList);
        socket.on("users:error", onUsersError);
        socket.on("connect", requestUsers);
        socket.on("auth:success", requestUsers);
        requestUsers();

        const retryTimer = setInterval(() => {
            if (isResolved) return;
            requestUsers();
        }, 1500);

        return () => {
            clearInterval(retryTimer);
            socket.off("users:list", onUsersList);
            socket.off("users:error", onUsersError);
            socket.off("connect", requestUsers);
            socket.off("auth:success", requestUsers);
        };
    }, [currentUserId]);

    return {
        contacts: currentUserId ? contacts : [],
        loading: currentUserId ? loadingState : false,
    };
}
