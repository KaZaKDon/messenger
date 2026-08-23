import {  useEffect,useState } from "react";
import AppRouter from "./router";

import { connectSocket } from "../shared/socket";
import RouteSeoManager from "../shared/RouteSeoManager";

export default function App() {
    const [currentUser, setCurrentUser] = useState(() => {
        try {
            const raw = sessionStorage.getItem("currentUser");
            return raw ? JSON.parse(raw) : null;
        } catch {
            sessionStorage.removeItem("currentUser");
            return null;
        }
    });

    const [isNightMode, setIsNightMode] = useState(() => {
        try {
            return localStorage.getItem("theme") === "dark";
        } catch {
            return false;
        }
    });


    useEffect(() => {
        try {
            if (currentUser?.id) {
                sessionStorage.setItem("currentUser", JSON.stringify(currentUser));
            } else {
                sessionStorage.removeItem("currentUser");
            }
        } catch {
            // ignore storage errors
        }
    }, [currentUser]);

    useEffect(() => {
        if (!currentUser?.id) return;
        const token = sessionStorage.getItem("accessToken");
        if (!token) return;
        const socket = connectSocket();
        socket.emit("auth:session", { token });
    }, [currentUser]);

    useEffect(() => {
        const theme = isNightMode ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", theme);

        try {
            localStorage.setItem("theme", theme);
        } catch {
            // ignore storage errors
        }
    }, [isNightMode]);



    return (
        <div className="app">
            <RouteSeoManager />
            <AppRouter
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                isNightMode={isNightMode}
                setIsNightMode={setIsNightMode}
            />
        </div>
    );
}
