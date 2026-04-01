import { useEffect, useState } from "react";
import { connectSocket } from "./socket";

export function useContacts() {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const socket = connectSocket();

        const requestUsers = () => {
            socket.emit("users:get");
        };

        const onUsersList = (users = []) => {
            const onlyContacts = users.filter((user) => !user?.isGroup);
            setContacts(onlyContacts);
            setLoading(false);
        };

        const onUsersError = () => {
            setLoading(false);
        };

        socket.on("users:list", onUsersList);
        socket.on("users:error", onUsersError);
        socket.on("connect", requestUsers);
        socket.on("auth:success", requestUsers);
        requestUsers();

        return () => {
            socket.off("users:list", onUsersList);
            socket.off("users:error", onUsersError);
            socket.off("connect", requestUsers);
            socket.off("auth:success", requestUsers);
        };
    }, []);

    return { contacts, loading };
}
