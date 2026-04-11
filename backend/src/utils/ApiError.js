"use strict";

class ApiError extends Error {
  constructor(code, message, statusCode = 400, details = null) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isApiError = true;
  }
}

// Factories keyed to the contract's error code list.
const Errors = {
  authRequired:         ()      => new ApiError("AUTH_REQUIRED",              "Authentication required",                                        401),
  forbidden:            ()      => new ApiError("FORBIDDEN",                  "You do not have permission to perform this action",              403),
  clientNotFound:       ()      => new ApiError("CLIENT_NOT_FOUND",           "Client not found",                                               404),
  postNotFound:         ()      => new ApiError("POST_NOT_FOUND",             "Post not found",                                                 404),
  socialProfileNotFound:()      => new ApiError("SOCIAL_PROFILE_NOT_FOUND",  "One or more social profiles were not found for this client",     404),
  postNotEditable:      ()      => new ApiError("POST_NOT_EDITABLE",          "Post can only be edited while in draft status",                  409),
  postNotDeletable:     ()      => new ApiError("POST_NOT_EDITABLE",          "Post can only be deleted when in draft or failed status",        409),
  postNotSubmittable:   ()      => new ApiError("POST_NOT_SUBMITTABLE",       "All targets must have adapted content before submitting",        409),
  invalidTransition:    (from, action) =>
                                   new ApiError("INVALID_TRANSITION",         `Cannot perform '${action}' on a post with status '${from}'`,     409),
  adaptedTitleRequired: ()      => new ApiError("ADAPTED_TITLE_REQUIRED",    "adaptedTitle is required for this platform",                     422),
  validationError:      (details) => new ApiError("VALIDATION_ERROR",         "Validation failed",                                              422, details),
  calendarRangeTooLarge:()      => new ApiError("CALENDAR_RANGE_TOO_LARGE",  "Calendar range cannot exceed 90 days",                           422),
  clientNameTaken:      ()      => new ApiError("CLIENT_NAME_TAKEN",          "A client with this name already exists in this workspace",        409),
};

module.exports = { ApiError, Errors };
