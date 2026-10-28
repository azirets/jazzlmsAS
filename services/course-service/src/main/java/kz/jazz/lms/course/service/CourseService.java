package kz.jazz.lms.course.service;

import kz.jazz.lms.course.client.UserClient;
import kz.jazz.lms.course.domain.Category;
import kz.jazz.lms.course.domain.Course;
import kz.jazz.lms.course.domain.Enrollment;
import kz.jazz.lms.course.domain.Unit;
import kz.jazz.lms.course.dto.*;
import kz.jazz.lms.course.repository.CategoryRepository;
import kz.jazz.lms.course.repository.CourseRepository;
import kz.jazz.lms.course.repository.EnrollmentRepository;
import kz.jazz.lms.course.repository.UnitProgressRepository;
import kz.jazz.lms.course.repository.UnitRepository;
import kz.jazz.lms.course.storage.FileStorage;
import kz.jazz.lms.events.EventType;
import kz.jazz.lms.events.Topics;
import kz.jazz.lms.grpc.user.UserResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@Transactional
public class CourseService {
    private static final Logger log = LoggerFactory.getLogger(CourseService.class);

    private final CourseRepository courses;
    private final CategoryRepository categories;
    private final EnrollmentRepository enrollments;
    private final UserClient users;
    private final CourseEventPublisher events;
    private final UnitRepository units;
    private final FileStorage storage;
    private final UnitProgressRepository unitProgress;
    private final CertificateService certificates;

    public CourseService(CourseRepository courses, CategoryRepository categories, EnrollmentRepository enrollments,
                         UserClient users, CourseEventPublisher events, UnitRepository units, FileStorage storage,
                         UnitProgressRepository unitProgress, CertificateService certificates) {
        this.certificates = certificates;
        this.unitProgress = unitProgress;
        this.units = units;
        this.storage = storage;
        this.courses = courses;
        this.categories = categories;
        this.enrollments = enrollments;
        this.users = users;
        this.events = events;
    }

    @Transactional(readOnly = true)
    public List<CourseDto> findAll(String search) {
        List<Course> list = (search == null || search.isBlank()) ? courses.findByDeletedAtIsNull()
                : courses.findByNameContainingIgnoreCaseAndDeletedAtIsNull(search);
        Map<UUID, String> catNames = new HashMap<>();
        categories.findAll().forEach(c -> catNames.put(c.getId(), c.getName()));
        return list.stream()
                .map(c -> CourseDto.from(c, catNames.get(c.getCategoryId()),
                        enrollments.countByCourseIdAndRole(c.getId(), Enrollment.Role.LEARNER)))
                .toList();
    }

    @Transactional(readOnly = true)
    public CourseDto findById(UUID id) {
        return toDto(getEntity(id));
    }

    public CourseDto create(CourseRequest req, UUID createdBy) {
        log.info("Creating course '{}' by {}", req.name(), createdBy);
        Course c = new Course();
        apply(c, req);
        if (c.getCertificateTemplateId() == null && !Boolean.TRUE.equals(req.noCertificate()))
            c.setCertificateTemplateId(certificates.defaultTemplateId());   // новый курс выдаёт сертификат по умолчанию
        c.setCreatedBy(createdBy);
        Course saved = courses.save(c);
        if (createdBy != null) {
            // как в TalentLMS: создатель курса сразу становится его преподавателем ("1 instructor")
            Enrollment own = new Enrollment();
            own.setCourseId(saved.getId());
            own.setUserId(createdBy);
            own.setRole(Enrollment.Role.INSTRUCTOR);
            enrollments.save(own);
        }
        events.publish(Topics.COURSE_EVENTS, EventType.COURSE_CREATED, saved.getId().toString(), Map.of(
                "courseId", saved.getId().toString(),
                "courseName", saved.getName(),
                "userId", createdBy == null ? "" : createdBy.toString()));
        return toDto(saved);
    }

