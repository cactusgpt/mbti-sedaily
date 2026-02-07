"""
Unified response formatting for Lambda handlers.
Eliminates duplicate response formatting code across handlers.
"""

import json
from typing import Any, Dict, Optional, List
from datetime import datetime, date
from decimal import Decimal

from config.constants import CORS_HEADERS


def _json_serializer(obj: Any) -> Any:
    """
    Custom JSON serializer for objects not serializable by default json encoder.
    Handles datetime, date, Decimal, and other common types.
    """
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        # Convert Decimal to int if it's a whole number, otherwise float
        if obj % 1 == 0:
            return int(obj)
        return float(obj)
    if isinstance(obj, set):
        return list(obj)
    if hasattr(obj, 'to_dict'):
        return obj.to_dict()
    if hasattr(obj, '__dict__'):
        return obj.__dict__
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def success_response(
    data: Any,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None,
    cache_control: Optional[str] = None
) -> Dict:
    """
    Create a standard success response for Lambda handlers.

    Args:
        data: Response data (will be JSON serialized)
        status_code: HTTP status code (default: 200)
        headers: Additional headers to include
        cache_control: Cache-Control header value

    Returns:
        Lambda response dictionary
    """
    response_headers = {**CORS_HEADERS}

    if headers:
        response_headers.update(headers)

    if cache_control:
        response_headers['Cache-Control'] = cache_control

    return {
        'statusCode': status_code,
        'headers': response_headers,
        'body': json.dumps(data, default=_json_serializer, ensure_ascii=False)
    }


def error_response(
    message: str,
    status_code: int = 500,
    code: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    retry_possible: bool = False,
    headers: Optional[Dict[str, str]] = None
) -> Dict:
    """
    Create a standard error response for Lambda handlers.

    Args:
        message: Human-readable error message
        status_code: HTTP status code (default: 500)
        code: Machine-readable error code
        details: Additional error details
        retry_possible: Whether the request can be retried
        headers: Additional headers to include

    Returns:
        Lambda response dictionary
    """
    response_headers = {**CORS_HEADERS}

    if headers:
        response_headers.update(headers)

    body = {
        'error': message
    }

    if code:
        body['code'] = code

    if details:
        body['details'] = details

    if retry_possible:
        body['retry_possible'] = True

    return {
        'statusCode': status_code,
        'headers': response_headers,
        'body': json.dumps(body, default=_json_serializer, ensure_ascii=False)
    }


def paginated_response(
    items: List[Any],
    total: int,
    page: int,
    page_size: int,
    additional_data: Optional[Dict[str, Any]] = None,
    status_code: int = 200,
    headers: Optional[Dict[str, str]] = None
) -> Dict:
    """
    Create a standard paginated response for Lambda handlers.

    Args:
        items: List of items for current page
        total: Total number of items
        page: Current page number (1-based)
        page_size: Number of items per page
        additional_data: Additional data to include in response
        status_code: HTTP status code (default: 200)
        headers: Additional headers to include

    Returns:
        Lambda response dictionary
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

    data = {
        'items': items,
        'pagination': {
            'total': total,
            'page': page,
            'page_size': page_size,
            'total_pages': total_pages,
            'has_next': page < total_pages,
            'has_prev': page > 1
        }
    }

    if additional_data:
        data.update(additional_data)

    return success_response(data, status_code=status_code, headers=headers)


def created_response(
    data: Any,
    headers: Optional[Dict[str, str]] = None
) -> Dict:
    """
    Create a 201 Created response.

    Args:
        data: Created resource data
        headers: Additional headers to include

    Returns:
        Lambda response dictionary
    """
    return success_response(data, status_code=201, headers=headers)


def no_content_response(
    headers: Optional[Dict[str, str]] = None
) -> Dict:
    """
    Create a 204 No Content response.

    Args:
        headers: Additional headers to include

    Returns:
        Lambda response dictionary
    """
    response_headers = {**CORS_HEADERS}

    if headers:
        response_headers.update(headers)

    return {
        'statusCode': 204,
        'headers': response_headers,
        'body': ''
    }


def validation_error_response(
    message: str,
    field: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None
) -> Dict:
    """
    Create a 400 Bad Request response for validation errors.

    Args:
        message: Error message
        field: Field that failed validation
        details: Additional error details

    Returns:
        Lambda response dictionary
    """
    error_details = details or {}
    if field:
        error_details['field'] = field

    return error_response(
        message=message,
        status_code=400,
        code='VALIDATION_ERROR',
        details=error_details if error_details else None
    )


def not_found_response(
    resource_type: str,
    resource_id: Optional[str] = None
) -> Dict:
    """
    Create a 404 Not Found response.

    Args:
        resource_type: Type of resource not found
        resource_id: ID of resource not found

    Returns:
        Lambda response dictionary
    """
    if resource_id:
        message = f"{resource_type} with id '{resource_id}' not found"
    else:
        message = f"{resource_type} not found"

    return error_response(
        message=message,
        status_code=404,
        code='NOT_FOUND',
        details={'resource_type': resource_type, 'resource_id': resource_id}
    )


def internal_error_response(
    message: str = "Internal server error",
    code: Optional[str] = None,
    retry_possible: bool = True
) -> Dict:
    """
    Create a 500 Internal Server Error response.

    Args:
        message: Error message
        code: Error code
        retry_possible: Whether the request can be retried

    Returns:
        Lambda response dictionary
    """
    return error_response(
        message=message,
        status_code=500,
        code=code or 'INTERNAL_ERROR',
        retry_possible=retry_possible
    )


def exception_to_response(exc: Exception) -> Dict:
    """
    Convert an exception to an appropriate Lambda response.

    Args:
        exc: Exception to convert

    Returns:
        Lambda response dictionary
    """
    from core.exceptions import (
        BackendError,
        get_status_code_for_exception
    )

    if isinstance(exc, BackendError):
        return error_response(
            message=exc.message,
            status_code=get_status_code_for_exception(exc),
            code=exc.code,
            details=exc.details if exc.details else None,
            retry_possible=exc.retry_possible
        )

    # For unknown exceptions, return generic 500 error
    return internal_error_response(
        message="An unexpected error occurred",
        retry_possible=True
    )
