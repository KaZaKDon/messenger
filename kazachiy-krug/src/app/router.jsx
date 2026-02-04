import { Routes, Route, Navigate } from "react-router-dom";

import Phone from "../screens/Phone/Phone";
import Code from "../screens/Auth/Code";
import Chat from "../screens/Chat/Chat";
import Settings from "../screens/Settings/Settings";
import Profile from "../screens/Profile/Profile";

export default function AppRouter({ currentUser, setCurrentUser }) {
    return (
        <Routes>
            {/* авторизация */}
            <Route path="/" element={<Navigate to="/phone" replace />} />
            <Route path="/phone" element={<Phone />} />
            <Route
                path="/code"
                element={<Code setCurrentUser={setCurrentUser} />}
            />

            {/* защищенные маршруты */}
            <Route
                path="/chat"
                element={
                    currentUser
                        ? <Chat currentUser={currentUser} />
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/settings"
                element={
                    currentUser
                        ? <Settings currentUser={currentUser} />
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/profile"
                element={
                    currentUser
                        ? <Profile currentUser={currentUser} />
                        : <Navigate to="/phone" replace />
                }
            />

            {/* fallback */}
            <Route path="*" element={<Navigate to="/phone" replace />} />
        </Routes>
    );
}