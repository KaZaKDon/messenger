import AppSidebar from "../components/AppSidebar/AppSidebar";
import "./AppFrame.css";

export default function AppFrame({ currentUser, isNightMode, setIsNightMode, children }) {
    return (
        <div className="app-frame">
            <AppSidebar
                currentUser={currentUser}
                onDisabledClick={() => alert("Раздел пока в разработке")}
                isNightMode={isNightMode}
                onNightModeChange={setIsNightMode}
            />
            <main className="app-frame-content">{children}</main>
        </div>
    );
}
