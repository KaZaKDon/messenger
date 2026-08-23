export const CALL_AUDIO_TRACK_CONSTRAINTS = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
};

export function getCallMediaConstraints(type) {
    return {
        audio: CALL_AUDIO_TRACK_CONSTRAINTS,
        video: type === "video" ? { facingMode: "user" } : false,
    };
}

export async function acquireCallMedia(type, getUserMedia) {
    const audioStream = await getUserMedia({
        audio: CALL_AUDIO_TRACK_CONSTRAINTS,
        video: false,
    });

    if (type !== "video") {
        return { stream: audioStream, videoAvailable: false, videoError: null };
    }

    try {
        const videoStream = await getUserMedia({
            audio: false,
            video: { facingMode: "user" },
        });
        videoStream.getVideoTracks().forEach((track) => audioStream.addTrack(track));
        return { stream: audioStream, videoAvailable: videoStream.getVideoTracks().length > 0, videoError: null };
    } catch (error) {
        return { stream: audioStream, videoAvailable: false, videoError: error };
    }
}
