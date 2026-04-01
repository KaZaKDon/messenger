import { useEffect, useState } from "react";
import AppSidebar from "../components/AppSidebar/AppSidebar";
import "./AppFrame.css";

const DRAWER_BREAKPOINT = 1199;

export default function AppFrame({ currentUser, isNightMode, setIsNightMode, children }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth > DRAWER_BREAKPOINT) {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === "Escape") {
                setIsSidebarOpen(false);
            }
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, []);

    useEffect(() => {
        if (!isSidebarOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isSidebarOpen]);

    const closeSidebar = () => setIsSidebarOpen(false);

    return (
        <div className="app-frame">
            <button
                type="button"
                className="app-frame-drawer-button"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Открыть меню"
                aria-expanded={isSidebarOpen}
            >
                ☰
            </button>

            {isSidebarOpen ? (
                <button
                    type="button"
                    className="app-frame-backdrop"
                    onClick={closeSidebar}
                    aria-label="Закрыть меню"
                />
            ) : null}

            <AppSidebar
                currentUser={currentUser}
                isNightMode={isNightMode}
                onNightModeChange={setIsNightMode}
                isOpen={isSidebarOpen}
                onNavigate={closeSidebar}
            />

            <main className="app-frame-content">{children}</main>
        </div>
    );
}
