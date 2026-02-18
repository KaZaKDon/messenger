import './Phone.css'
import '../../styles/variables.css'
import img from './icon.jpg';
import { useNavigate } from "react-router-dom";
import { useState } from 'react';

export default function Phone({ setPhone }) {
    const navigate = useNavigate();
    const [phone, setPhoneValue] = useState("");

    const handleSubmit = () => {
        const normalizedPhone = phone.trim();
        if (!normalizedPhone) return;
        setPhone(normalizedPhone);

        navigate("/code");
    };

    return (
        <section className="auth-card">
            <form className="first" onSubmit={handleSubmit}>
                <img className="auth-logo" src={img} alt="logo" />

                <h1 className="auth-title">Вход по номеру телефона</h1>

                <div className="auth-field">
                    <label>Номер телефона</label>
                    <input
                        type="text"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="+7 ___ ___ __ __"
                        value={phone}
                        onChange={(event) => setPhoneValue(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                handleSubmit();
                            }
                        }}
                    />
                </div>

                <button className="auth-button" type="button" onClick={handleSubmit}>
                    Получить код
                </button>
            </form>
        </section>
    );
}