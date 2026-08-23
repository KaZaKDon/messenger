import { useState } from "react";

import { REGISTRATION_DOCUMENTS } from "../../../content/legal/registrationDocuments";
import {
    createEmptyRegistration,
    formatRussianPhoneInput,
    isAccountStepValid,
    REGISTRATION_PURPOSES,
} from "../registrationModel";
import LegalDocumentModal from "./LegalDocumentModal";
import PasswordField from "./PasswordField";

const ACCEPTANCE_OPTIONS = Object.freeze([
    { field: "termsRules", label: "пользовательское соглашение и правила", document: REGISTRATION_DOCUMENTS.termsRules },
    { field: "personalData", label: "согласие на обработку персональных данных", document: REGISTRATION_DOCUMENTS.personalData },
    { field: "publicProfile", label: "согласие на данные публичного профиля", document: REGISTRATION_DOCUMENTS.publicProfile },
]);

export default function RegistrationForm({ loading, error, onSubmit }) {
    const [step, setStep] = useState(1);
    const [application, setApplication] = useState(createEmptyRegistration);
    const [localError, setLocalError] = useState("");
    const [openDocument, setOpenDocument] = useState(null);

    const update = (field) => (event) => {
        const value = field === "phone"
            ? formatRussianPhoneInput(event.target.value)
            : event.target.value;
        setApplication((current) => ({ ...current, [field]: value }));
        setLocalError("");
    };

    const togglePurpose = (purpose) => {
        setApplication((current) => ({
            ...current,
            purposes: current.purposes.includes(purpose)
                ? current.purposes.filter((item) => item !== purpose)
                : [...current.purposes, purpose],
        }));
        setLocalError("");
    };

    const toggleAcceptance = (field) => {
        setApplication((current) => ({
            ...current,
            acceptances: {
                ...current.acceptances,
                [field]: !current.acceptances[field],
            },
        }));
        setLocalError("");
    };

    const handleAccountStep = (event) => {
        event.preventDefault();
        const validationError = isAccountStepValid(application);
        if (validationError) {
            setLocalError(validationError);
            return;
        }
        setStep(2);
        setLocalError("");
    };

    const handleApplicationStep = (event) => {
        event.preventDefault();
        if (application.purposes.length === 0) {
            setLocalError("Выберите хотя бы одну цель вступления");
            return;
        }
        if (application.purposes.includes("other") && !application.purposeNote.trim()) {
            setLocalError("Поясните другую цель вступления");
            return;
        }
        if (Object.values(application.acceptances).some((accepted) => !accepted)) {
            setLocalError("Для регистрации необходимо принять все три документа");
            return;
        }
        onSubmit(application);
    };

    return (
        <>
            <form className="auth-form auth-registration-form" onSubmit={step === 1 ? handleAccountStep : handleApplicationStep}>
                <div className="auth-section-heading">
                    <h1>Регистрация</h1>
                    <p>{step === 1 ? "Создайте данные для входа" : "Расскажите немного о себе"}</p>
                </div>

                <ol className="auth-stepper" aria-label="Этапы регистрации">
                    <li className={step >= 1 ? "active" : ""}><span>1</span>Аккаунт</li>
                    <li className={step >= 2 ? "active" : ""}><span>2</span>Заявка</li>
                </ol>

                {step === 1 ? (
                    <div className="auth-fields auth-fields-grid">
                        <label className="auth-field" htmlFor="register-nickname">
                            <span>Ник *</span>
                            <input id="register-nickname" value={application.nickname} onChange={update("nickname")} autoComplete="nickname" minLength="2" maxLength="40" placeholder="Как вас будут видеть" required />
                        </label>
                        <label className="auth-field" htmlFor="register-phone">
                            <span>Мобильный телефон *</span>
                            <input id="register-phone" type="tel" inputMode="tel" value={application.phone} onChange={update("phone")} autoComplete="tel" placeholder="+7 (999) 123-45-67" required />
                        </label>
                        <label className="auth-field auth-field-wide" htmlFor="register-email">
                            <span>Email <small>необязательно</small></span>
                            <input id="register-email" type="email" value={application.email} onChange={update("email")} autoComplete="email" maxLength="254" placeholder="name@example.ru" />
                        </label>
                        <PasswordField id="register-password" label="Пароль *" value={application.password} onChange={update("password")} autoComplete="new-password" />
                        <PasswordField id="register-password-confirmation" label="Повторите пароль *" value={application.passwordConfirmation} onChange={update("passwordConfirmation")} autoComplete="new-password" />
                    </div>
                ) : (
                    <div className="auth-fields auth-fields-grid">
                        <label className="auth-field" htmlFor="register-first-name">
                            <span>Имя *</span>
                            <input id="register-first-name" value={application.firstName} onChange={update("firstName")} autoComplete="given-name" minLength="2" maxLength="80" required />
                        </label>
                        <label className="auth-field" htmlFor="register-last-name">
                            <span>Фамилия *</span>
                            <input id="register-last-name" value={application.lastName} onChange={update("lastName")} autoComplete="family-name" minLength="2" maxLength="80" required />
                        </label>
                        <label className="auth-field" htmlFor="register-settlement">
                            <span>Населённый пункт *</span>
                            <input id="register-settlement" value={application.settlement} onChange={update("settlement")} autoComplete="address-level2" minLength="2" maxLength="120" placeholder="Станица, хутор или город" required />
                        </label>
                        <label className="auth-field" htmlFor="register-occupation">
                            <span>Чем занимаетесь *</span>
                            <input id="register-occupation" value={application.occupation} onChange={update("occupation")} minLength="2" maxLength="160" placeholder="Работа, ремесло или занятие" required />
                        </label>

                        <fieldset className="auth-choice-group auth-field-wide">
                            <legend>С какой целью пришли? *</legend>
                            <div className="auth-purpose-grid">
                                {REGISTRATION_PURPOSES.map((purpose) => (
                                    <label key={purpose.value} className="auth-choice">
                                        <input type="checkbox" checked={application.purposes.includes(purpose.value)} onChange={() => togglePurpose(purpose.value)} />
                                        <span>{purpose.label}</span>
                                    </label>
                                ))}
                            </div>
                        </fieldset>

                        {application.purposes.includes("other") ? (
                            <label className="auth-field auth-field-wide" htmlFor="register-purpose-note">
                                <span>Поясните другую цель *</span>
                                <textarea id="register-purpose-note" value={application.purposeNote} onChange={update("purposeNote")} maxLength="500" rows="3" required />
                            </label>
                        ) : null}

                        <fieldset className="auth-choice-group auth-field-wide auth-acceptances">
                            <legend>Обязательные согласия *</legend>
                            {ACCEPTANCE_OPTIONS.map((option) => (
                                <label key={option.field} className="auth-choice auth-acceptance">
                                    <input type="checkbox" checked={application.acceptances[option.field]} onChange={() => toggleAcceptance(option.field)} />
                                    <span>
                                        Принимаю {" "}
                                        <button type="button" onClick={() => setOpenDocument(option.document)}>{option.label}</button>
                                    </span>
                                </label>
                            ))}
                        </fieldset>
                    </div>
                )}

                {localError || error ? <p className="auth-message auth-message-error" role="alert">{localError || error}</p> : null}

                <div className="auth-form-actions">
                    {step === 2 ? (
                        <button className="auth-secondary-button" type="button" disabled={loading} onClick={() => { setStep(1); setLocalError(""); }}>
                            Назад
                        </button>
                    ) : null}
                    <button className="auth-primary-button" type="submit" disabled={loading}>
                        {loading ? "Отправляем…" : step === 1 ? "Продолжить" : "Отправить заявку"}
                    </button>
                </div>
            </form>

            <LegalDocumentModal document={openDocument} onClose={() => setOpenDocument(null)} />
        </>
    );
}
