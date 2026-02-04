import './Phone.css'
import '../../styles/variables.css'
import img from './icon.jpg';
import { useNavigate } from "react-router-dom";
import { useState } from 'react';

export default function Phone() {
    const navigate = useNavigate();
    const [phone, setPhone] = useState("");

    const handleSubmit = () => {
        localStorage.setItem("phone", phone);
        navigate("/code");
    };

    return (
        <section className="auth-card">
            <div className="first">
                <img className="auth-logo" src={img} alt="logo" />

                <h1 className="auth-title">Вход по номеру телефона</h1>

                <div className="auth-field">
                    <label>Номер телефона</label>
                    <input
                        type="tel"
                        placeholder="+7 ___ ___ __ __"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                    />
                </div>

                <button className="auth-button" onClick={handleSubmit}>
                    Получить код
                </button>
            </div>
        </section>
    );
}