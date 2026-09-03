export type RequestLog = {
  event: 'http_request';
  requestId: string;
  method: string;
  pathname: string;
};

export function buildRequestLog(input: {
  requestId: string;
  method: string;
  pathname: string;
}): RequestLog {
  return {
    event: 'http_request',
    requestId: input.requestId,
    method: input.method,
    pathname: input.pathname,
  };
}
