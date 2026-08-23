import { useCallback, useEffect, useState } from "react";
import {
    NOTIFICATION_PREFERENCES_EVENT,
    readNotificationPreferences,
    writeNotificationPreferences,
} from "./notificationPreferences.js";

export function useNotificationPreferences() {
    const [preferences, setPreferences] = useState(readNotificationPreferences);

    useEffect(() => {
        const onChange = (event) => setPreferences(event.detail ?? readNotificationPreferences());
        window.addEventListener(NOTIFICATION_PREFERENCES_EVENT, onChange);
        return () => window.removeEventListener(NOTIFICATION_PREFERENCES_EVENT, onChange);
    }, []);

    const updatePreference = useCallback((name, enabled) => {
        setPreferences((current) => writeNotificationPreferences({ ...current, [name]: Boolean(enabled) }));
    }, []);

    return { preferences, updatePreference };
}
