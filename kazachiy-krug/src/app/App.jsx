import { useState } from "react";
import AppRouter from "./router";


export default function App() {
    const [currentUser, setCurrentUser] = useState(null);

    return (
        <div className="app">
            <AppRouter
                currentUser={currentUser}
                setCurrentUser={setCurrentUser}
            />
        </div>
    );
}