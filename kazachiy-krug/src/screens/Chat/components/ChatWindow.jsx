import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import AnnouncementComposer from "./AnnouncementComposer";
import AnnouncementCard from "./AnnouncementCard";
import { connectSocket, getSocket } from "/src/shared/socket";
import { API_BASE_URL } from "../../../shared/config";
import { authHeaders } from "../../../shared/authHeaders";
import { readApiError } from "../../../shared/apiError";
import { createAdvertisement, fetchAdvertisements } from "../../../shared/advertisementsApi";
import { acquireCallMedia } from "../../../shared/callMedia";
import { scheduleLatestViewport } from "../chatViewport";

const VOICE_MIME_CANDIDATES = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/ogg",
];
const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
const CALL_DEBUG_ENABLED = import.meta.env.VITE_CALL_DEBUG === "1";

function resolveIceServers() {
    const raw = import.meta.env.VITE_WEBRTC_ICE_SERVERS;
    if (!raw) {
        return DEFAULT_ICE_SERVERS;
    }

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            console.warn("VITE_WEBRTC_ICE_SERVERS is invalid. Fallback to default STUN.");
            return DEFAULT_ICE_SERVERS;
        }

        const hasTurn = parsed.some((entry) => {
            const urls = entry?.urls;
            if (typeof urls === "string") return urls.startsWith("turn:");
            if (Array.isArray(urls)) return urls.some((url) => typeof url === "string" && url.startsWith("turn:"));
            return false;
        });
        if (!hasTurn) {
            console.warn("WebRTC ICE config has no TURN server. Calls may fail across strict NAT.");
        }
        return parsed;
    } catch {
        console.warn("Failed to parse VITE_WEBRTC_ICE_SERVERS. Fallback to default STUN.");
        return DEFAULT_ICE_SERVERS;
    }
}