    public CourseDto update(UUID id, CourseRequest req, UUID userId, String role) {
        log.info("Updating course {} by {}", id, userId);
        Course c = getEntity(id);
        requireManage(c, userId, role);
        apply(c, req);
        Course saved = courses.save(c);
        events.publish(Topics.COURSE_EVENTS, EventType.COURSE_UPDATED, id.toString(),
                Map.of("courseId", id.toString(), "courseName", saved.getName(), "userId", userId == null ? "" : userId.toString()));
        return toDto(saved);
    }

    @Transactional(readOnly = true)
    public Map<String, Long> stats() {
        return Map.of(
                "activeCourses", courses.countByActiveTrueAndDeletedAtIsNull(),
                "assignedCourses", enrollments.countAssigned(),
                "courseCompletions", enrollments.countCompleted(),
                "inProgress", enrollments.countInProgress(),
                "trainingSeconds", (long) unitProgress.totalTrainingSeconds());
    }

    /** Clone: копия курса со всеми уроками. Файлы в MinIO тоже копируются — иначе удаление одного курса сломало бы другой. */
    public CourseDto clone(UUID id, UUID userId, String role) {
        log.info("Cloning course {} by {}", id, userId);
        Course src = getEntity(id);
        requireManage(src, userId, role);
        Course copy = new Course();
        copy.setName(src.getName() + " (copy)");
        copy.setCode(src.getCode()); copy.setDescription(src.getDescription()); copy.setCategoryId(src.getCategoryId());
        copy.setPrice(src.getPrice()); copy.setCapacity(src.getCapacity()); copy.setLevel(src.getLevel());
        copy.setActive(false);                                    // копия неактивна, пока преподаватель её не проверит
        copy.setHiddenFromCatalog(src.isHiddenFromCatalog()); copy.setSequential(src.isSequential());
        copy.setCertificateTemplateId(src.getCertificateTemplateId());
        copy.setCreatedBy(userId);
        Course saved = courses.save(copy);
        if (userId != null) {
            Enrollment own = new Enrollment(); own.setCourseId(saved.getId()); own.setUserId(userId); own.setRole(Enrollment.Role.INSTRUCTOR);
            enrollments.save(own);
        }
        for (Unit u : units.findByCourseIdOrderByPositionAsc(id)) {
            Unit n = new Unit();
            n.setCourseId(saved.getId()); n.setType(u.getType()); n.setName(u.getName()); n.setPosition(u.getPosition()); n.setActive(u.isActive());
            n.setCompletionType(u.getCompletionType()); n.setTimeLimitSeconds(u.getTimeLimitSeconds()); n.setQuestion(u.getQuestion()); n.setAnswer(u.getAnswer());
            n.setSourceType(u.getSourceType()); n.setYoutubeUrl(u.getYoutubeUrl()); n.setTextContent(u.getTextContent());
            n.setAutoplay(u.isAutoplay()); n.setShowSpeed(u.isShowSpeed()); n.setDescription(u.getDescription()); n.setCreatedBy(userId);
            if (u.getFileKey() != null) {
                n.setFileKey(storage.copy(u.getFileKey(), saved.getId()));
                n.setFileName(u.getFileName()); n.setFileContentType(u.getFileContentType()); n.setFileSize(u.getFileSize());
            }
            units.save(n);
        }
        events.publish(Topics.COURSE_EVENTS, EventType.COURSE_CREATED, saved.getId().toString(), Map.of(
                "courseId", saved.getId().toString(), "courseName", saved.getName(), "userId", userId == null ? "" : userId.toString(), "clonedFrom", id.toString()));
        return toDto(saved);
    }

