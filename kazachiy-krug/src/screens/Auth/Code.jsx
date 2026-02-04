import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../../shared/socket";

import "./auth.css";
import "../../styles/variables.css";
import img from "./logo-icon.jpg";

export default function Code({ setCurrentUser }) {
    const navigate = useNavigate();

    useEffect(() => {
        const socket = connectSocket();

        const onAuthSuccess = (user) => {
            console.log("✅ AUTH SUCCESS:", user);

            setCurrentUser(user);
            localStorage.setItem("currentUser", JSON.stringify(user));

            navigate("/chat");
        };

        const onAuthError = (err) => {
            console.error("AUTH ERROR:", err?.message || err);
        };

        socket.on("auth:success", onAuthSuccess);
        socket.on("auth:error", onAuthError);

        return () => {
            socket.off("auth:success", onAuthSuccess);
            socket.off("auth:error", onAuthError);
        };
    }, [navigate, setCurrentUser]);

    const handleConfirm = () => {
        const phone = localStorage.getItem("phone");
        const socket = connectSocket();

        console.log("📤 SEND AUTH PHONE:", phone);

        // 🔥 ВАЖНО: отправляем СРАЗУ
        socket.emit("auth:phone", { phone });
    };

    return (
        <section className="auth-card">
            <div className="second">
                <img className="auth-logo" src={img} alt="logo" />

                <h1 className="auth-title">Введите код</h1>

                <div className="code-inputs">
                    <input maxLength="1" />
                    <input maxLength="1" />
                    <input maxLength="1" />
                    <input maxLength="1" />
                </div>

                <button className="auth-button" onClick={handleConfirm}>
                    Подтвердить
                </button>
            </div>
        </section>
    );
}