import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppSidebar from "../components/AppSidebar/AppSidebar";
import { connectSocket } from "../shared/socket";
import "./AppFrame.css";

const DRAWER_BREAKPOINT = 1199;

export default function AppFrame({ currentUser, isNightMode, setIsNightMode, children }) {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
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
            setIncomingCall({
                callId: payload.callId ?? null,
                chatId: payload.chatId ?? null,
                fromUserId: payload.fromUserId ?? null,
                type: payload.type ?? "audio",
                status: payload.status ?? "ringing",
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
    }, [currentUser?.id]);

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

        if (incomingCall?.status === "ringing") {
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
    }, [incomingCall?.status]);

    const handleAcceptIncoming = () => {
        if (!incomingCall?.callId) return;
        connectSocket().emit("call:accept", { callId: incomingCall.callId });
        if (incomingCall.fromUserId) {
            navigate(`/chat?user=${encodeURIComponent(incomingCall.fromUserId)}`);
        } else {
            navigate("/chat");
        }
        setIncomingCall(null);
    };

    const handleDeclineIncoming = () => {
        if (!incomingCall?.callId) return;
        connectSocket().emit("call:decline", { callId: incomingCall.callId, reason: "declined" });
        setIncomingCall(null);
    };

    return (
        <div className="app-frame">
            <button
                type="button"
                className="app-frame-drawer-button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Открыть меню"
                aria-expanded={isSidebarOpen}
            >
                ☰
            </button>

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
            />

            <main className="app-frame-content">{children}</main>

            {incomingCall ? (
                <div className="incoming-call-modal" role="dialog" aria-modal="true">
                    <strong>{incomingCall.type === "video" ? "🎥 Входящий видеозвонок" : "📞 Входящий аудиозвонок"}</strong>
                    <span>{incomingCall.fromUserId ? `От: ${incomingCall.fromUserId}` : "Входящий звонок"}</span>
                    <div className="incoming-call-actions">
                        <button type="button" onClick={handleAcceptIncoming}>Принять</button>
                        <button type="button" onClick={handleDeclineIncoming}>Отклонить</button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