    /** Редактировать и клонировать может админ, создатель курса или преподаватель, записанный на курс как INSTRUCTOR. */
    private void requireManage(Course c, UUID userId, String role) {
        boolean admin = "ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        if (admin) return;
        boolean owner = userId != null && userId.equals(c.getCreatedBy());
        boolean instructor = userId != null && enrollments.findByCourseIdAndUserId(c.getId(), userId)
                .map(e -> e.getRole() == Enrollment.Role.INSTRUCTOR).orElse(false);
        if (!owner && !instructor) throw new ForbiddenException("You are not an instructor of this course");
    }

    /** Мягкое удаление. Преподаватель может удалить только свой курс, админ — любой. */
    public void delete(UUID id, UUID userId, String role) {
        log.info("Soft-deleting course {} by {}", id, userId);
        Course c = getEntity(id);
        boolean admin = "ADMIN".equals(role) || "SUPER_ADMIN".equals(role);
        if (!admin && (userId == null || !userId.equals(c.getCreatedBy())))
            throw new ForbiddenException("Only the course creator or an administrator can delete it");
        c.setDeletedAt(Instant.now());
        courses.save(c);
        publishLifecycle(EventType.COURSE_DELETED, c, userId);
    }

    @Transactional(readOnly = true)
    public List<CourseDto> deleted() {
        return courses.findByDeletedAtIsNotNull().stream().map(this::toDto).toList();
    }

    /** Undo delete: просто снимаем пометку — уроки, записи и файлы никуда не девались. */
    public CourseDto restore(UUID id, UUID userId) {
        log.info("Restoring course {}", id);
        Course c = courses.findById(id).filter(x -> x.getDeletedAt() != null)
                .orElseThrow(() -> new NotFoundException("Deleted course not found: " + id));
        c.setDeletedAt(null);
        Course saved = courses.save(c);
        publishLifecycle(EventType.COURSE_RESTORED, saved, userId);
        return toDto(saved);
    }

    /** Необратимо: сначала файлы уроков из MinIO, потом строка курса (units и enrollments уйдут каскадом). */
    public void deletePermanently(UUID id) {
        log.info("Permanently deleting course {} with its files", id);
        Course c = courses.findById(id).filter(x -> x.getDeletedAt() != null)
                .orElseThrow(() -> new NotFoundException("Deleted course not found: " + id));
        units.findByCourseIdOrderByPositionAsc(id).forEach(u -> storage.delete(u.getFileKey()));
        courses.delete(c);
    }

    private void publishLifecycle(EventType type, Course c, UUID userId) {
        events.publish(Topics.COURSE_EVENTS, type, c.getId().toString(), Map.of(
                "courseId", c.getId().toString(), "courseName", c.getName(),
                "userId", userId == null ? "" : userId.toString()));
    }

    // ---------- enrollments ----------

    @Transactional(readOnly = true)
    public List<EnrollmentDto> enrollmentsOfCourse(UUID courseId) {
        getEntity(courseId);
        List<Enrollment> list = enrollments.findByCourseId(courseId);
        // один gRPC-запрос за всеми пользователями сразу
        Map<String, UserResponse> userMap = users.getUsers(list.stream().map(Enrollment::getUserId).toList());
        return list.stream().map(e -> {
            UserResponse u = userMap.get(e.getUserId().toString());
            return EnrollmentDto.from(e,
                    u == null ? "(unknown)" : u.getFirstName() + " " + u.getLastName(),
                    u == null ? null : u.getEmail());
        }).toList();
    }

