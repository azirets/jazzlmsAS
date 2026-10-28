package kz.jazz.lms.gateway.filter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;

/**
 * Глобальный фильтр: выполняется для каждого запроса ДО маршрутизации.
 *
 * 1. Публичные пути (login/register/actuator) пропускаем.
 * 2. Иначе требуем "Authorization: Bearer <jwt>".
 * 3. Проверяем подпись (тот же секрет, что у user-service).
 * 4. Кладём userId и role в заголовки X-User-Id / X-User-Role — сервисы за gateway доверяют им.
 * 5. Простая авторизация по ролям для "админских" операций.
 */
@Component
public class JwtAuthFilter implements GlobalFilter, Ordered {
    private static final Logger log = LoggerFactory.getLogger(JwtAuthFilter.class);

    private static final List<String> PUBLIC_PREFIXES = List.of(
            "/api/auth/login", "/api/auth/register", "/api/auth/settings", "/actuator");

    private static final Set<String> ADMIN_ROLES = Set.of("SUPER_ADMIN", "ADMIN");
    private static final Set<String> STAFF_ROLES = Set.of("SUPER_ADMIN", "ADMIN", "TRAINER");

    private final SecretKey key;
    private final String gatewayToken;

    public JwtAuthFilter(@Value("${jwt.secret}") String secret, @Value("${jwt.gateway-token}") String gatewayToken) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.gatewayToken = gatewayToken;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();

        if (request.getMethod() == HttpMethod.OPTIONS || PUBLIC_PREFIXES.stream().anyMatch(path::startsWith)) {
            return chain.filter(exchange);
        }

        String auth = request.getHeaders().getFirst("Authorization");
        if (auth == null || !auth.startsWith("Bearer ")) {
            return reject(exchange, HttpStatus.UNAUTHORIZED);
        }

        Claims claims;
        try {
            claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(auth.substring(7)).getPayload();
        } catch (JwtException e) {
            log.debug("JWT rejected: {}", e.getMessage());
            return reject(exchange, HttpStatus.UNAUTHORIZED);
        }

        String userId = claims.getSubject();
        String role = claims.get("role", String.class);

        if (!authorized(path, request.getMethod(), role)) {
            return reject(exchange, HttpStatus.FORBIDDEN);
        }

        // Клиент мог сам прислать X-User-* — затираем, чтобы нельзя было выдать себя за другого.
        ServerHttpRequest mutated = request.mutate()
                .headers(h -> {
                    h.remove("X-User-Id");
                    h.remove("X-User-Role");
                    h.add("X-User-Id", userId);
                    h.add("X-User-Role", role);
                    h.set("X-Gateway-Token", gatewayToken);   // сервис поймёт, что роли уже проверены здесь
                })
                .build();
        return chain.filter(exchange.mutate().request(mutated).build());
    }

    /** Кто что может. Learner: читать курсы/категории, свои записи, свой профиль. */
    private boolean authorized(String path, HttpMethod method, String role) {
        boolean write = method != HttpMethod.GET;
        if (path.startsWith("/api/auth/impersonate")) return ADMIN_ROLES.contains(role);   // Log into account
        // Account & Settings: настройки портала (user-service), геймификации и шаблоны сертификатов — только админ
        if (path.startsWith("/api/settings") || path.startsWith("/api/gamification/settings")
                || path.startsWith("/api/gamification/reset-statistics")) return ADMIN_ROLES.contains(role);
        if (path.startsWith("/api/certificates/templates")) return write ? ADMIN_ROLES.contains(role) : STAFF_ROLES.contains(role);
        if (path.startsWith("/api/certificates/user/")) return STAFF_ROLES.contains(role);   // сертификаты чужого пользователя
        if (path.startsWith("/api/enrollments/user/")) return STAFF_ROLES.contains(role);  // отчёт по чужому пользователю
        if (path.startsWith("/api/notifications")) return ADMIN_ROLES.contains(role);
        if (path.startsWith("/api/analytics")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/gamification/users/")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/units/files/") || path.startsWith("/api/analytics/users/") || path.startsWith("/api/analytics/courses/")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/courses/") && (path.contains("/report/") || path.endsWith("/files"))) return STAFF_ROLES.contains(role);   // отчёты по курсу  // чужой игровой профиль
        if ((path.startsWith("/api/branches") || path.startsWith("/api/groups")) && write) return ADMIN_ROLES.contains(role);
        if (path.startsWith("/api/branches") || path.startsWith("/api/groups")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/users") && write) return ADMIN_ROLES.contains(role);
        if (path.startsWith("/api/users")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/courses") && path.endsWith("/enroll")) return true;   // самозапись из каталога
        // корзина курсов (Undo delete / Permanently delete) — только администраторы; проверяется ДО общего правила записи
        if (path.equals("/api/courses/deleted") || path.endsWith("/restore") || path.endsWith("/permanent"))
            return ADMIN_ROLES.contains(role);
        // список записей курса содержит имена и email других пользователей — только staff
        if (path.startsWith("/api/courses/") && path.endsWith("/enrollments")) return STAFF_ROLES.contains(role);
        if ((path.startsWith("/api/courses") || path.startsWith("/api/categories")) && write) return STAFF_ROLES.contains(role);
        // уроки: создавать/менять — преподаватели и админы; start/complete — любой записанный (проверит course-service)
        if (path.startsWith("/api/units") && write && !path.endsWith("/start") && !path.endsWith("/complete")
                && !path.contains("/test/attempts"))                       // попытки теста создаёт ученик
            return STAFF_ROLES.contains(role);
        // банк вопросов и создание тестов — только преподаватели/админы (в т.ч. чтение: там правильные ответы)
        if (path.startsWith("/api/questions") || path.contains("/questions") || path.endsWith("/tests")) return STAFF_ROLES.contains(role);
        if (path.startsWith("/api/enrollments") && write) return STAFF_ROLES.contains(role);   // в т.ч. PATCH /progress: у ученика прогресс считается из пройденных уроков
        return true;
    }

    private Mono<Void> reject(ServerWebExchange exchange, HttpStatus status) {
        exchange.getResponse().setStatusCode(status);
        if (status == HttpStatus.UNAUTHORIZED) exchange.getResponse().getHeaders().set("WWW-Authenticate", "Bearer");
        return exchange.getResponse().setComplete();
    }

    @Override
    public int getOrder() {
        return -100; // раньше RequestRateLimiter, чтобы X-User-Id уже был в заголовках
    }
}
