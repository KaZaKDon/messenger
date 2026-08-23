import { createContext, useContext } from "react";

export const AdminSummaryContext = createContext({
    summary: null,
    loading: true,
    error: "",
    refresh: () => {},
});

export function useAdminSummaryContext() {
    return useContext(AdminSummaryContext);
}