    /** Мои курсы + роль в курсе (LEARNER / INSTRUCTOR) + прогресс. role == null -> все. */
    @Transactional(readOnly = true)
    public List<MyEnrollmentDto> coursesOfUser(UUID userId, Enrollment.Role role) {
        List<Enrollment> mine = enrollments.findByUserId(userId).stream()
                .filter(e -> role == null || e.getRole() == role).toList();
        // преподаватели всех моих курсов: один запрос в БД + один batch-вызов gRPC (а не N+1)
        List<Enrollment> instructors = enrollments.findByCourseIdInAndRole(mine.stream().map(Enrollment::getCourseId).toList(), Enrollment.Role.INSTRUCTOR);
        Map<String, UserResponse> names = users.getUsers(instructors.stream().map(Enrollment::getUserId).distinct().toList());
        return mine.stream()
                .map(e -> courses.findById(e.getCourseId()).filter(c -> c.getDeletedAt() == null)
                        .map(c -> new MyEnrollmentDto(e.getId(), e.getRole(), e.getProgress(), e.getEnrolledAt(), e.getCompletedAt(), toDto(c),
                                instructors.stream().filter(i -> i.getCourseId().equals(c.getId()))
                                        .map(i -> names.get(i.getUserId().toString()))
                                        .filter(Objects::nonNull).map(u -> u.getFirstName() + " " + u.getLastName()).toList()))
                        .orElse(null))
                .filter(Objects::nonNull)
                .toList();
    }

    /** Панель ученика: курсы в процессе и время обучения. */
    @Transactional(readOnly = true)
    public Map<String, Long> myStats(UUID userId) {
        long inProgress = enrollments.findByUserId(userId).stream()
                .filter(e -> e.getRole() == Enrollment.Role.LEARNER && e.getCompletedAt() == null)
                .filter(e -> courses.findById(e.getCourseId()).map(c -> c.getDeletedAt() == null).orElse(false))
                .count();
        return Map.of("coursesInProgress", inProgress, "trainingSeconds", (long) unitProgress.trainingSecondsOf(userId));
    }

    /** Каталог: активные и не скрытые курсы + признак "я уже записан". */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> catalog(UUID userId) {
        Set<UUID> mine = enrollments.findByUserId(userId).stream().map(Enrollment::getCourseId).collect(java.util.stream.Collectors.toSet());
        return courses.findByDeletedAtIsNull().stream()
                .filter(c -> c.isActive() && !c.isHiddenFromCatalog())
                .map(c -> { Map<String, Object> m = new HashMap<>(); m.put("course", toDto(c)); m.put("enrolled", mine.contains(c.getId())); return m; })
                .toList();
    }

    /** Самозапись из каталога: пользователь записывает сам себя, роль всегда LEARNER. */
    public EnrollmentDto selfEnroll(UUID courseId, UUID userId) {
        Course c = getEntity(courseId);
        if (!c.isActive() || c.isHiddenFromCatalog()) throw new NotFoundException("Course is not available in the catalog");
        return enroll(courseId, new EnrollRequest(userId, Enrollment.Role.LEARNER));
    }

    /**
     * Запись на курс — пример синхронного межсервисного взаимодействия (gRPC)
     * + асинхронного (Kafka): проверяем пользователя у user-service, сохраняем,
     * публикуем событие, которое подхватят notification- и analytics-service.
     */
    public EnrollmentDto enroll(UUID courseId, EnrollRequest req) {
        Course course = getEntity(courseId);
        if (enrollments.findByCourseIdAndUserId(courseId, req.userId()).isPresent())
            throw new ConflictException("User already enrolled");
        if (!users.existsAndActive(req.userId()))
            throw new NotFoundException("Active user not found in user-service: " + req.userId());
        if (course.getCapacity() != null
                && enrollments.countByCourseIdAndRole(courseId, Enrollment.Role.LEARNER) >= course.getCapacity())
            throw new ConflictException("Course is full");

        Enrollment e = new Enrollment();
        e.setCourseId(courseId);
        e.setUserId(req.userId());
        e.setRole(req.role() == null ? Enrollment.Role.LEARNER : req.role());
        Enrollment saved = enrollments.save(e);

        UserResponse u = users.getUser(req.userId()).orElse(null);
        events.publish(Topics.ENROLLMENT_EVENTS, EventType.USER_ENROLLED, req.userId().toString(), payload(course, saved, u));
        return EnrollmentDto.from(saved, u == null ? "" : u.getFirstName() + " " + u.getLastName(), u == null ? null : u.getEmail());
    }

