import { createContext, useContext } from "react";

export const FormAuthContext = createContext({ userEmail: null });
export const useFormAuth = () => useContext(FormAuthContext);