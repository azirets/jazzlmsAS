package kz.jazz.lms.course.web;

import kz.jazz.lms.course.service.BadRequestException;
import kz.jazz.lms.course.service.ConflictException;
import kz.jazz.lms.course.service.ForbiddenException;
import kz.jazz.lms.course.service.NotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);


    @ExceptionHandler(NotFoundException.class)
    public ProblemDetail notFound(NotFoundException e) {
        log.warn("NotFoundException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    public ProblemDetail forbidden(ForbiddenException e) {
        log.warn("ForbiddenException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.FORBIDDEN, e.getMessage());
    }

    @ExceptionHandler(BadRequestException.class)
    public ProblemDetail badRequest(BadRequestException e) {
        log.warn("BadRequestException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ProblemDetail tooLarge(MaxUploadSizeExceededException e) {
        log.warn("MaxUploadSizeExceededException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.PAYLOAD_TOO_LARGE, "File is too large (limit 300 MB)");
    }

    @ExceptionHandler(ConflictException.class)
    public ProblemDetail conflict(ConflictException e) {
        log.warn("ConflictException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ProblemDetail unavailable(IllegalStateException e) {
        log.warn("IllegalStateException -> {}", e.getMessage());
        return ProblemDetail.forStatusAndDetail(HttpStatus.SERVICE_UNAVAILABLE, e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ProblemDetail validation(MethodArgumentNotValidException e) {
        log.warn("MethodArgumentNotValidException -> {}", e.getMessage());
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining("; "));
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, msg);
    }

    /** Invalid path/query/header types (for example, a non-UUID course id) are client errors. */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ProblemDetail invalidArgument(MethodArgumentTypeMismatchException e) {
        log.warn("Invalid request parameter {}", e.getName());
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Invalid value for parameter: " + e.getName());
    }

    /** Malformed JSON must not be reported as an unexpected server failure. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail unreadableBody(HttpMessageNotReadableException e) {
        log.warn("Unreadable request body");
        return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "Request body is missing or malformed");
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
