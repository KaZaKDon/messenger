import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ADMIN_PHONE, ADMIN_PHONE_DISPLAY } from "../../shared/config";
import { connectSocket } from "../../shared/socket";
import { authApi, AuthRequestError } from "./authApi";
import AuthBrand from "./components/AuthBrand";
import AuthTabs from "./components/AuthTabs";
import LoginForm from "./components/LoginForm";
import PendingRegistration from "./components/PendingRegistration";
import PasswordRecovery from "./components/PasswordRecovery";
import RegistrationForm from "./components/RegistrationForm";
import ThemeToggle from "./components/ThemeToggle";
import "./Phone.css";
import { getInitialAuthMode } from "./authMode";

const PENDING_KEY = "pendingRegistration";

function readPendingRegistration() {
    try {
        const value = JSON.parse(sessionStorage.getItem(PENDING_KEY));
        return value?.registrationId && value?.phone ? value : null;
    } catch {
        sessionStorage.removeItem(PENDING_KEY);
        return null;
    }
}

function savePendingRegistration(registration) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(registration));
}

function forgetPendingRegistration() {
    sessionStorage.removeItem(PENDING_KEY);
}

function pendingFromRegistration(payload, application = {}) {
    return {
        registrationId: payload.registrationId ?? payload.user?.id ?? null,
        phone: payload.phone ?? payload.user?.phone ?? application.phone ?? null,
        approvalCode: payload.approvalCode ?? null,
        expiresAt: payload.expiresAt ?? null,
        contactPhone: payload.contactPhone ?? ADMIN_PHONE,
        contactPhoneDisplay: payload.contactPhoneDisplay ?? ADMIN_PHONE_DISPLAY,
        lastName: application.lastName ?? null,
    };
}

export default function Phone({ setCurrentUser, isNightMode, setIsNightMode }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [pendingRegistration, setPendingRegistration] = useState(readPendingRegistration);
    const [mode, setMode] = useState(() => getInitialAuthMode({
        search: location.search,
        hasPendingRegistration: Boolean(readPendingRegistration()),
    }));
    const [pendingStatus, setPendingStatus] = useState("pending");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);

    const selectMode = (nextMode) => {
        setMode(nextMode);
        setError("");
        setPendingStatus("pending");
    };

    const rememberPending = (registration) => {
        savePendingRegistration(registration);
        setPendingRegistration(registration);
        setPendingStatus("pending");
        setMode("pending");
    };

    const handleLogin = async (credentials) => {
        setLoading(true);
        setError("");
        try {
            const payload = await authApi.login(credentials);
            sessionStorage.setItem("accessToken", payload.accessToken);
            sessionStorage.setItem("currentUser", JSON.stringify(payload.user));
            forgetPendingRegistration();
            setCurrentUser(payload.user);
            connectSocket().emit("auth:session", { token: payload.accessToken });
            navigate("/chat");
        } catch (requestError) {
            if (
                requestError instanceof AuthRequestError
                && requestError.status === 403
                && requestError.payload?.status === "pending"
            ) {
                rememberPending(pendingFromRegistration(requestError.payload));
            } else {
                setError(requestError.message || "Не удалось войти");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRegistration = async (application) => {
        setLoading(true);
        setError("");
        try {
            const payload = await authApi.register(application);
            rememberPending(pendingFromRegistration(payload, application));
        } catch (requestError) {
            setError(requestError.message || "Не удалось отправить заявку");
        } finally {
            setLoading(false);
        }
    };

    const checkRegistrationStatus = async () => {
        if (!pendingRegistration) return;
        setLoading(true);
        setError("");
        try {
            const payload = await authApi.registrationStatus({
                registrationId: pendingRegistration.registrationId,
                phone: pendingRegistration.phone,
                approvalCode: pendingRegistration.approvalCode,
            });
            setPendingStatus(payload.status);
            if (payload.status !== "pending") forgetPendingRegistration();
        } catch (requestError) {
            setError(requestError.message || "Не удалось проверить заявку");
        } finally {
            setLoading(false);
        }
    };

    const returnToLogin = () => {
        if (pendingStatus !== "pending") {
            setPendingRegistration(null);
            forgetPendingRegistration();
        }
        selectMode("login");
    };

    const startNewRegistration = () => {
        setPendingRegistration(null);
        forgetPendingRegistration();
        selectMode("register");
    };

    const isPendingScreen = mode === "pending" && pendingRegistration;

    return (
        <main className="auth-page">
            <ThemeToggle isNightMode={isNightMode} onChange={setIsNightMode} />
            <section className={`auth-panel ${mode === "register" ? "auth-panel-wide" : ""}`}>
                <AuthBrand isNightMode={isNightMode} />

                {!isPendingScreen ? <AuthTabs mode={mode} onChange={selectMode} /> : null}

                {isPendingScreen ? (
                    <PendingRegistration
                        registration={pendingRegistration}
                        status={pendingStatus}
                        loading={loading}
                        error={error}
                        onCheck={checkRegistrationStatus}
                        onLogin={returnToLogin}
                        onRegister={startNewRegistration}
                    />
                ) : mode === "register" ? (
                    <RegistrationForm loading={loading} error={error} onSubmit={handleRegistration} />
                ) : (
                    <LoginForm
                        loading={loading}
                        error={error}
                        onSubmit={handleLogin}
                        onForgotPassword={() => setIsRecoveryOpen(true)}
                    />
                )}
            </section>

            {isRecoveryOpen ? (
                <PasswordRecovery
                    fallbackPhone={ADMIN_PHONE}
                    fallbackPhoneDisplay={ADMIN_PHONE_DISPLAY}
                    onClose={() => setIsRecoveryOpen(false)}
                />
            ) : null}
        </main>
    );
}
