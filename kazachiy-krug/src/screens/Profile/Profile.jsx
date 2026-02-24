import "./Profile.css";

export default function Profile({ currentUser }) {
    const userName = currentUser?.name ?? "Пользователь";
    const phone = currentUser?.phone ?? "Не указан";

    return (
        <section className="profile-page">
            <header className="profile-page-header">
                <h1>Мой профиль</h1>
                <p>Основная информация аккаунта</p>
            </header>

            <div className="profile-card">
                <div className="profile-avatar">{userName.slice(0, 1).toUpperCase()}</div>
                
                <div className="profile-info">
                    <div className="profile-row">
                        <span className="label">Имя</span>
                        <strong>{userName}</strong>
                    </div>

                    <div className="profile-row">
                        <span className="label">Телефон</span>
                        <strong>{phone}</strong>
                    </div>

                    <div className="profile-row">
                        <span className="label">Статус</span>
                        <strong className="online">Онлайн</strong>
                    </div>
                </div>
            </div>
        </section>
    );
}
