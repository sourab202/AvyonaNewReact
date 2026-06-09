export function notFoundHandler(_request, response) {
  response.status(404).json({
    success: false,
    message: "Route not found"
  });
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = Number(error.statusCode || error.status || 500);

  response.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(error.details ? { details: error.details } : {})
  });
}
