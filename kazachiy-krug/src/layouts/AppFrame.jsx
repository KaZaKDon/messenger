import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "../components/AppSidebar/AppSidebar";
import { connectSocket } from "../shared/socket";
import { useContacts } from "../shared/useContacts";
import { useMessengerNotifications } from "../shared/useMessengerNotifications";
import { useNotificationPreferences } from "../shared/useNotificationPreferences";
import { showBrowserNotification } from "../shared/browserNotifications";
import logoDark from "../assets/branding/kazachiy-krug-kvk-simplified-dark.png";
import logoLight from "../assets/branding/kazachiy-krug-kvk-detailed.png";
import "./AppFrame.css";

const DRAWER_BREAKPOINT = 1199;

export default function AppFrame({ currentUser, isNightMode, setIsNightMode, children }) {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const { contacts } = useContacts(currentUser?.id);
    const personalUnreadCount = useMessengerNotifications(currentUser?.id);
    const { preferences } = useNotificationPreferences();
    const mobileLogo = isNightMode ? logoDark : logoLight;
    const incomingContact = contacts.find((contact) => contact.id === incomingCall?.fromUserId) ?? null;
    const ringtoneAudioContextRef = useRef(null);
    const ringtoneTimerRef = useRef(null);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > DRAWER_BREAKPOINT) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === "Escape") {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    useEffect(() => {
        if (!isSidebarOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isSidebarOpen]);

    const closeSidebar = () => setIsSidebarOpen(false);

    useEffect(() => {
        if (!currentUser?.id) return undefined;
        const socket = connectSocket();
        if (!socket) return undefined;

        const onIncomingCall = (payload = {}) => {
            const caller = contacts.find((contact) => contact.id === payload.fromUserId);
            setIncomingCall({
                callId: payload.callId ?? null,
                chatId: payload.chatId ?? null,
                fromUserId: payload.fromUserId ?? null,
                type: payload.type ?? "audio",
                status: payload.status ?? "ringing",
            });
            showBrowserNotification({
                title: `Входящий звонок от ${caller?.name ?? "пользователя"}`,
                tag: `call-${payload.callId ?? payload.fromUserId ?? "incoming"}`,
                enabled: preferences.callBrowser,
                onClick: () => {
                    if (payload.fromUserId) {
                        navigate(`/chat?user=${encodeURIComponent(payload.fromUserId)}`);
                    } else {
                        navigate("/chat");
                    }
                },
            });
        };

        const onCallClosed = (payload = {}) => {
            setIncomingCall((prev) => (prev?.callId === payload.callId ? null : prev));
        };

        socket.on("call:incoming", onIncomingCall);
        socket.on("call:declined", onCallClosed);
        socket.on("call:ended", onCallClosed);
        socket.on("call:accepted", onCallClosed);

        return () => {
            socket.off("call:incoming", onIncomingCall);
            socket.off("call:declined", onCallClosed);
            socket.off("call:ended", onCallClosed);
            socket.off("call:accepted", onCallClosed);
        };
    }, [contacts, currentUser?.id, navigate, preferences.callBrowser]);

    useEffect(() => {
        const stopRingtone = () => {
            if (ringtoneTimerRef.current) {
                clearInterval(ringtoneTimerRef.current);
                ringtoneTimerRef.current = null;
            }
            if (ringtoneAudioContextRef.current) {
                ringtoneAudioContextRef.current.close().catch(() => {});
                ringtoneAudioContextRef.current = null;
            }
        };

        const playBeep = () => {
            if (!ringtoneAudioContextRef.current) return;
            const ctx = ringtoneAudioContextRef.current;
            if (ctx.state === "suspended") {
                ctx.resume().catch(() => {});
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = 880;
            gain.gain.value = 0.08;
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.24);
        };

        if (incomingCall?.status === "ringing" && preferences.callSound) {
            if (!ringtoneAudioContextRef.current) {
                try {
                    ringtoneAudioContextRef.current = new AudioContext();
                } catch {
                    return stopRingtone;
                }
            }
            playBeep();
            if (!ringtoneTimerRef.current) {
                ringtoneTimerRef.current = setInterval(playBeep, 1100);
            }
            return stopRingtone;
        }

        stopRingtone();
        return stopRingtone;
    }, [incomingCall?.status, preferences.callSound]);

    const handleAcceptIncoming = () => {
        if (!incomingCall?.callId) return;
        if (incomingCall.fromUserId) {
            navigate(`/chat?user=${encodeURIComponent(incomingCall.fromUserId)}`, {
                state: {
                    acceptedCall: {
                        ...incomingCall,
                        status: "ringing",
                        direction: "incoming",
                        initiatorId: incomingCall.fromUserId,
                        startedAt: null,
                        autoAccept: true,
                    },
                },
            });
        } else {
            navigate("/chat");
        }
    };

    const handleDeclineIncoming = () => {
        if (!incomingCall?.callId) return;
        connectSocket().emit("call:decline", { callId: incomingCall.callId, reason: "declined" });
        setIncomingCall(null);
    };

    return (
        <div className="app-frame">
            <header className="app-frame-mobile-bar">
                <button
                    type="button"
                    className="app-frame-drawer-button"
                    onClick={() => setIsSidebarOpen(true)}
                    aria-label="Открыть меню"
                    aria-expanded={isSidebarOpen}
                >
                    ☰
                </button>
                <img className="app-frame-mobile-logo" src={mobileLogo} alt="Казачий круг" />
            </header>

            {isSidebarOpen ? (
                <button
                    type="button"
                    className="app-frame-backdrop"
                    onClick={closeSidebar}
                    aria-label="Закрыть меню"
                />
            ) : null}

            <AppSidebar
                currentUser={currentUser}
                isNightMode={isNightMode}
                onNightModeChange={setIsNightMode}
                isOpen={isSidebarOpen}
                onNavigate={closeSidebar}
                personalUnreadCount={personalUnreadCount}
            />

            <main className="app-frame-content">{children}</main>

            {incomingCall ? (
                <div className="incoming-call-modal" role="dialog" aria-modal="true">
                    <div className="incoming-call-avatar">
                        {incomingContact?.avatar ? <img src={incomingContact.avatar} alt="" /> : String(incomingContact?.name || "?").slice(0, 1).toUpperCase()}
                    </div>
                    <strong>{incomingCall.type === "video" ? "🎥 Входящий видеозвонок" : "📞 Входящий аудиозвонок"}</strong>
                    <span>{incomingContact?.name ?? "Входящий звонок"}</span>
                    <div className="incoming-call-actions">
                        <button type="button" onClick={handleAcceptIncoming}>Принять</button>
                        <button type="button" onClick={handleDeclineIncoming}>Отклонить</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
