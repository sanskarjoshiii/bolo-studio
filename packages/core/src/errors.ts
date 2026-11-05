/** Expected failures with an HTTP-style status, shown to the user as-is. */
export class WorkflowError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}
