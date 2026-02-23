import { useEffect, useState } from "react";
import AppRouter from "./router";
import { connectSocket } from "../shared/socket";

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

    const [phone, setPhone] = useState(() => {
        try {
            return sessionStorage.getItem("phone") ?? "";
        } catch {
            sessionStorage.removeItem("phone");
            return "";
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
        try {
            if (phone) {
                sessionStorage.setItem("phone", phone);
            } else {
                sessionStorage.removeItem("phone");
            }
        } catch {
            // ignore storage errors
        }
    }, [phone]);

    useEffect(() => {
        if (!currentUser?.id) return;
        const socket = connectSocket();
        socket.emit("auth:restore", {
            userId: currentUser.id,
            name: currentUser.name,
        });
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
            <AppRouter
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
                phone={phone}
                setPhone={setPhone}
                isNightMode={isNightMode}
                setIsNightMode={setIsNightMode}
            />
        </div>
    );
}
