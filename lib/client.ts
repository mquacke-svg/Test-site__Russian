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
  const data = await response.json();
  if (!response.ok)
    throw new ApiError(
      data.error || "Не удалось выполнить запрос",
      data.code,
      response.status,
    );
  return data;
}
