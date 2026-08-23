import { Routes, Route, Navigate } from "react-router-dom";

import Phone from "../screens/Phone/Phone";
import Chat from "../screens/Chat/Chat";
import Settings from "../screens/Settings/Settings";
import Profile from "../screens/Profile/Profile";
import Calls from "../screens/Calls/Calls";
import MyAds from "../screens/MyAds/MyAds";
import SupportRequests from "../screens/SupportRequests/SupportRequests";
import AppFrame from "../layouts/AppFrame";
import AdminShell from "../layouts/AdminShell";
import AdminDashboard from "../screens/Admin/AdminDashboard";
import AdminUsers from "../screens/Admin/AdminUsers";
import AdminGroups from "../screens/Admin/AdminGroups";
import AdminAdvertisements from "../screens/Admin/AdminAdvertisements";
import AdminSettlements from "../screens/Admin/AdminSettlements";
import AdminComplaints from "../screens/Admin/AdminComplaints";
import AdminSupportRequests from "../screens/Admin/AdminSupportRequests";
import AdminModerators from "../screens/Admin/AdminModerators";
import AdminPayments from "../screens/Admin/AdminPayments";
import Registrations from "../screens/Admin/Registrations";
import PasswordRecoveries from "../screens/Admin/PasswordRecoveries";
import { isAdminRole } from "../screens/Admin/adminNavigation";
import Landing from "../screens/Landing/Landing";

export default function AppRouter({ currentUser,
    setCurrentUser,
    isNightMode,
    setIsNightMode,
}) {
    const isAuth = Boolean(currentUser?.id);

    return (
        <Routes>
            <Route
                path="/"
                element={isAuth ? <Navigate to="/chat" replace /> : <Landing />}
            />
            <Route
                path="/phone"
                element={
                    isAuth
                        ? <Navigate to="/chat" replace />
                        : (
                            <Phone
                                setCurrentUser={setCurrentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            />
                        )
                }
            />



            <Route path="/code" element={<Navigate to={isAuth ? "/chat" : "/phone"} replace />} />

            <Route
                path="/admin"
                element={
                    isAuth && isAdminRole(currentUser?.role)
                        ? (
                            <AdminShell
                                currentUser={currentUser}
                                setCurrentUser={setCurrentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            />
                        )
                        : <Navigate to={isAuth ? "/chat" : "/phone"} replace />
                }
            >
                <Route index element={<AdminDashboard role={currentUser?.role} />} />
                <Route path="overview" element={<AdminDashboard role={currentUser?.role} />} />
                <Route path="users" element={<AdminUsers currentUser={currentUser} />}>
                    <Route
                        path="registrations"
                        element={
                            currentUser?.role === "admin"
                                ? <Registrations />
                                : <Navigate to="/admin/users" replace />
                        }
                    />
                    <Route
                        path="password-recoveries"
                        element={
                            currentUser?.role === "admin"
                                ? <PasswordRecoveries />
                                : <Navigate to="/admin/users" replace />
                        }
                    />
                </Route>
                <Route
                    path="groups"
                    element={<AdminGroups currentUser={currentUser} />}
                />
                <Route
                    path="advertisements"
                    element={<AdminAdvertisements />}
                />
                <Route
                    path="settlements"
                    element={currentUser?.role === "admin" ? <AdminSettlements /> : <Navigate to="/admin" replace />}
                />
                <Route
                    path="complaints"
                    element={<AdminComplaints />}
                />
                <Route
                    path="support-requests"
                    element={<AdminSupportRequests />}
                />
                <Route
                    path="payments"
                    element={
                        currentUser?.role === "admin"
                            ? <AdminPayments />
                            : <Navigate to="/admin" replace />
                    }
                />
                <Route
                    path="moderators"
                    element={
                        currentUser?.role === "admin"
                            ? <AdminModerators currentUser={currentUser} />
                            : <Navigate to="/admin" replace />
                    }
                />
            </Route>

            <Route
                path="/admin/registrations"
                element={
                    isAuth && currentUser?.role === "admin"
                        ? <Navigate to="/admin/users/registrations" replace />
                        : <Navigate to={isAuth ? "/chat" : "/phone"} replace />
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
                path="/my-ads"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <MyAds />
                            </AppFrame>
                        )
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/support-requests"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <SupportRequests currentUser={currentUser} />
                            </AppFrame>
                        )
                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="/calls"
                element={
                    isAuth
                        ? (
                            <AppFrame
                                currentUser={currentUser}
                                isNightMode={isNightMode}
                                setIsNightMode={setIsNightMode}
                            >
                                <Calls currentUser={currentUser} />
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
                                <Profile currentUser={currentUser} setCurrentUser={setCurrentUser} />
                            </AppFrame>
                        )


                        : <Navigate to="/phone" replace />
                }
            />

            <Route
                path="*"
                element={<Navigate to={isAuth ? "/chat" : "/"} replace />}
            />
        </Routes>
    );
}
