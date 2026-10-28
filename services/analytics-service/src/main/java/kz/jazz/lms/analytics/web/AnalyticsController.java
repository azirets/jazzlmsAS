package kz.jazz.lms.analytics.web;

import kz.jazz.lms.analytics.service.StatsService;
import kz.jazz.lms.analytics.service.TimelineService;
import kz.jazz.lms.events.EventType;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {
    private final StatsService stats;
    private final TimelineService timeline;

    public AnalyticsController(StatsService stats, TimelineService timeline) {
        this.stats = stats;
        this.timeline = timeline;
    }

    /** GET /api/analytics/dashboard?period=today|yesterday|week|month */
    @GetMapping("/dashboard")
    public Map<String, Object> dashboard(@RequestParam(defaultValue = "today") String period) {
        if (!java.util.Set.of("today", "yesterday", "week", "month").contains(period))
            throw new IllegalArgumentException("period must be one of today, yesterday, week, month");
        return stats.dashboard(period);
    }

    /**
     * GET /api/analytics/timeline?from=2026-08-18&to=2026-09-17&type=USER_LOGGED_IN&userId=..&courseId=..&page=0&size=10
     * Все параметры необязательны. Ответ: { items, total, page, size } — фронт рисует "1 to 10 of 86".
     */
    @GetMapping("/timeline")
    public TimelineService.Page timeline(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) EventType type,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String courseId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        if (page < 0 || size < 1) throw new IllegalArgumentException("page must be >= 0 and size >= 1");
        return timeline.find(new TimelineService.Filter(from, to, type, userId, courseId), page, size);
    }

    /** Те же фильтры, но ответ — файл CSV ("Save as CSV"). */
    @GetMapping("/timeline/export")
    public ResponseEntity<String> export(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) EventType type,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String courseId) {
        String csv = timeline.exportCsv(new TimelineService.Filter(from, to, type, userId, courseId));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"timeline.csv\"")
                .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                .body("﻿" + csv);   // BOM, чтобы Excel правильно открыл кириллицу
    }

    /** Показатели Today / Week для таблицы на главной администратора. */
    @GetMapping("/summary")
    public Map<String, Object> summary() { return stats.summary(); }

    /** Users -> Progress: активность одного пользователя. period = today|yesterday|week|month|year */
    @GetMapping("/users/{id}/activity")
    public Map<String, Object> userActivity(@PathVariable String id, @RequestParam(defaultValue = "month") String period) {
        return timeline.userActivity(id, period);
    }

    /** Course -> Reports: назначения и завершения по курсу. */
    @GetMapping("/courses/{id}/activity")
    public Map<String, Object> courseActivity(@PathVariable String id, @RequestParam(defaultValue = "month") String period) {
        return timeline.courseActivity(id, period);
    }

    /** Вкладка Overview: события по типам (Mongo $group) + топ активных (Redis ZSET). */
    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return Map.of("eventsByType", timeline.countByType(), "topUsers", stats.topUsers(10));
    }

    @GetMapping("/top-users")
    public List<Map<String, Object>> topUsers(@RequestParam(defaultValue = "10") int limit) {
        return stats.topUsers(limit);
    }
}
