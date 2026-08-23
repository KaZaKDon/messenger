import { useEffect, useMemo, useRef, useState } from "react";
import { connectSocket } from "./socket.js";
import {
    ACTIVE_CHAT_EVENT,
    applyIncomingUnread,
    getAnnouncedActiveChat,
    totalUnread,
    unreadMapFromDialogs,
} from "./messengerNotifications.js";
import { useNotificationPreferences } from "./useNotificationPreferences.js";
import { showBrowserNotification } from "./browserNotifications.js";

function playMessageChime(audioContextRef) {
    try {
        const ctx = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") ctx.resume().catch(() => {});
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
        gain.connect(ctx.destination);
        [660, 880].forEach((frequency, index) => {
            const oscillator = ctx.createOscillator();
            oscillator.type = "sine";
            oscillator.frequency.value = frequency;
            oscillator.connect(gain);
            oscillator.start(ctx.currentTime + index * 0.08);
            oscillator.stop(ctx.currentTime + 0.28);
        });
    } catch {
        // Some browsers do not expose Web Audio until the first user gesture.
    }
}

export function useMessengerNotifications(currentUserId) {
    const { preferences } = useNotificationPreferences();
    const [unreadByChat, setUnreadByChat] = useState({});
    const activeChatIdRef = useRef(getAnnouncedActiveChat());
    const audioContextRef = useRef(null);

    useEffect(() => {
        const unlockAudio = () => {
            try {
                audioContextRef.current ??= new AudioContext();
                audioContextRef.current.resume().catch(() => {});
            } catch { /* Web Audio is optional. */ }
        };
        window.addEventListener("pointerdown", unlockAudio, { once: true });
        return () => window.removeEventListener("pointerdown", unlockAudio);
    }, []);

    useEffect(() => {
        if (!currentUserId) return undefined;
        const socket = connectSocket();

        const requestDialogs = () => socket.emit("chats:get");
        const onDialogs = (dialogs) => setUnreadByChat(unreadMapFromDialogs(dialogs));
        const onActiveChat = (event) => {
            const chatId = event.detail?.chatId ?? null;
            activeChatIdRef.current = chatId;
            if (chatId?.startsWith?.("room-")) {
                setUnreadByChat((current) => ({ ...current, [chatId]: 0 }));
            }
        };
        const onMessage = (message) => {
            const shouldNotify = message?.chatId?.startsWith?.("room-")
                && message.senderId !== currentUserId
                && message.chatId !== activeChatIdRef.current;
            setUnreadByChat((current) => applyIncomingUnread(
                current,
                message,
                currentUserId,
                activeChatIdRef.current
            ));
            if (shouldNotify && preferences.messageSound) playMessageChime(audioContextRef);
            if (shouldNotify) {
                const senderName = String(message?.senderName || "пользователя").trim() || "пользователя";
                showBrowserNotification({
                    title: `Вам сообщение от ${senderName}`,
                    tag: `message-${message.chatId}`,
                    enabled: preferences.messageBrowser,
                    onClick: () => {
                        if (message?.senderId) {
                            window.location.assign(`/chat?user=${encodeURIComponent(message.senderId)}`);
                        }
                    },
                });
            }
        };

        socket.on("chats:list", onDialogs);
        socket.on("message:new", onMessage);
        socket.on("connect", requestDialogs);
        socket.on("auth:success", requestDialogs);
        window.addEventListener(ACTIVE_CHAT_EVENT, onActiveChat);
        requestDialogs();

        return () => {
            socket.off("chats:list", onDialogs);
            socket.off("message:new", onMessage);
            socket.off("connect", requestDialogs);
            socket.off("auth:success", requestDialogs);
            window.removeEventListener(ACTIVE_CHAT_EVENT, onActiveChat);
        };
    }, [currentUserId, preferences.messageBrowser, preferences.messageSound]);

    return useMemo(() => totalUnread(unreadByChat), [unreadByChat]);
}
