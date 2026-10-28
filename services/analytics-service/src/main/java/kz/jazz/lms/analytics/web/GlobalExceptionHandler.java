package kz.jazz.lms.analytics.web;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/** Единый формат ошибок (RFC 7807) и логирование: 4xx -> WARN, 5xx -> ERROR со stack trace. */
@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    public ProblemDetail badRequest(IllegalArgumentException e) {
        log.warn("IllegalArgumentException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    /** Unknown enum value or malformed date in a query parameter is a client error. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail invalidArgument(MethodArgumentTypeMismatchException e) {
        log.warn("Invalid request parameter {}", e.getName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Invalid value for parameter: " + e.getName());
    }

    /** Любая непредвиденная ошибка -> 500 с ERROR и stack trace в логе (видно в Grafana). Текст исключения наружу не отдаём. */
    @ExceptionHandler(Exception.class)
    public ProblemDetail internal(Exception e, HttpServletRequest req) {
        log.error("Unhandled error on {} {}", req.getMethod(), req.getRequestURI(), e);
        return ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error, see service logs");
    }

    /** 405: метод не поддерживается этим путём (например, POST там, где объявлен только GET). */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ProblemDetail methodNotAllowed(HttpRequestMethodNotSupportedException e, HttpServletRequest req) {
        log.warn("405 on {} {}: {}", req.getMethod(), req.getRequestURI(), e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.METHOD_NOT_ALLOWED, e.getMessage());
    }
}
