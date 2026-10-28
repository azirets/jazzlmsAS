package kz.jazz.lms.course.web;

import kz.jazz.lms.course.dto.CourseDto;
import kz.jazz.lms.course.service.CourseReportService;
import kz.jazz.lms.course.service.CourseService;
import kz.jazz.lms.course.service.NotFoundException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Slice-тест контроллера: поднимается только web-слой, сервис подменён mock'ом.
 * БД, Kafka и gRPC не нужны.
 */
@WebMvcTest(CourseController.class)
class CourseControllerTest {

    @Autowired MockMvc mvc;
    @MockitoBean CourseService service;
    @MockitoBean CourseReportService reports;   // контроллер требует оба бина; в slice-тесте их подменяем

    @Test
    void listReturnsJson() throws Exception {
        CourseDto dto = new CourseDto(UUID.randomUUID(), "Java 21", "001", null, null, "Samples",
                null, null, null, true, false, null, Instant.now(), Instant.now(), 3, false, null);
        when(service.findAll(null)).thenReturn(List.of(dto));

        mvc.perform(get("/api/courses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Java 21"))
                .andExpect(jsonPath("$[0].learnersCount").value(3));
    }

    @Test
    void unknownCourseGives404ProblemDetail() throws Exception {
        when(service.findById(any())).thenThrow(new NotFoundException("Course not found"));

        mvc.perform(get("/api/courses/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.detail").value("Course not found"));
    }

    @Test
    void malformedCourseIdGives400ProblemDetail() throws Exception {
        mvc.perform(get("/api/courses/abc"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Invalid value for parameter: id"));
    }

    @Test
    void malformedJsonGives400ProblemDetail() throws Exception {
        mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/courses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{broken"))
                .andExpect(status().isBadRequest())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.detail").value("Request body is missing or malformed"));
    }
}
