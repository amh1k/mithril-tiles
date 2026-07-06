export function hasJsonContentType(request: Request): boolean {
  const contentType = request.headers.get("Content-Type");
  if (contentType === null) {
    return false;
  }
  const [mediaType] = contentType.split(";", 1);
  return mediaType.trim().toLowerCase() === "application/json";
}
export function hasTrustedMutationOrigin(
  request: Request,
  expectedOrigin: string,
  requireOrigin = process.env.NODE_ENV === "production",
): boolean {
  const requestOrigin = request.headers.get("Origin");
  if (requestOrigin === null) {
    return !requireOrigin;
  }
  try {
    return new URL(requestOrigin).origin === new URL(expectedOrigin).origin;
  } catch {
    return false;
  }
}