    /** Вызывается из UnitService после прохождения урока. Преподаватель без записи LEARNER — пропускаем. */
    public void setProgressFor(UUID courseId, UUID userId, int progress) {
        enrollments.findByCourseIdAndUserId(courseId, userId)
                .filter(e -> e.getRole() == Enrollment.Role.LEARNER)
                .ifPresent(e -> updateProgress(e.getId(), progress));
    }

    public EnrollmentDto updateProgress(UUID enrollmentId, int progress) {
        log.info("Enrollment {} progress -> {}%", enrollmentId, progress);
        Enrollment e = enrollments.findById(enrollmentId)
                .orElseThrow(() -> new NotFoundException("Enrollment not found: " + enrollmentId));
        e.setProgress(Math.max(0, Math.min(100, progress)));
        boolean justCompleted = e.getProgress() == 100 && e.getCompletedAt() == null;
        if (justCompleted) e.setCompletedAt(Instant.now());
        Enrollment saved = enrollments.save(e);
        UserResponse u = users.getUser(e.getUserId()).orElse(null);
        if (justCompleted) {
            Course course = getEntity(e.getCourseId());
            events.publish(Topics.ENROLLMENT_EVENTS, EventType.COURSE_COMPLETED, e.getUserId().toString(), payload(course, saved, u));
            certificates.issue(course, e.getUserId(), u);   // сертификат, если у курса задан шаблон
        }
        return EnrollmentDto.from(saved, u == null ? "" : u.getFirstName() + " " + u.getLastName(), u == null ? null : u.getEmail());
    }

    public void unenroll(UUID enrollmentId) {
        if (!enrollments.existsById(enrollmentId)) throw new NotFoundException("Enrollment not found: " + enrollmentId);
        enrollments.deleteById(enrollmentId);
    }

    // ---------- helpers ----------

    private Map<String, String> payload(Course course, Enrollment e, UserResponse u) {
        Map<String, String> p = new HashMap<>();
        p.put("courseId", course.getId().toString());
        p.put("courseName", course.getName());
        p.put("enrollmentId", e.getId().toString());
        p.put("userId", e.getUserId().toString());
        p.put("progress", String.valueOf(e.getProgress()));
        if (u != null) {
            p.put("email", u.getEmail());
            p.put("firstName", u.getFirstName());
            p.put("lastName", u.getLastName());
        }
        return p;
    }

    private void apply(Course c, CourseRequest req) {
        if (req.categoryId() != null && !categories.existsById(req.categoryId()))
            throw new NotFoundException("Category not found: " + req.categoryId());
        c.setName(req.name());
        c.setCode(req.code());
        c.setDescription(req.description());
        c.setCategoryId(req.categoryId());
        c.setPrice(req.price());
        c.setCapacity(req.capacity());
        c.setLevel(req.level());
        if (req.active() != null) c.setActive(req.active());
        if (req.hiddenFromCatalog() != null) c.setHiddenFromCatalog(req.hiddenFromCatalog());
        if (req.sequential() != null) c.setSequential(req.sequential());
        // Сертификат: noCertificate = true отключает, иначе берём явно выбранный шаблон (ничего не прислали — не трогаем)
        if (Boolean.TRUE.equals(req.noCertificate())) c.setCertificateTemplateId(null);
        else if (req.certificateTemplateId() != null) c.setCertificateTemplateId(req.certificateTemplateId());
    }

    private CourseDto toDto(Course c) {
        String catName = c.getCategoryId() == null ? null
                : categories.findById(c.getCategoryId()).map(Category::getName).orElse(null);
        return CourseDto.from(c, catName, enrollments.countByCourseIdAndRole(c.getId(), Enrollment.Role.LEARNER));
    }

    private Course getEntity(UUID id) {
        return courses.findById(id).filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> new NotFoundException("Course not found: " + id));
    }
}
