import { useMemo, useRef, useState } from "react";

const API_BASE = "http://localhost:3000";
const MAX_IMAGES = 5;

async function uploadOne(file) {
    const fd = new FormData();
    fd.append("image", file);

    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.imageUrl;
}

export default function AnnouncementComposer({ disabled, onSubmit }) {
    const fileRef = useRef(null);

    const [title, setTitle] = useState("");
    const [place, setPlace] = useState(""); // ✅ населённый пункт
    const [price, setPrice] = useState("");
    const [text, setText] = useState("");
    const [images, setImages] = useState([]); // [{file, preview}]
    const [uploading, setUploading] = useState(false);

    const canSend = useMemo(() => {
        return title.trim() && text.trim() && images.length > 0 && !uploading;
    }, [title, text, images.length, uploading]);

    const pickImages = (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";

        const allowed = files
            .filter((f) => f.type?.startsWith("image/"))
            .slice(0, MAX_IMAGES - images.length);

        const next = allowed.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));

        setImages((prev) => [...prev, ...next]);
    };

    const removeImage = (idx) => {
        setImages((prev) => {
            const copy = [...prev];
            const item = copy[idx];
            if (item?.preview) URL.revokeObjectURL(item.preview);
            copy.splice(idx, 1);
            return copy;
        });
    };

    const send = async () => {
        if (!canSend) return;

        setUploading(true);
        try {
            const imageUrls = [];
            for (const it of images) {
                imageUrls.push(await uploadOne(it.file));
            }

            const composedText =
                `🧾 ${title.trim()}\n` +
                (place.trim() ? `📍 ${place.trim()}\n` : "") +
                (price.trim() ? `💰 Цена: ${price.trim()}\n` : "") +
                `\n${text.trim()}`;

            onSubmit({
                text: composedText,
                imageUrls,
            });

            images.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
            setTitle("");
            setPlace("");
            setPrice("");
            setText("");
            setImages([]);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="announce">
            <div className="announce-head">
                <div className="announce-title">Подача объявления</div>
                <div className="announce-sub">Для кругов 4–10: текст + минимум 1 фото</div>
            </div>

            <div className="announce-form">
                <label className="announce-field">
                    <div className="announce-label">Заголовок *</div>
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={disabled || uploading}
                        placeholder="Например: Продам велосипед"
                    />
                </label>

                <label className="announce-field">
                    <div className="announce-label">Населённый пункт</div>
                    <input
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        disabled={disabled || uploading}
                        placeholder="Например: Станица Новая"
                    />
                </label>

                <label className="announce-field">
                    <div className="announce-label">Цена</div>
                    <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        disabled={disabled || uploading}
                        placeholder="Например: 1500"
                    />
                </label>

                <label className="announce-field">
                    <div className="announce-label">Описание *</div>
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={disabled || uploading}
                        placeholder="Коротко и по делу: состояние, условия…"
                        rows={5}
                    />
                </label>

                <div className="announce-photos">
                    <div className="announce-label">Фото * (до {MAX_IMAGES})</div>

                    <div className="announce-photo-grid">
                        {images.map((it, idx) => (
                            <div className="announce-photo" key={it.preview}>
                                <img src={it.preview} alt="" />
                                <button
                                    type="button"
                                    className="announce-photo-remove"
                                    onClick={() => removeImage(idx)}
                                    disabled={disabled || uploading}
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {images.length < MAX_IMAGES ? (
                            <button
                                type="button"
                                className="announce-photo-add"
                                onClick={() => fileRef.current?.click()}
                                disabled={disabled || uploading}
                            >
                                + Добавить
                            </button>
                        ) : null}
                    </div>

                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={pickImages}
                    />
                </div>

                <button
                    type="button"
                    className="announce-send"
                    onClick={send}
                    disabled={disabled || !canSend}
                >
                    {uploading ? "Загрузка…" : "Опубликовать"}
                </button>
            </div>
        </div>
    );
}