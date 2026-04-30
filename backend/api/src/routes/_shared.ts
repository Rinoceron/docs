export type EndpointHandler = (request: Request, env: unknown) => Promise<Response>;

export function createNotImplementedHandler(operationId: string): EndpointHandler {
  return async () => {
    return new Response(
      JSON.stringify({
        error: "Not implemented",
        operation_id: operationId,
      }),
      {
        status: 501,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  };
}
