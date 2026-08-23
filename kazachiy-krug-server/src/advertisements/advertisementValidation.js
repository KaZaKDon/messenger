import {
    DomainError,
    normalizeOptionalText,
    normalizeRequiredText,
} from "../domain/DomainError.js";

export const MAX_ACTIVE_ADVERTISEMENTS = 5;
export const MAX_ADVERTISEMENT_IMAGES = 7;

function normalizeImage(image, index) {
    const source = typeof image === "string" ? { url: image } : image;
    const url = typeof source?.url === "string" ? source.url.trim() : "";
    if (!url || url.length > 2000) {
        throw new DomainError("У фотографии указан некорректный адрес", {
            code: "VALIDATION_ERROR",
            field: `images.${index}`,
        });
    }

    const dimension = (value) => Number.isInteger(value) && value > 0 ? value : null;
    return {
        url,
        sortOrder: index,
        width: dimension(source?.width),
        height: dimension(source?.height),
    };
}

export function validateAdvertisementInput(source = {}, { imageRequired = false } = {}) {
    const images = Array.isArray(source.images) ? source.images : [];
    if (images.length > MAX_ADVERTISEMENT_IMAGES) {
        throw new DomainError(`Можно загрузить не более ${MAX_ADVERTISEMENT_IMAGES} фотографий`, {
            code: "VALIDATION_ERROR",
            field: "images",
        });
    }
    if (imageRequired && images.length === 0) {
        throw new DomainError("Добавьте хотя бы одну фотографию", {
            code: "VALIDATION_ERROR",
            field: "images",
        });
    }

    return {
        title: normalizeRequiredText(source.title, {
            field: "title",
            label: "Заголовок",
            min: 3,
            max: 120,
        }),
        settlement: normalizeRequiredText(source.settlement, {
            field: "settlement",
            label: "Населённый пункт",
            min: 2,
            max: 120,
        }),
        price: normalizeOptionalText(source.price, {
            field: "price",
            label: "Цена",
            max: 80,
        }),
        description: normalizeRequiredText(source.description, {
            field: "description",
            label: "Описание",
            min: 5,
            max: 4000,
        }),
        images: images.map(normalizeImage),
    };
}

export function advertisementExpiry({ now = new Date(), lifetimeDays }) {
    if (lifetimeDays == null) return null;
    if (!Number.isInteger(lifetimeDays) || lifetimeDays < 1 || lifetimeDays > 365) {
        throw new DomainError("В группе указан некорректный срок объявления", {
            code: "INVALID_GROUP_LIFETIME",
            statusCode: 409,
        });
    }
    return new Date(now.getTime() + lifetimeDays * 24 * 60 * 60 * 1000);
}
