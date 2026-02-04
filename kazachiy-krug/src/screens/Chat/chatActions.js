export function sendMessage(dispatch, chatId, text) {
    const messageId = crypto.randomUUID();

    dispatch({
        type: "SEND_MESSAGE",
        payload: { text, messageId }
    });

    // delivered
    setTimeout(() => {
        dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
                chatId,
                messageId,
                status: "delivered"
            }
        });
    }, 800);

    // read
    setTimeout(() => {
        dispatch({
            type: "UPDATE_MESSAGE_STATUS",
            payload: {
                chatId,
                messageId,
                status: "read"
            }
        });
    }, 1500);
}