import { useReducer, useMemo } from "react";
import { chatReducer, initialState } from "./chatReducer";
import { useChatSocket } from "./hooks/useChatSocket";
import UserList from "./components/UserList";
import ChatWindow from "./components/ChatWindow";

export default function Chat({ currentUser }) {
    const [state, dispatch] = useReducer(chatReducer, {
        ...initialState,
        activeChatUserId: null,
        chats: {}
    });

    const { users, chats, activeChatUserId } = state;


    // 🔹 вычисляем chatId (1-на-1)
    const chatId = useMemo(() => {
        if (!activeChatUserId) return null;
        return [currentUser.id, activeChatUserId].sort().join("_");
    }, [currentUser.id, activeChatUserId]);

    // 🔹 сокет (ВСЕГДА)
    useChatSocket(dispatch, currentUser, chatId);

    const activeChat = chatId ? chats[chatId] : null;

    const sendMessage = (text) => {
        if (!chatId) return;

        dispatch({
            type: "RECEIVE_MESSAGE",
            payload: {
                chatId,
                message: {
                    id: crypto.randomUUID(),
                    chatId,
                    text,
                    senderId: currentUser.id,
                    fromMe: true,
                    status: "sent"
                }
            }
        });
    };

    return (
        <div className="chat-layout">
            <UserList
                users={users.filter(u => u.id !== currentUser.id)}
                activeUserId={activeChatUserId}
                onSelect={(userId) =>
                    dispatch({
                        type: "SET_ACTIVE_CHAT_USER",
                        payload: userId
                    })
                }
            />

            <ChatWindow
                chat={activeChat}
                onSend={sendMessage}
                onDraftChange={(text) =>
                    dispatch({
                        type: "SET_DRAFT",
                        payload: { chatId, text }
                    })
                }
            />
        </div>
    );
}