function getSupportedVoiceMimeType() {
    if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
        return "";
    }

    return VOICE_MIME_CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function formatVoiceDuration(totalMs) {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function formatCallDuration(totalSeconds) {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
    const ss = String(seconds % 60).padStart(2, "0");
    return `${mm}:${ss}`;
}

function mapCallErrorMessage(code, message) {
    if (code === "CALL_ALREADY_EXISTS_ACTIVE") {
        return "В этом чате уже есть активный звонок";
    }
    return message ?? "Ошибка звонка";
}

function getCallStatusLabel(status) {
    if (status === "initiated") return "Инициализация соединения";
    if (status === "ringing") return "Идёт вызов";
    if (status === "connected") return "Соединение установлено";
    if (status === "ended") return "Звонок завершён";
    return status ?? "Неизвестный статус";
}

function mapCallEndMessage(endedReason) {
    if (endedReason === "timeout") {
        return "Не удалось подключиться: абонент не ответил или не в сети.";
    }
    if (endedReason === "declined") {
        return "Абонент отклонил звонок.";
    }
    if (endedReason === "hangup") {
        return "";
    }
    return endedReason ? `Звонок завершён (${endedReason}).` : "";
}


export default function ChatWindow({
    chat,
    activeUser,
    hasSelectedChat,
    currentUserId,
    onSend,
    onDraftChange,
    onTypingStart,
    onTypingStop,
    onWriteToAuthor, // ✅ новый колбэк
    onLoadOlderMessages,
    onStartCall,
    onDeleteChat,
    isContactBlocked = false,
    onBlockContact,
    onUnblockContact,
    initialCall = null,
    className = "",
    onBackToList,

}) {
    const endRef = useRef(null);
    const messagesViewportRef = useRef(null);
    const typingRef = useRef(false);
    const stopTypingTimeout = useRef(null);
    const autoLoadThrottleRef = useRef(0);
    const scheduledLatestScrollRef = useRef(null);
    const prevMessagesMetaRef = useRef({
        chatId: null,
        firstId: null,
        lastId: null,
        length: 0,
    });

    // ✅ emoji UI
    const [emojiOpen, setEmojiOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState("");
    const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
    const [activeCall, setActiveCall] = useState(null);
    const [callOverlayError, setCallOverlayError] = useState("");
    const [callElapsedSec, setCallElapsedSec] = useState(0);
    const [callMicMuted, setCallMicMuted] = useState(false);
    const [callCameraEnabled, setCallCameraEnabled] = useState(true);
    const [callSpeakerMuted, setCallSpeakerMuted] = useState(false);
    const [callCameraNotice, setCallCameraNotice] = useState("");
    const [peerConnectionState, setPeerConnectionState] = useState("new");
    const [iceConnectionState, setIceConnectionState] = useState("new");
    const peerConnectionRef = useRef(null);
    const callLocalStreamRef = useRef(null);
    const callLocalStreamPromiseRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const offerSentForCallRef = useRef(null);
    const iceServersRef = useRef(resolveIceServers());
    const ringtoneAudioContextRef = useRef(null);
    const ringtoneTimerRef = useRef(null);
    const initialCallAppliedRef = useRef(null);
    const autoAcceptedCallRef = useRef(null);

    const ensureCallLocalStream = useCallback(async (callType) => {
        if (callLocalStreamRef.current) return callLocalStreamRef.current;
        if (callLocalStreamPromiseRef.current) return callLocalStreamPromiseRef.current;

        callLocalStreamPromiseRef.current = acquireCallMedia(
            callType,
            navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
        ).then((media) => {
            const stream = media.stream;
            setCallCameraNotice(media.videoError ? "Камера занята или недоступна. Звонок продолжен со звуком." : "");
            callLocalStreamRef.current = stream;
            stream.getAudioTracks().forEach((track) => {
                track.enabled = !callMicMuted;
            });
            stream.getVideoTracks().forEach((track) => {
                track.enabled = callCameraEnabled;
            });
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            return stream;
        }).catch((error) => {
            callLocalStreamPromiseRef.current = null;
            throw error;
        });

        return callLocalStreamPromiseRef.current;
    }, [callCameraEnabled, callMicMuted]);

    // ✅ режим для групп 4–10: FEED (по умолчанию) / CREATE (форма)
    const [announcementMode, setAnnouncementMode] = useState("feed"); // "feed" | "create"
    const [advertisements, setAdvertisements] = useState([]);
    const [advertisementsLoading, setAdvertisementsLoading] = useState(false);
    const [advertisementsError, setAdvertisementsError] = useState("");

    const scrollToLatest = useCallback((behavior = "auto") => {
        scheduledLatestScrollRef.current?.();
        scheduledLatestScrollRef.current = scheduleLatestViewport({
            getViewport: () => messagesViewportRef.current,
            behavior,
        });
    }, []);

    useEffect(() => () => scheduledLatestScrollRef.current?.(), []);

    useEffect(() => {
        // при смене чата всегда возвращаемся на ленту
        setAnnouncementMode("feed");
    }, [chat?.id]);

    useEffect(() => {
        if (!initialCall?.callId || initialCallAppliedRef.current === initialCall.callId) return;
        if (chat?.id && initialCall.chatId && chat.id !== initialCall.chatId) return;
        initialCallAppliedRef.current = initialCall.callId;
        setActiveCall(initialCall);
    }, [chat?.id, initialCall]);

    useEffect(() => {
        if (!currentUserId) {
            setCallOverlayError("");
            return undefined;
        }

        const socket = connectSocket();
        if (!socket) return undefined;

        const inCurrentChat = (payload = {}) => Boolean(chat?.id) && payload?.chatId === chat.id;
        const inActiveCall = (payload = {}) => Boolean(activeCall?.callId) && payload?.callId === activeCall.callId;

        const onStarted = (payload = {}) => {
            if (!inCurrentChat(payload)) return;
            setCallOverlayError("");
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? "audio",
                status: payload.status ?? "initiated",
                direction: "outgoing",
                startedAt: null,
                initiatorId: payload.initiatorId ?? currentUserId,
            });
        };

        const onIncoming = (payload = {}) => {
            setCallOverlayError("");
            setActiveCall({
                callId: payload.callId,
                chatId: payload.chatId,
                type: payload.type ?? "audio",
                status: payload.status ?? "ringing",
                direction: "incoming",
                startedAt: null,
                initiatorId: payload.initiatorId ?? payload.fromUserId ?? null,
            });
        };

        const onRinging = (payload = {}) => {
            if (!inCurrentChat(payload) && !inActiveCall(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: payload.status ?? "ringing" }
                : prev));
        };

        const onAccepted = (payload = {}) => {
            if (!inCurrentChat(payload) && !inActiveCall(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: payload.status ?? "connected", startedAt: payload?.startedAt ?? new Date().toISOString() }
                : prev));
        };

        const onFinished = (payload = {}) => {
            if (!inCurrentChat(payload) && !inActiveCall(payload)) return;
            setActiveCall((prev) => (prev?.callId === payload.callId
                ? { ...prev, status: "ended" }
                : prev));
            const endMessage = mapCallEndMessage(payload.endedReason);
            if (endMessage) {
                setCallOverlayError(endMessage);
            }

            setTimeout(() => {
                setActiveCall((prev) => (prev?.callId === payload.callId ? null : prev));
            }, 1500);
        };

        const onCallError = ({ chatId, message, code, activeCall: activeCallPayload } = {}) => {
            if (chatId && !inCurrentChat({ chatId }) && activeCall?.chatId !== chatId) return;
            if (code === "CALL_ALREADY_EXISTS_ACTIVE" && activeCallPayload?.callId) {
                setActiveCall((prev) => ({
                    callId: activeCallPayload.callId,
                    chatId: activeCallPayload.chatId,
                    type: activeCallPayload.type ?? prev?.type ?? "audio",
                    status: activeCallPayload.status ?? prev?.status ?? "ringing",
                    direction: activeCallPayload.initiatorId === currentUserId ? "outgoing" : "incoming",
                    startedAt: activeCallPayload.startedAt ?? prev?.startedAt ?? null,
                    initiatorId: activeCallPayload.initiatorId ?? prev?.initiatorId ?? null,
                }));
            }
            setCallOverlayError(mapCallErrorMessage(code, message));
        };

        const onCallSignal = async ({ callId, chatId, kind, sdp, candidate } = {}) => {
            if (!activeCall || activeCall.callId !== callId || activeCall.chatId !== chatId) return;
            const socket = connectSocket();
            if (!socket) return;

            const ensureLocalStream = async () => {
                return ensureCallLocalStream(activeCall.type);
            };

            const ensurePeerConnection = async () => {
                if (peerConnectionRef.current) return peerConnectionRef.current;
                const pc = new RTCPeerConnection({
                    iceServers: iceServersRef.current,
                });
                peerConnectionRef.current = pc;
                pc.onconnectionstatechange = () => {
                    setPeerConnectionState(pc.connectionState || "unknown");
                    if (pc.connectionState === "failed") {
                        setCallOverlayError("Не удалось установить стабильное аудиосоединение.");
                    }
                };
                pc.oniceconnectionstatechange = () => {
                    setIceConnectionState(pc.iceConnectionState || "unknown");
                };

                pc.onicecandidate = (event) => {
                    if (!event.candidate) return;
                    socket.emit("call:signal", {
                        callId,
                        chatId,
                        kind: "ice-candidate",
                        candidate: event.candidate.toJSON?.() ?? event.candidate,
                    });
                };

                pc.ontrack = (event) => {
                    const [remoteStream] = event.streams;
                    if (!remoteStream) return;
                    if (remoteAudioRef.current) {
                        remoteAudioRef.current.srcObject = remoteStream;
                        remoteAudioRef.current.play().catch(() => {});
                    }
                    if (remoteVideoRef.current) {
                        remoteVideoRef.current.srcObject = remoteStream;
                        remoteVideoRef.current.play().catch(() => {});
                    }
                };

                const localStream = await ensureLocalStream();
                localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
                return pc;
            };

            try {
                const pc = await ensurePeerConnection();
                if (kind === "offer" && typeof sdp === "string") {
                    await pc.setRemoteDescription({ type: "offer", sdp });
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit("call:signal", { callId, chatId, kind: "answer", sdp: answer.sdp });
                } else if (kind === "answer" && typeof sdp === "string") {
                    await pc.setRemoteDescription({ type: "answer", sdp });
                } else if (kind === "ice-candidate" && candidate) {
                    await pc.addIceCandidate(candidate);
                }
            } catch (error) {
                console.error("call:signal processing failed:", error);
                setCallOverlayError("Не удалось установить соединение.");
            }
        };

        socket.on("call:started", onStarted);
        socket.on("call:incoming", onIncoming);
        socket.on("call:ringing", onRinging);
        socket.on("call:accepted", onAccepted);
        socket.on("call:declined", onFinished);
        socket.on("call:ended", onFinished);
        socket.on("call:error", onCallError);
        socket.on("call:signal", onCallSignal);

        return () => {
            socket.off("call:started", onStarted);
            socket.off("call:incoming", onIncoming);
            socket.off("call:ringing", onRinging);
            socket.off("call:accepted", onAccepted);
            socket.off("call:declined", onFinished);
            socket.off("call:ended", onFinished);
            socket.off("call:error", onCallError);
            socket.off("call:signal", onCallSignal);
        };
    }, [activeCall, callCameraEnabled, callMicMuted, chat?.id, currentUserId, ensureCallLocalStream]);

    useEffect(() => {
        if (!activeCall?.autoAccept || activeCall.status !== "ringing" || !activeCall.callId) return undefined;
        if (autoAcceptedCallRef.current === activeCall.callId) return undefined;
        autoAcceptedCallRef.current = activeCall.callId;

        const timer = setTimeout(() => {
            connectSocket()?.emit("call:accept", { callId: activeCall.callId });
        }, 0);
        return () => clearTimeout(timer);
    }, [activeCall]);

    useEffect(() => {
        if (!activeCall || activeCall.status !== "connected") return undefined;
        if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === "undefined") {
            setCallOverlayError("Браузер не поддерживает звонки.");
            return undefined;
        }

        const socket = connectSocket();
        if (!socket) return undefined;
        let cancelled = false;

        const ensureLocalStream = async () => {
            return ensureCallLocalStream(activeCall.type);
        };

        const ensurePeerConnection = async () => {
            if (peerConnectionRef.current) return peerConnectionRef.current;
            const pc = new RTCPeerConnection({
                iceServers: iceServersRef.current,
            });
            peerConnectionRef.current = pc;
            pc.onconnectionstatechange = () => {
                setPeerConnectionState(pc.connectionState || "unknown");
                if (pc.connectionState === "failed") {
                    setCallOverlayError("Не удалось установить стабильное аудиосоединение.");
                }
            };
            pc.oniceconnectionstatechange = () => {
                setIceConnectionState(pc.iceConnectionState || "unknown");
            };

            pc.onicecandidate = (event) => {
                if (!event.candidate) return;
                socket.emit("call:signal", {
                    callId: activeCall.callId,
                    chatId: activeCall.chatId,
                    kind: "ice-candidate",
                    candidate: event.candidate.toJSON?.() ?? event.candidate,
                });
            };

            pc.ontrack = (event) => {
                const [remoteStream] = event.streams;
                if (!remoteStream) return;
                if (remoteAudioRef.current) {
                    remoteAudioRef.current.srcObject = remoteStream;
                    remoteAudioRef.current.play().catch(() => {});
                }
                if (remoteVideoRef.current) {
                    remoteVideoRef.current.srcObject = remoteStream;
                    remoteVideoRef.current.play().catch(() => {});
                }
            };

            const localStream = await ensureLocalStream();
            localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
            return pc;
        };

        const bootstrapConnectedCall = async () => {
            try {
                const pc = await ensurePeerConnection();
                if (cancelled) return;
                const shouldSendOffer = activeCall.initiatorId === currentUserId && offerSentForCallRef.current !== activeCall.callId;
                if (!shouldSendOffer) return;
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit("call:signal", {
                    callId: activeCall.callId,
                    chatId: activeCall.chatId,
                    kind: "offer",
                    sdp: offer.sdp,
                });
                offerSentForCallRef.current = activeCall.callId;
            } catch (error) {
                console.error("call bootstrap failed:", error);
                setCallOverlayError(activeCall.type === "video"
                    ? "Не удалось получить доступ к камере или микрофону."
                    : "Не удалось получить доступ к микрофону для звонка.");
            }
        };

        bootstrapConnectedCall();

        return () => {
            cancelled = true;
            if (activeCall?.status === "ended" || !activeCall) {
                offerSentForCallRef.current = null;
            }
        };
    }, [activeCall, callCameraEnabled, callMicMuted, currentUserId, ensureCallLocalStream]);

    useEffect(() => {
        if (!callLocalStreamRef.current) return;
        callLocalStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = !callMicMuted;
        });
    }, [callMicMuted]);

    useEffect(() => {
        if (!callLocalStreamRef.current) return;
        callLocalStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = callCameraEnabled;
        });
    }, [callCameraEnabled]);

    useEffect(() => {
        if (remoteAudioRef.current) remoteAudioRef.current.muted = callSpeakerMuted;
    }, [callSpeakerMuted]);

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

        if (activeCall?.direction === "incoming" && activeCall?.status === "ringing") {
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
    }, [activeCall?.direction, activeCall?.status]);

    useEffect(() => {
        if (activeCall && activeCall.status !== "ended") return undefined;
        if (peerConnectionRef.current) {
            peerConnectionRef.current.onicecandidate = null;
            peerConnectionRef.current.onconnectionstatechange = null;
            peerConnectionRef.current.oniceconnectionstatechange = null;
            peerConnectionRef.current.ontrack = null;
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }
        if (callLocalStreamRef.current) {
            callLocalStreamRef.current.getTracks().forEach((track) => track.stop());
            callLocalStreamRef.current = null;
        }
        callLocalStreamPromiseRef.current = null;
        if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = null;
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        offerSentForCallRef.current = null;
        setCallMicMuted(false);
        setCallCameraEnabled(true);
        setCallSpeakerMuted(false);
        setCallCameraNotice("");
        setPeerConnectionState("new");
        setIceConnectionState("new");
        return undefined;
    }, [activeCall]);

    useEffect(() => {
        if (!activeCall || activeCall.status !== "connected") {
            setCallElapsedSec(0);
            return undefined;
        }

        const baseMs = activeCall.startedAt ? new Date(activeCall.startedAt).getTime() : Date.now();
        const tick = () => {
            const diff = Math.max(0, Date.now() - baseMs);
            setCallElapsedSec(Math.floor(diff / 1000));
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [activeCall]);

    const hasMoreHistory = Boolean(chat?.hasMoreHistory);
    const historyLoading = Boolean(chat?.historyLoading);
    const historyNotice = chat?.historyNotice ?? "";

    const emojiList = useMemo(
        () => [
            "😀", "😂", "😍", "😎", "😭", "😡",
            "👍", "👎", "🙏", "❤️", "🔥", "✨",
            "✅", "🎉", "🤝", "💬",
        ],
        []
    );

    const insertEmoji = useCallback(
        (e) => {
            if (!chat) return;
            const next = (chat.draft ?? "") + e;
            onDraftChange?.(next);
            setEmojiOpen(false);
        },
        [chat, onDraftChange]
    );

    // ✅ image/video upload UI (обычный чат)
    const fileInputRef = useRef(null);
    const [selectedMediaFile, setSelectedMediaFile] = useState(null);
    const [selectedMediaPreview, setSelectedMediaPreview] = useState(null);
    const [uploading, setUploading] = useState(false);

    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const voiceChunksRef = useRef([]);
    const voiceCancelRequestedRef = useRef(false);
    const voiceStartedAtRef = useRef(0);
    const voiceTimerRef = useRef(null);

    const [isRecordingVoice, setIsRecordingVoice] = useState(false);
    const [voiceDurationMs, setVoiceDurationMs] = useState(0);
    const [recordedVoiceBlob, setRecordedVoiceBlob] = useState(null);

    const stopVoiceTimer = useCallback(() => {
        if (voiceTimerRef.current) {
            clearInterval(voiceTimerRef.current);
            voiceTimerRef.current = null;
        }
    }, []);

    const stopVoiceTracks = useCallback(() => {
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach((track) => track.stop());
            mediaStreamRef.current = null;
        }
    }, []);

    const clearRecordedVoice = useCallback(() => {
        setRecordedVoiceBlob(null);
        setVoiceDurationMs(0);
    }, []);

    const clearSelectedMedia = useCallback(() => {
        setSelectedMediaFile(null);
        setSelectedMediaPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
        });
    }, []);

    const onPickMedia = useCallback(
        (event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const isImage = file.type?.startsWith("image/");
            const isVideo = file.type === "video/mp4" || file.type === "video/webm";
            if (!isImage && !isVideo) {
                alert("Можно выбрать картинку, MP4 или WebM видео.");
                return;
            }

            const maxBytes = isVideo ? 50 * 1024 * 1024 : 5 * 1024 * 1024;
            if (file.size > maxBytes) {
                alert(`Файл слишком большой. Максимум ${isVideo ? 50 : 5} МБ.`);
                return;
            }

            event.target.value = "";

            clearSelectedMedia();
            setSelectedMediaFile(file);
            setSelectedMediaPreview(URL.createObjectURL(file));
        },
        [clearSelectedMedia]
    );

    async function uploadSelectedMedia() {
        if (!selectedMediaFile) return null;

        const fd = new FormData();
        fd.append("file", selectedMediaFile);

        setUploading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: "POST",
                headers: authHeaders(),
                body: fd,
            });

            if (!res.ok) {
                throw new Error(await readApiError(res, "Не удалось загрузить файл"));
            }

            const data = await res.json();
            return data?.fileUrl ?? null;
        } finally {
            setUploading(false);
        }
    }

    async function uploadRecordedVoice(blob) {
        if (!blob) return null;

        const fd = new FormData();
        const ext = blob.type.includes("ogg") ? "ogg" : "webm";
        fd.append("file", blob, `voice-note.${ext}`);

        setUploading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/upload`, {
                method: "POST",
                headers: authHeaders(),
                body: fd,
            });

            if (!res.ok) {
                throw new Error(await readApiError(res, "Не удалось загрузить голосовое сообщение"));
            }

            const data = await res.json();
            return data?.audioUrl ?? data?.fileUrl ?? null;
        } finally {
            setUploading(false);
        }
    }

    const startVoiceRecording = useCallback(async () => {
        if (isRecordingVoice || uploading) return;

        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            alert("Запись голоса не поддерживается в этом браузере.");
            return;
        }

        try {
            clearSelectedMedia();
            clearRecordedVoice();
            voiceCancelRequestedRef.current = false;
            voiceChunksRef.current = [];
            setVoiceDurationMs(0);

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;

            const mimeType = getSupportedVoiceMimeType();
            const recorder = mimeType
                ? new MediaRecorder(stream, { mimeType })
                : new MediaRecorder(stream);

            mediaRecorderRef.current = recorder;
            recorder.ondataavailable = (event) => {
                if (event.data?.size > 0) {
                    voiceChunksRef.current.push(event.data);
                }
            };

            recorder.onstop = () => {
                stopVoiceTimer();
                stopVoiceTracks();

                const wasCanceled = voiceCancelRequestedRef.current;
                voiceCancelRequestedRef.current = false;

                const fallbackMime = mimeType || "audio/webm";
                const blob = new Blob(voiceChunksRef.current, { type: fallbackMime });
                if (!wasCanceled && blob.size > 0) {
                    setRecordedVoiceBlob(blob);
                    } else if (wasCanceled) {
                    clearRecordedVoice();
                }

                mediaRecorderRef.current = null;
                voiceChunksRef.current = [];
                setIsRecordingVoice(false);
            };

            recorder.start();
            setIsRecordingVoice(true);
            voiceStartedAtRef.current = Date.now();
            stopVoiceTimer();
            voiceTimerRef.current = setInterval(() => {
                setVoiceDurationMs(Date.now() - voiceStartedAtRef.current);
            }, 250);
        } catch (error) {
            console.error(error);
            stopVoiceTimer();
            stopVoiceTracks();
            setIsRecordingVoice(false);
            alert("Не удалось включить микрофон. Проверьте доступ к микрофону.");
        }
    }, [clearRecordedVoice, clearSelectedMedia, isRecordingVoice, stopVoiceTimer, stopVoiceTracks, uploading]);

    const stopVoiceRecording = useCallback(() => {
        if (!isRecordingVoice) return;
        voiceCancelRequestedRef.current = false;

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
            return;
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
    }, [isRecordingVoice, stopVoiceTimer, stopVoiceTracks]);

    const resetVoiceComposer = useCallback(() => {
        voiceCancelRequestedRef.current = true;

        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
            recorder.stop();
        }

        stopVoiceTimer();
        stopVoiceTracks();
        setIsRecordingVoice(false);
        clearRecordedVoice();
        voiceChunksRef.current = [];
    }, [clearRecordedVoice, stopVoiceTimer, stopVoiceTracks]);

    const cancelVoiceRecording = useCallback(() => {
        resetVoiceComposer();
    }, [resetVoiceComposer]);

    const handleMessagesScroll = useCallback(
        (event) => {
            if (!hasSelectedChat || !hasMoreHistory || historyLoading) return;

            if (event.currentTarget.scrollTop > 48) return;

            const now = Date.now();
            if (now - autoLoadThrottleRef.current < 500) return;
            autoLoadThrottleRef.current = now;

            onLoadOlderMessages?.();
        },
        [hasMoreHistory, hasSelectedChat, historyLoading, onLoadOlderMessages]
    );

    useEffect(() => {
        const messages = chat?.messages ?? [];
        const firstId = messages[0]?.id ?? null;
        const lastId = messages.length ? messages[messages.length - 1]?.id ?? null : null;

        const prev = prevMessagesMetaRef.current;
        const sameChat = prev.chatId === (chat?.id ?? null);
        const isHistoryPrepend =
            sameChat &&
            messages.length > prev.length &&
            firstId !== prev.firstId &&
            lastId === prev.lastId;

        if (!isHistoryPrepend && messagesViewportRef.current) {
            scrollToLatest(sameChat ? "smooth" : "auto");
        }

        prevMessagesMetaRef.current = {
            chatId: chat?.id ?? null,
            firstId,
            lastId,
            length: messages.length,
        };
    }, [announcementMode, chat?.id, chat?.messages, scrollToLatest]);


    const stopTypingNow = useCallback(() => {
        if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);

        if (typingRef.current) {
            typingRef.current = false;
            onTypingStop?.();
        }
    }, [onTypingStop]);

    useEffect(() => {
        const handleWindowBlur = () => stopTypingNow();
        window.addEventListener("blur", handleWindowBlur);

        return () => {
            window.removeEventListener("blur", handleWindowBlur);
            stopTypingNow();
        };
    }, [stopTypingNow]);

    useEffect(() => {
        stopTypingNow();
        setEmojiOpen(false);
        resetVoiceComposer();
    }, [chat?.id, resetVoiceComposer, stopTypingNow]);

    useEffect(() => () => {
        stopVoiceTimer();
        stopVoiceTracks();
    }, [stopVoiceTimer, stopVoiceTracks]);


    const handleChange = (event) => {
        const value = event.target.value;
        onDraftChange?.(value);

        if (!chat) return;

        if (!value.trim()) {
            stopTypingNow();
            return;
        }

        if (!typingRef.current) {
            typingRef.current = true;
            onTypingStart?.();
        }

        if (stopTypingTimeout.current) clearTimeout(stopTypingTimeout.current);
        stopTypingTimeout.current = setTimeout(stopTypingNow, 1200);
    };

    const handleSend = async () => {
        if (!chat || isRecordingVoice || recordedVoiceBlob) return;

        const text = (chat.draft ?? "").trim();
        if (!text && !selectedMediaFile) return;

        let mediaUrl = null;

        try {
            if (selectedMediaFile) {
                mediaUrl = await uploadSelectedMedia();
                if (!mediaUrl) {
                    alert("Не удалось загрузить вложение.");
                    return;
                }
            }

            if (mediaUrl?.startsWith("blob:")) {
                alert("Файл не загрузился на сервер. Повтори отправку.");
                return;
            }

            if (mediaUrl) {
                const mediaType = selectedMediaFile.type.startsWith("video/") ? "video" : "image";
                onSend({ 
                    text,
                    type: "media",
                    attachments: [
                        {
                            mediaType,
                            url: mediaUrl,
                            mimeType: selectedMediaFile?.type || null,
                            sizeBytes: selectedMediaFile?.size ?? null,
                        },
                    ],
                });
            } else {
                onSend({ text });
            }

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearSelectedMedia();
        } catch (err) {
            console.error(err);
            alert(err?.message || "Не удалось загрузить файл");
        }
    };

    const handleSendVoice = async () => {
        if (!chat || isRecordingVoice || !recordedVoiceBlob) return;

        if (selectedMediaFile) {
            alert("Голосовое отправляется отдельно от вложения.");
            return;
        }

        try {
            const audioUrl = await uploadRecordedVoice(recordedVoiceBlob);
            if (!audioUrl) {
                alert("Не удалось загрузить голосовое сообщение.");

                return;
            }

            if (audioUrl.startsWith("blob:")) {
                alert("Файл не загрузился на сервер. Повтори отправку.");
                return;
            }

            onSend({
                text: "",
                type: "media",
                attachments: [
                    {
                        mediaType: "audio",
                        url: audioUrl,
                        mimeType: recordedVoiceBlob.type || "audio/webm",
                        sizeBytes: recordedVoiceBlob.size,
                        durationMs: voiceDurationMs,
                    },
                ],
            });

            onDraftChange?.("");
            stopTypingNow();
            setEmojiOpen(false);
            clearRecordedVoice();
        } catch (err) {
            console.error(err);
            alert(err?.message || "Не удалось загрузить голосовое сообщение");
        }
    };

    const handleKeyDown = (event) => {
        if (isRecordingVoice) return;

        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const chatType = chat?.type ?? "private";
    const canUseComposer = !isRecordingVoice;

    const isAnnouncementGroup = chat?.contentType === "advertisement"
        || (chat?.contentType == null && typeof chat?.id === "string" && /^group-(?:[2-9]|10)$/.test(chat.id));

    const canPublish = chat?.canPublish !== false;

    const loadAdvertisements = useCallback(async () => {
        if (!isAnnouncementGroup || !chat?.id) {
            setAdvertisements([]);
            return;
        }
        setAdvertisementsLoading(true);
        setAdvertisementsError("");
        try {
            const items = await fetchAdvertisements(chat.id);
            setAdvertisements([...items].sort((a, b) => {
                const aTime = new Date(a?.publishedAt ?? a?.createdAt ?? 0).getTime();
                const bTime = new Date(b?.publishedAt ?? b?.createdAt ?? 0).getTime();
                return aTime - bTime;
            }));
        } catch (error) {
            setAdvertisementsError(error?.message ?? "Не удалось загрузить объявления");
        } finally {
            setAdvertisementsLoading(false);
        }
    }, [chat?.id, isAnnouncementGroup]);

    useEffect(() => {
        loadAdvertisements();
    }, [loadAdvertisements]);

    useEffect(() => {
        if (!isAnnouncementGroup || announcementMode !== "feed" || advertisementsLoading) return;
        scrollToLatest("auto");
    }, [advertisements.length, advertisementsLoading, announcementMode, chat?.id, isAnnouncementGroup, scrollToLatest]);

    useEffect(() => {
        if (!isAnnouncementGroup || !chat?.id) return undefined;
        const socket = getSocket();
        if (!socket) return undefined;
        const onAdvertisementChanged = ({ chatId } = {}) => {
            if (chatId === chat.id) loadAdvertisements();
        };
        socket.on("advertisement:changed", onAdvertisementChanged);
        return () => socket.off("advertisement:changed", onAdvertisementChanged);
    }, [chat?.id, isAnnouncementGroup, loadAdvertisements]);

    const filteredAdvertisements = useMemo(() => {
        const q = searchText.trim().toLowerCase();
        if (!q) return advertisements;
        return advertisements.filter((advertisement) => [
            advertisement.title,
            advertisement.description,
            advertisement.settlement,
            advertisement.price,
            advertisement.author?.name,
        ].filter(Boolean).join(" ").toLowerCase().includes(q));
    }, [advertisements, searchText]);

    // ✅ phone: берём из activeUser, если нет — из chat.otherUser (новый payload с сервера)
    const otherPhone =
        activeUser?.phone ??
        chat?.otherUser?.phone ??
        null;

    const onlineCount = hasSelectedChat
        ? chatType === "group"
            ? chat?.onlineCount ?? 0
            : activeUser?.isOnline
                ? 1
                : 0
        : 0;

    const subtitle = hasSelectedChat
        ? chatType === "private"
            ? (otherPhone ? otherPhone : (activeUser?.isOnline ? "в сети" : "не в сети"))
            : `${onlineCount} онлайн`
        : "чат не выбран";
    const filteredMessages = useMemo(() => {
        const allMessages = chat?.messages ?? [];
        const q = searchText.trim().toLowerCase();
        if (!q) return allMessages;

        return allMessages.filter((message) => {
            const text = typeof message?.text === "string" ? message.text.toLowerCase() : "";
            const senderName = typeof message?.senderName === "string" ? message.senderName.toLowerCase() : "";
            const senderId = typeof message?.senderId === "string" ? message.senderId.toLowerCase() : "";

            const legacyUrls = [
                typeof message?.imageUrl === "string" ? message.imageUrl : "",
                ...(Array.isArray(message?.imageUrls) ? message.imageUrls : []),
            ]
                .filter(Boolean)
                .map((item) => String(item).toLowerCase());

            const attachments = Array.isArray(message?.attachments) ? message.attachments : [];
            const attachmentMeta = attachments
                .flatMap((attachment) => [
                    attachment?.mediaType,
                    attachment?.mimeType,
                    attachment?.url,
                    attachment?.fileName,
                ])
                .filter(Boolean)
                .map((item) => String(item).toLowerCase());

            const hasImageAttachment = attachments.some((attachment) => attachment?.mediaType === "image");
            const hasAudioAttachment = attachments.some((attachment) => attachment?.mediaType === "audio");
            const mediaKeywords = [
                hasImageAttachment ? "image фото картинка" : "",
                hasAudioAttachment ? "audio аудио голос голосовое" : "",
            ].join(" ");

            const haystack = [
                text,
                senderName,
                senderId,
                ...legacyUrls,
                ...attachmentMeta,
                mediaKeywords,
            ].join(" ");

            return haystack.includes(q);
        });
    }, [chat?.messages, searchText]);

    return (
        <section className={`chat-window ${className}`.trim()}>
            <header className="chat-header">
                <div className="chat-header-main">
                    <button
                        type="button"
                        className="chat-back-btn"
                        onClick={onBackToList}
                        aria-label="Назад к списку кругов"
                    >
                        <span aria-hidden="true">←</span>
                        <span>Чаты</span>
                    </button>

                    <div className="chat-avatar" aria-hidden="true" />
                    <div className="chat-header-text">
                        <h2>{hasSelectedChat ? activeUser?.name ?? "Чат" : "Чат не выбран"}</h2>
                        <span className="chat-type">{subtitle}</span>
                    </div>
                </div>
                <div className="chat-header-actions">
                    {hasSelectedChat && !chat?.id?.startsWith?.("group-") ? (
                        <>
                            <button
                                type="button"
                                aria-label="audio-call"
                                title="Аудиозвонок"
                                onClick={() => onStartCall?.("audio")}
                            >
                                📞
                            </button>
                            <button
                                type="button"
                                aria-label="video-call"
                                title="Видеозвонок"
                                onClick={() => onStartCall?.("video")}
                            >
                                🎥
                            </button>
                        </>
                    ) : null}
                    <button
                        type="button"
                        aria-label="search"
                        onClick={() => {
                            setIsSearchOpen((prev) => !prev);
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        ⌕
                    </button>
                    <button
                        type="button"
                        aria-label="menu"
                        onClick={() => setIsHeaderMenuOpen((prev) => !prev)}
                    >
                        ⋯
                    </button>
                </div>
            </header>
            {activeCall ? (
                <div className="chat-call-overlay">
                    {activeCall.type === "video" ? (
                        <div className="chat-call-video-stage">
                            <video ref={remoteVideoRef} className="chat-call-remote-video" autoPlay playsInline muted />
                            <video ref={localVideoRef} className="chat-call-local-video" autoPlay playsInline muted />
                            {!callCameraEnabled ? <span className="chat-call-camera-off">Камера выключена</span> : null}
                        </div>
                    ) : (
                        <div className="chat-call-avatar" aria-hidden="true">
                            {String(activeUser?.name || "?").slice(0, 1).toUpperCase()}
                        </div>
                    )}
                    <strong>{activeCall.type === "video" ? "🎥 Видеозвонок" : "📞 Аудиозвонок"}</strong>
                    <strong>{activeUser?.name ?? "Контакт"}</strong>
                    <span className="chat-type">
                        {activeCall.direction === "incoming" ? "Входящий" : "Исходящий"} • {getCallStatusLabel(activeCall.status)}
                    </span>
                    {activeCall.direction === "outgoing" && activeCall.status === "ringing" && activeUser?.isOnline === false ? (
                        <span className="chat-type">Абонент сейчас не в сети. Дождитесь ответа или завершите звонок.</span>
                    ) : null}
                    {activeCall.status === "connected" ? (
                        <span className="chat-type">Длительность: {formatCallDuration(callElapsedSec)}</span>
                    ) : null}
                    {callCameraNotice ? <span className="chat-call-notice">{callCameraNotice}</span> : null}
                    {CALL_DEBUG_ENABLED ? (
                        <span className="chat-type">
                            WebRTC: pc={peerConnectionState} • ice={iceConnectionState}
                        </span>
                    ) : null}
                    <div className="chat-call-actions">
                        {activeCall.direction === "incoming" && activeCall.status === "ringing" ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        getSocket()?.emit("call:accept", { callId: activeCall.callId });
                                    }}
                                >
                                    Принять
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        getSocket()?.emit("call:decline", { callId: activeCall.callId, reason: "declined" });
                                    }}
                                >
                                    Отклонить
                                </button>
                            </>
                        ) : null}
                        {activeCall.status === "initiated" || activeCall.status === "ringing" || activeCall.status === "connected" ? (
                            <button
                                type="button"
                                onClick={() => {
                                    getSocket()?.emit("call:end", { callId: activeCall.callId, reason: "hangup" });
                                }}
                            >
                                Завершить
                            </button>
                        ) : null}
                        {activeCall.status === "connected" ? (
                            <button
                                type="button"
                                onClick={() => setCallMicMuted((prev) => !prev)}
                            >
                                {callMicMuted ? "Включить микрофон" : "Выключить микрофон"}
                            </button>
                        ) : null}
                        {activeCall.status === "connected" && activeCall.type === "video" && !callCameraNotice ? (
                            <button type="button" onClick={() => setCallCameraEnabled((prev) => !prev)}>
                                {callCameraEnabled ? "Скрыть видео" : "Показать видео"}
                            </button>
                        ) : null}
                        {activeCall.status === "connected" ? (
                            <button type="button" onClick={() => setCallSpeakerMuted((prev) => !prev)}>
                                {callSpeakerMuted ? "Включить динамик" : "Выключить динамик"}
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {callOverlayError ? <div className="chat-call-error">{callOverlayError}</div> : null}
            <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: "none" }} />
            {isSearchOpen ? (
                <div className="chat-search">
                    <input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder="Поиск по сообщениям..."
                    />
                    <button type="button" onClick={() => setSearchText("")}>Сброс</button>
                </div>
            ) : null}

            {isHeaderMenuOpen ? (
                <div className="chat-header-menu">
                    <button
                        type="button"
                        onClick={() => {
                            setIsSearchOpen(true);
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        Поиск сообщений
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            scrollToLatest("smooth");
                            setIsHeaderMenuOpen(false);
                        }}
                    >
                        К последнему сообщению
                    </button>
                    {chat?.type === "private" ? (
                        <button
                            type="button"
                            className="chat-delete-action"
                            onClick={() => {
                                setIsHeaderMenuOpen(false);
                                isContactBlocked ? onUnblockContact?.() : onBlockContact?.();
                            }}
                        >
                            {isContactBlocked ? "Разблокировать" : "Заблокировать"}
                        </button>
                    ) : null}
                    {chat?.type === "private" ? (
                        <button
                            type="button"
                            className="chat-delete-action"
                            onClick={() => {
                                setIsHeaderMenuOpen(false);
                                onDeleteChat?.();
                            }}
                        >
                            Удалить чат
                        </button>
                    ) : null}
                </div>
            ) : null}

            {chat?.typingUsers?.length ? <span className="chat-typing">печатает...</span> : null}

            {/* =======================
            ГРУППЫ 4–10 (ОБЪЯВЛЕНИЯ)
         ======================= */}
            {isAnnouncementGroup ? (
                <>
                    {/* FEED */}
                    {announcementMode === "feed" ? (
                        <>
                            <div ref={messagesViewportRef} className="messages" onScroll={handleMessagesScroll}>
                                {historyNotice ? <div className="history-notice">{historyNotice}</div> : null}

                                {!hasSelectedChat ? (
                                    <div className="chat-empty-placeholder">
                                        Выберите круг слева, чтобы посмотреть объявления
                                    </div>
                                ) : null}

                                {advertisementsLoading ? <div className="chat-empty-placeholder">Загружаем объявления…</div> : null}
                                {advertisementsError ? <div className="chat-empty-placeholder">{advertisementsError}</div> : null}
                                {!advertisementsLoading && !advertisementsError && hasSelectedChat && filteredAdvertisements.length === 0 ? (
                                    <div className="chat-empty-placeholder">В этой группе пока нет объявлений.</div>
                                ) : null}

                                {filteredAdvertisements.map((advertisement) => (
                                    <AnnouncementCard
                                        key={advertisement.id}
                                        advertisement={advertisement}
                                        currentUserId={currentUserId}
                                        onWriteToAuthor={onWriteToAuthor}
                                    />
                                ))}

                                <div ref={endRef} />
                            </div>

                            {/* CTA снизу */}
                            <div className="announce-cta">
                                <button
                                    type="button"
                                    className="announce-cta-btn"
                                    disabled={!chat || !hasSelectedChat || !canPublish}
                                    onClick={() => setAnnouncementMode("create")}
                                >
                                    + Разместить объявление
                                </button>
                            </div>

                            {!canPublish ? (
                                <div className="chat-empty-placeholder">
                                    У вас нет прав на публикацию в этой группе.
                                </div>
                            ) : null}

                        </>
                    ) : (
                        /* CREATE */
                        <div className="announce-screen">
                            <div className="announce-screen-top">
                                <button
                                    type="button"
                                    className="announce-back"
                                    onClick={() => setAnnouncementMode("feed")}
                                >
                                    ← Назад к объявлениям
                                </button>
                            </div>

                            <AnnouncementComposer
                                disabled={!chat || !hasSelectedChat || !canPublish}
                                imageRequired={false}
                                onSubmit={async (form) => {
                                    await createAdvertisement({ chatId: chat.id, ...form });
                                    await loadAdvertisements();
                                    setAnnouncementMode("feed");
                                }}
                            />
                        </div>
                    )}
                </>
            ) : (
                /* =======================
                ОБЫЧНЫЕ ЧАТЫ (ЛИЧКА + ПОБОЛТАЕМ)
                ======================= */
                <>
                    <div ref={messagesViewportRef} className="messages" onScroll={handleMessagesScroll}>
                        {historyNotice ? <div className="history-notice">{historyNotice}</div> : null}

                        {hasSelectedChat && hasMoreHistory ? (
                            <button
                                type="button"
                                className="history-load-more"
                                onClick={onLoadOlderMessages}
                                disabled={historyLoading}
                            >
                                {historyLoading ? "Загружаем..." : "Показать более ранние сообщения"}
                            </button>
                        ) : null}

                        {hasSelectedChat && !hasMoreHistory && chat?.messages?.length ? (
                            <div className="history-end">Более ранних сообщений нет</div>
                        ) : null}


                        {!hasSelectedChat ? (
                            <div className="chat-empty-placeholder">
                                Выберите контакт слева, чтобы начать диалог
                            </div>
                        ) : null}

                        {filteredMessages.map((m) => {
                            const hasSender = Boolean(m.senderId);
                            const isMe = hasSender ? m.senderId === currentUserId : m.fromMe === true;

                            return (
                                <div key={m.id} className={`message ${isMe ? "outgoing" : "incoming"}`}>
                                    <div className="bubble">
                                        {(() => {
                                            const legacyUrls = Array.isArray(m.imageUrls)
                                                ? m.imageUrls
                                                : (m.imageUrl ? [m.imageUrl] : []);
                                            const attachmentUrls = Array.isArray(m.attachments)
                                                ? m.attachments
                                                    .filter((attachment) => attachment?.mediaType === "image" && attachment?.url)
                                                    .map((attachment) => attachment.url)
                                                : [];
                                            const urls = [...new Set([...legacyUrls, ...attachmentUrls])];
                                            
                                            return urls.length ? (
                                                <div className="message-images">
                                                    {urls.map((u) => (
                                                        <img key={u} className="message-image" src={u} alt="" />
                                                    ))}
                                                </div>
                                            ) : null;
                                        })()}

                                        {Array.isArray(m.attachments)
                                            ? m.attachments
                                                .filter((attachment) => attachment?.mediaType === "audio" && attachment?.url)
                                                .map((attachment) => (
                                                    <audio
                                                        key={attachment.id ?? attachment.url}
                                                        className="message-audio"
                                                        controls
                                                        preload="metadata"
                                                        src={attachment.url}
                                                    />
                                                ))
                                            : null}

                                        {Array.isArray(m.attachments)
                                            ? m.attachments
                                                .filter((attachment) => attachment?.mediaType === "video" && attachment?.url)
                                                .map((attachment) => (
                                                    <video
                                                        key={attachment.id ?? attachment.url}
                                                        className="message-video"
                                                        controls
                                                        playsInline
                                                        preload="metadata"
                                                        src={attachment.url}
                                                    />
                                                ))
                                            : null}


                                        {m.text ? <div className="message-text">{m.text}</div> : null}
                                    </div>

                                    {isMe && m.status && (
                                        <div className={`message-status ${m.status}`}>
                                            {m.status === "sent" && "✓"}
                                            {(m.status === "delivered" || m.status === "read") && "✓✓"}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        <div ref={endRef} />
                    </div>

                    {/* превью для обычного чата */}
                    {selectedMediaPreview ? (
                        <div className="draft-preview">
                            {selectedMediaFile?.type?.startsWith("video/") ? (
                                <video src={selectedMediaPreview} controls playsInline preload="metadata" />
                            ) : (
                                <img src={selectedMediaPreview} alt="" />
                            )}
                            <button
                                type="button"
                                className="draft-preview-remove"
                                onClick={clearSelectedMedia}
                                disabled={uploading}
                                aria-label="remove image"
                            >
                                ✕
                            </button>
                        </div>
                    ) : null}

                    {isRecordingVoice || recordedVoiceBlob ? (
                        <div className="voice-recorder-bar">
                            <span className="voice-recorder-state">
                                {isRecordingVoice ? "● Запись" : "Голосовое готово"}
                            </span>
                            <span className="voice-recorder-time">{formatVoiceDuration(voiceDurationMs)}</span>
                            {!isRecordingVoice ? (
                                <button
                                    type="button"
                                    className="voice-send-btn"
                                    onClick={handleSendVoice}
                                    disabled={uploading || !recordedVoiceBlob || !canPublish}
                                >
                                    Отправить голосовое
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="voice-cancel-btn"
                                onClick={cancelVoiceRecording}
                                disabled={uploading}
                            >
                                Отмена
                            </button>
                        </div>
                    ) : null}


                    <footer className="chat-input">
                        <div className="chat-input-left">
                            <button
                                type="button"
                                className="attach-btn"
                                aria-label="attach"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
                                onClick={() => fileInputRef.current?.click()}
                                title="Прикрепить картинку или видео"
                            >
                                📎
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,video/mp4,video/webm"
                                style={{ display: "none" }}
                                onChange={onPickMedia}
                            />

                            <button
                                type="button"
                                className="mic-btn"
                                aria-label={isRecordingVoice ? "stop recording" : "start recording"}
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish}
                                onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
                                title={isRecordingVoice ? "Остановить запись" : "Записать голос"}
                            >
                                {isRecordingVoice ? "⏹" : "🎙"}
                            </button>


                            <button
                                type="button"
                                className="emoji-btn"
                                aria-label="emoji"
                                disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
                                onClick={() => setEmojiOpen((v) => !v)}
                                title="Смайлики"
                            >
                                🙂
                            </button>

                            {emojiOpen ? (
                                <div className="emoji-panel" role="dialog" aria-label="emoji panel">
                                    {emojiList.map((e) => (
                                        <button
                                            type="button"
                                            key={e}
                                            className="emoji-item"
                                            onClick={() => insertEmoji(e)}
                                        >
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        <textarea
                            value={chat?.draft ?? ""}
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
                            onChange={handleChange}
                            onBlur={stopTypingNow}
                            onKeyDown={handleKeyDown}
                            placeholder={canPublish ? (isRecordingVoice ? "Идёт запись голосового..." : (uploading ? "Загрузка..." : "Сообщение...")) : "Публикация в этой группе запрещена"}
                            rows={1}
                        />

                        <button
                            disabled={!chat || !hasSelectedChat || uploading || !canPublish || !canUseComposer}
                            onClick={handleSend}
                            title="Отправить"
                        >
                            ➤
                        </button>
                    </footer>
                </>
            )}
        </section>
    );
}
