import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../lib/client";

afterEach(() => vi.unstubAllGlobals());

describe("shop API responses", () => {
  it("shows a useful message for an HTML response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>error</html>", { status: 502 })));
    await expect(api("cart")).rejects.toThrow("Сервер вернул некорректный ответ");
  });
  it("handles null errors and preserves business codes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json({ error: "Цена изменилась", code: "PRICE_CHANGED" }, { status: 409 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api("cart")).rejects.toMatchObject({ message: "Не удалось выполнить запрос", status: 500 });
    await expect(api("orders", {})).rejects.toMatchObject({ code: "PRICE_CHANGED", status: 409 });
    expect(ApiError.prototype).toBeInstanceOf(Error);
  });
});
