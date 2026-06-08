export const ERROR_RES = {
  INTERNAL_ERROR: {
    name: 'INTERNAL_ERROR',
    statusCode: 500,
  },
  UNAUTHORIZED_ERROR: {
    name: 'UNAUTHORIZED_ERROR',
    statusCode: 401,
  },
  NOT_FOUND_ERROR: {
    name: 'NOT_FOUND_ERROR',
    statusCode: 404,
  },
  CONFLICT_ERROR: {
    name: 'CONFLICT_ERROR',
    statusCode: 409,
  },
  FORBIDDEN_ERROR: {
    name: 'FORBIDDEN_ERROR',
    statusCode: 403,
  },
  EXPIRE_TOKEN_ERROR: {
    name: 'EXPIRE_TOKEN_ERROR',
    statusCode: 401,
  },
  BAD_REQUEST_ERROR: {
    name: 'BAD_REQUEST_ERROR',
    statusCode: 400,
  },
  ARGUMENTS_ERROR: {
    name: 'ARGUMENTS_ERROR',
    statusCode: 400,
  },
  VALIDATION_ERROR: {
    name: 'VALIDATION_ERROR',
    statusCode: 422,
  },
  ACCOUNT_SUSPEND_ERROR: {
    name: 'ACCOUNT_SUSPEND_ERROR',
    statusCode: 402,
  },
  ACCOUNT_LOGOUT_ERROR: {
    name: 'ACCOUNT_LOGOUT_ERROR',
    statusCode: 412,
  },
  INVALID_CREDENTIALS_ERROR: {
    name: 'INVALID_CREDENTIALS_ERROR',
    statusCode: 401,
  },
  SUCCESS: {
    name: 'SUCCESS',
    statusCode: 200,
  },
  ACCEPTED: {
    name: 'ACCEPTED',
    statusCode: 202,
  },
};

export const ERROR_INFO = {
  SUCCESS: 'SUCCESS',
  FAIL: 'FAIL',
  PROCESSING: 'PROCESSING',
};
