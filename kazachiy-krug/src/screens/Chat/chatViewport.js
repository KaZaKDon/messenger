export function moveViewportToLatest(viewport, behavior = "auto") {
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior });
}

export function scheduleLatestViewport({
    getViewport,
    behavior = "auto",
    requestFrame = window.requestAnimationFrame.bind(window),
    cancelFrame = window.cancelAnimationFrame.bind(window),
    setTimer = window.setTimeout.bind(window),
    clearTimer = window.clearTimeout.bind(window),
}) {
    let secondFrame = 0;
    const firstFrame = requestFrame(() => {
        moveViewportToLatest(getViewport(), behavior);
        secondFrame = requestFrame(() => moveViewportToLatest(getViewport(), behavior));
    });
    const timer = setTimer(() => moveViewportToLatest(getViewport(), "auto"), 120);

    return () => {
        cancelFrame(firstFrame);
        if (secondFrame) cancelFrame(secondFrame);
        clearTimer(timer);
    };
}
