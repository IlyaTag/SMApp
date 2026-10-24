import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { chatSlice, actions } from "../entities/state";
import { greenApi } from "../shared/api/greenApi";
import { clearSession } from "../shared/session";

export const listener = createListenerMiddleware();

export const store = configureStore({
  reducer: {
    chat: chatSlice.reducer,
    [greenApi.reducerPath]: greenApi.reducer,
  },
  middleware: (getDefault) =>
    getDefault().prepend(listener.middleware).concat(greenApi.middleware),
  devTools: import.meta.env.DEV,
});

export type RootState = ReturnType<typeof store.getState>;

export const useAppSelector = useSelector.withTypes<RootState>();

export const useAppDispatch = useDispatch.withTypes<typeof store.dispatch>();

export function logout() {
  clearSession();
  store.dispatch(actions.reset());
  store.dispatch(greenApi.util.resetApiState());
}
