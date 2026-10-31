export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/shop/${path}`, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      "Нет соединения с сервером. Проверьте подключение и повторите попытку.",
    );
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("Сервер вернул некорректный ответ. Попробуйте ещё раз.", undefined, response.status);
  }
  if (!response.ok)
    throw new ApiError(
      data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : "Не удалось выполнить запрос",
      data && typeof data === "object" && "code" in data && typeof data.code === "string" ? data.code : undefined,
      response.status,
    );
  return data as T;
}
