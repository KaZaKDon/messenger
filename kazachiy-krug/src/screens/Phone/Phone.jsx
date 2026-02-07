import './Phone.css'
import '../../styles/variables.css'
import img from './icon.jpg';
import { useNavigate } from "react-router-dom";
import { useRef } from 'react';

export default function Phone() {
    const navigate = useNavigate();
    const phoneRef = useRef(null);

    const handleSubmit = () => {
        const phone = phoneRef.current?.value?.trim();
        if (!phone) return;

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
                        ref={phoneRef}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+7 ___ ___ __ __"
                    />
                </div>

                <button className="auth-button" onClick={handleSubmit}>
                    Получить код
                </button>
            </div>
        </section>
    );
}