import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../../../shared/config";
import { fetchSettlements } from "../../../shared/advertisementsApi";

const MAX_IMAGES = 7;

async function uploadOne(file) {
    const fd = new FormData();
    fd.append("image", file);

    const res = await fetch(`${API_BASE_URL}/upload`, { method: "POST", body: fd });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    return data.imageUrl;
}

export default function AnnouncementComposer({ disabled, imageRequired = false, initialAdvertisement = null, onSubmit }) {
    const fileRef = useRef(null);

    const [title, setTitle] = useState(initialAdvertisement?.title ?? "");
    const [place, setPlace] = useState(initialAdvertisement?.settlement ?? "");
    const [price, setPrice] = useState(initialAdvertisement?.price ?? "");
    const [text, setText] = useState(initialAdvertisement?.description ?? "");
    const [images, setImages] = useState(() => (initialAdvertisement?.images ?? []).map((image) => ({ url: image.url, preview: image.url })));
    const [uploading, setUploading] = useState(false);
    const [settlements, setSettlements] = useState([]);
    const [settlementError, setSettlementError] = useState("");

    useEffect(() => {
        fetchSettlements().then(setSettlements).catch((error) => setSettlementError(error.message));
    }, []);

    const canSend = useMemo(() => {
        return title.trim() && place.trim() && text.trim()
            && (!imageRequired || images.length > 0) && !uploading;
    }, [imageRequired, title, place, text, images.length, uploading]);

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
                imageUrls.push(it.file ? await uploadOne(it.file) : it.url);
            }

            await onSubmit({
                title: title.trim(),
                settlement: place.trim(),
                price: price.trim() || null,
                description: text.trim(),
                images: imageUrls.map((url, sortOrder) => ({ url, sortOrder })),
            });

            images.forEach((it) => it.preview && URL.revokeObjectURL(it.preview));
            setTitle("");
            setPlace("");
            setPrice("");
            setText("");
            setImages([]);
        } catch (error) {
            window.alert(error?.message ?? "Не удалось опубликовать объявление");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="announce">
            <div className="announce-head">
                <div className="announce-title">{initialAdvertisement ? "Редактирование объявления" : "Подача объявления"}</div>
                <div className="announce-sub">Фотографии необязательны, можно добавить до {MAX_IMAGES}</div>
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
                    <div className="announce-label">Населённый пункт *</div>
                    <input
                        list="settlement-options"
                        value={place}
                        onChange={(e) => setPlace(e.target.value)}
                        disabled={disabled || uploading}
                        placeholder="Начните вводить название"
                    />
                    <datalist id="settlement-options">
                        {settlements.map((settlement) => <option key={settlement.id} value={settlement.name} />)}
                    </datalist>
                    {settlementError ? <small>{settlementError}</small> : null}
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
                    <div className="announce-label">Фото {imageRequired ? "* " : ""}(до {MAX_IMAGES})</div>

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
                    {uploading ? "Загрузка…" : (initialAdvertisement ? "Сохранить изменения" : "Опубликовать")}
                </button>
            </div>
        </div>
    );
}
