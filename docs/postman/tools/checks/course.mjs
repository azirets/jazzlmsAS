import { group } from '../lib.mjs';
import { fixtures, categories, courses, enrollments, reports } from './course-a.mjs';
import { units, learnerFlow, certificates } from './course-b.mjs';
import { questions, tests, cleanup } from './course-c.mjs';

export default function build() {
  return group('08 Checks · course-service · Aziret', () => {
    fixtures();
    categories();
    courses();
    enrollments();
    reports();
    units();
    learnerFlow();
    certificates();
    questions();
    tests();
    cleanup();
  });
}
