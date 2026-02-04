import { useState } from "react";
import AppRouter from "./router";

function getInitialUser() {
    try {
        const raw = localStorage.getItem("currentUser");
        return raw ? JSON.parse(raw) : null;
    } catch {
        localStorage.removeItem("currentUser");
        return null;
    }
}

export default function App() {
    const [currentUser, setCurrentUser] = useState(getInitialUser);

    return (
        <div className="app">
            <AppRouter
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
            />
        </div>
    );
}