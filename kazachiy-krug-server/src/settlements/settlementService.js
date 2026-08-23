import { DomainError, normalizeRequiredText, requireRole } from "../domain/DomainError.js";

export function normalizeSettlementName(value) {
    return normalizeRequiredText(value, {
        field: "name",
        label: "Населённый пункт",
        min: 2,
        max: 120,
    }).replace(/\s+/g, " ");
}

export function settlementKey(value) {
    return normalizeSettlementName(value).toLocaleLowerCase("ru-RU");
}

function requireAdministrator(actor) {
    requireRole(actor, ["admin"], "Управлять населёнными пунктами может только администратор");
}

export async function assertActiveSettlement({ prisma, name }) {
    const normalizedName = settlementKey(name);
    const settlement = await prisma.settlement.findUnique({ where: { normalizedName } });
    if (!settlement || !settlement.isActive) {
        throw new DomainError("Выберите населённый пункт из действующего списка", {
            code: "SETTLEMENT_UNAVAILABLE",
            statusCode: 409,
            field: "settlement",
        });
    }
    return settlement;
}

export async function createSettlement({ prisma, actor, name }) {
    requireAdministrator(actor);
    const cleanName = normalizeSettlementName(name);
    const normalizedName = settlementKey(cleanName);
    const existing = await prisma.settlement.findUnique({ where: { normalizedName } });
    if (existing) {
        throw new DomainError("Такой населённый пункт уже существует", {
            code: "SETTLEMENT_DUPLICATE",
            statusCode: 409,
            field: "name",
        });
    }
    return prisma.settlement.create({ data: { name: cleanName, normalizedName } });
}

export async function updateSettlement({ prisma, actor, settlementId, source = {} }) {
    requireAdministrator(actor);
    const current = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!current) throw new DomainError("Населённый пункт не найден", { code: "SETTLEMENT_NOT_FOUND", statusCode: 404 });
    const data = {};
    if (source.name !== undefined) {
        data.name = normalizeSettlementName(source.name);
        data.normalizedName = settlementKey(data.name);
        const duplicate = await prisma.settlement.findUnique({ where: { normalizedName: data.normalizedName } });
        if (duplicate && duplicate.id !== settlementId) {
            throw new DomainError("Такой населённый пункт уже существует", { code: "SETTLEMENT_DUPLICATE", statusCode: 409, field: "name" });
        }
    }
    if (typeof source.isActive === "boolean") data.isActive = source.isActive;
    if (Object.keys(data).length === 0) throw new DomainError("Не указаны изменения", { code: "VALIDATION_ERROR", statusCode: 400 });
    return prisma.settlement.update({ where: { id: settlementId }, data });
}
