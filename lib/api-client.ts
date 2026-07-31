export async function readApiErrorCode(response: Response): Promise<string> {
  const data: unknown = await response.json().catch(() => null);

  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    typeof data.error === "string"
  ) {
    return data.error;
  }

  return "UNEXPECTED_ERROR";
}
