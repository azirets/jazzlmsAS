package kz.jazz.lms.user.service;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import kz.jazz.lms.events.EventType;
import kz.jazz.lms.user.domain.UserType;
import kz.jazz.lms.user.dto.CreateUserRequest;
import kz.jazz.lms.user.dto.ImportResult;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Импорт пользователей из CSV ("Add user -> Import user(s)").
 * Формат: firstName,lastName,email,username,password,userType (первая строка — заголовок, password и userType необязательны).
 *
 * Сервис намеренно БЕЗ @Transactional: каждая строка сохраняется своей транзакцией (userService.create),
 * поэтому одна плохая строка не откатывает весь файл — она просто попадает в список skipped.
 * Каждый созданный пользователь даёт событие USER_CREATED в Kafka, как при ручном создании.
 */
@Service
public class UserImportService {
    private static final int MAX_ROWS = 1000;

    private final UserService users;
    private final Validator validator;

    public UserImportService(UserService users, Validator validator) {
        this.users = users;
        this.validator = validator;
    }

    public ImportResult importCsv(MultipartFile file) throws IOException {
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        String mime = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
        if (!(name.endsWith(".csv") || mime.contains("csv") || mime.startsWith("text/") || mime.equals("application/vnd.ms-excel")))
            throw new BadRequestException("Only CSV files can be imported");
        List<ImportResult.Skipped> skipped = new ArrayList<>();
        int created = 0, lineNo = 0;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNo++;
                line = line.replace("﻿", "").trim();
                if (line.isEmpty() || (lineNo == 1 && line.toLowerCase().startsWith("firstname"))) continue;
                if (lineNo > MAX_ROWS) { skipped.add(new ImportResult.Skipped(lineNo, "", "Row limit " + MAX_ROWS + " exceeded")); break; }

                List<String> c = Csv.parseLine(line);
                if (c.size() < 4) { skipped.add(new ImportResult.Skipped(lineNo, line, "Expected at least 4 columns")); continue; }
                try {
                    UserType type = c.size() > 5 && !c.get(5).isBlank() ? UserType.valueOf(c.get(5).toUpperCase()) : UserType.LEARNER;
                    if (type == UserType.SUPER_ADMIN) throw new IllegalArgumentException("SUPER_ADMIN cannot be imported");
                    String password = c.size() > 4 && !c.get(4).isBlank() ? c.get(4) : null;
                    CreateUserRequest req = new CreateUserRequest(c.get(0), c.get(1), c.get(2), c.get(3), password,
                            type, null, null, null, true, false);

                    // Та же Bean Validation, что срабатывает на @Valid в контроллере, но вызванная вручную
                    Set<ConstraintViolation<CreateUserRequest>> errors = validator.validate(req);
                    if (!errors.isEmpty()) {
                        String msg = errors.stream().map(v -> v.getPropertyPath() + ": " + v.getMessage()).sorted().collect(Collectors.joining("; "));
                        skipped.add(new ImportResult.Skipped(lineNo, c.get(3), msg));
                        continue;
                    }
                    users.create(req, EventType.USER_CREATED);
                    created++;
                } catch (ConflictException | IllegalArgumentException e) {
                    skipped.add(new ImportResult.Skipped(lineNo, c.get(3), e.getMessage()));
                }
            }
        }
        return new ImportResult(created, skipped);
    }
}
