package kz.jazz.lms.course.web;

import jakarta.validation.Valid;
import kz.jazz.lms.course.dto.*;
import kz.jazz.lms.course.service.CourseReportService;
import kz.jazz.lms.course.service.CourseService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/courses")
public class CourseController {
    private final CourseService service;
    private final CourseReportService reports;

    public CourseController(CourseService service, CourseReportService reports) { this.service = service; this.reports = reports; }

    // --- Course -> Reports / Files (staff, правило в gateway) ---
    @GetMapping("/{id}/report/overview")
    public Map<String, Object> reportOverview(@PathVariable UUID id) { return reports.overview(id); }

    @GetMapping("/{id}/report/users")
    public List<Map<String, Object>> reportUsers(@PathVariable UUID id) { return reports.usersReport(id); }

    @GetMapping("/{id}/report/matrix")
    public Map<String, Object> reportMatrix(@PathVariable UUID id) { return reports.matrix(id); }

    @GetMapping("/{id}/files")
    public List<Map<String, Object>> files(@PathVariable UUID id) { return reports.files(id); }

    @PostMapping("/{id}/clone")
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto clone(@PathVariable UUID id, @RequestHeader("X-User-Id") UUID userId,
                           @RequestHeader("X-User-Role") String role) { return service.clone(id, userId, role); }

    @GetMapping
    public List<CourseDto> list(@RequestParam(required = false) String search) { return service.findAll(search); }

    @GetMapping("/{id}")
    public CourseDto get(@PathVariable UUID id) { return service.findById(id); }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CourseDto create(@Valid @RequestBody CourseRequest req,
                            @RequestHeader(value = "X-User-Id", required = false) UUID userId) {
        return service.create(req, userId);
    }

    @PutMapping("/{id}")
    public CourseDto update(@PathVariable UUID id, @Valid @RequestBody CourseRequest req,
                            @RequestHeader(value = "X-User-Id", required = false) UUID userId,
                            @RequestHeader(value = "X-User-Role", required = false) String role) {
        return service.update(id, req, userId, role);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestHeader("X-User-Id") UUID userId,
                       @RequestHeader("X-User-Role") String role) {
        service.delete(id, userId, role);
    }

    /** Каталог для самозаписи (доступен всем ролям). */
    @GetMapping("/catalog")
    public List<Map<String, Object>> catalog(@RequestHeader("X-User-Id") UUID userId) { return service.catalog(userId); }

    @PostMapping("/{id}/enroll")
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentDto selfEnroll(@PathVariable UUID id, @RequestHeader("X-User-Id") UUID userId) { return service.selfEnroll(id, userId); }

    @GetMapping("/stats")
    public Map<String, Long> stats() { return service.stats(); }

    // --- корзина: мягко удалённые курсы (только администратор, правило в gateway) ---

    @GetMapping("/deleted")
    public List<CourseDto> deleted() { return service.deleted(); }

    @PostMapping("/{id}/restore")
    public CourseDto restore(@PathVariable UUID id, @RequestHeader("X-User-Id") UUID userId) {
        return service.restore(id, userId);
    }

    @DeleteMapping("/{id}/permanent")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePermanently(@PathVariable UUID id) { service.deletePermanently(id); }

    // --- enrollments (вложенный ресурс) ---

    @GetMapping("/{id}/enrollments")
    public List<EnrollmentDto> enrollments(@PathVariable UUID id) { return service.enrollmentsOfCourse(id); }

    @PostMapping("/{id}/enrollments")
    @ResponseStatus(HttpStatus.CREATED)
    public EnrollmentDto enroll(@PathVariable UUID id, @Valid @RequestBody EnrollRequest req) { return service.enroll(id, req); }
}
