import { Routes, Route, Navigate } from "react-router-dom";

import Phone from "../screens/Phone/Phone";
import Code from "../screens/Auth/Code";
import Chat from "../screens/Chat/Chat";
import Settings from "../screens/Settings/Settings";
import Profile from "../screens/Profile/Profile";
import AppFrame from "../layouts/AppFrame";

export default function AppRouter({
    currentUser,
    setCurrentUser,
    phone,
    setPhone,
    isNightMode,
    setIsNightMode,
}) {
    const isAuth = Boolean(currentUser?.id);
    const hasPhone = Boolean(phone);

    return (
        <Routes>
            <Route
                path="/"
                element={<Navigate to={isAuth ? "/chat" : "/phone"} replace />}
            />
            <Route
                path="/phone"
                element={
                    isAuth ? <Navigate to="/chat" replace /> : <Phone setPhone={setPhone} />
                }
            />

            <Route
                path="/code"
                element={
                    isAuth
                        ? <Navigate to="/chat" replace />
                        : hasPhone
                            ? <Code setCurrentUser={setCurrentUser} />
                            : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/chat"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <Chat currentUser={currentUser} />
                            </AppFrame>
                        )
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/settings"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <Settings currentUser={currentUser} />
                            </AppFrame>
                        )
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/profile"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <Profile currentUser={currentUser} />
                            </AppFrame>
                        )
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="*"
                element={<Navigate to={isAuth ? "/chat" : "/phone"} replace />}
            />
        </Routes>
    );
}
