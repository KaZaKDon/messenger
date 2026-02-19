import AppSidebar from "../components/AppSidebar/AppSidebar";
import "./AppFrame.css";

export default function AppFrame({ currentUser, children }) {
    return (
        <div className="app-frame">
            <AppSidebar
                currentUser={currentUser}
                onDisabledClick={() => alert("Раздел пока в разработке")}
            />
            <main className="app-frame-content">{children}</main>
        </div>
    );
}
