import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { logout } from "../app/store";

afterEach(() => {
  cleanup();
  logout();
});
