import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const start = html.indexOf("function makeQuiz(root){");
const end = html.indexOf("\ndocument.querySelectorAll('.tab')", start);
assert.ok(start >= 0 && end > start, "quick-practice handler must exist");
const quizSource = html.slice(start, end);

function createElement() {
  return {
    textContent: "",
    disabled: false,
    children: [],
    onclick: null,
    style: {},
    _innerHTML: "",
    set innerHTML(value) { this._innerHTML = value; this.children = []; },
    get innerHTML() { return this._innerHTML; },
    append(child) { this.children.push(child); }
  };
}

function createQuiz() {
  const question = createElement();
  const options = createElement();
  const feedback = createElement();
  const next = createElement();
  const root = { querySelector(selector) {
    return ({ "#question": question, "#options": options, "#feedback": feedback, "#next": next })[selector];
  }};
  const context = {
    tenses: [{ a: "Affirmative", neg: "Negative", q: "Question", nq: "Negative question" }],
    current: 0,
    document: { createElement: createElement },
    Math: Object.assign(Object.create(Math), { random: () => 0 })
  };
  vm.runInNewContext(quizSource + "\nglobalThis.makeQuiz = makeQuiz;", context);
  context.makeQuiz(root);
  return { question, options, feedback, next };
}

test("a wrong quick-practice answer leaves the remaining choices available", () => {
  const quiz = createQuiz();
  const wrong = quiz.options.children.find(button => button.textContent !== "Affirmative");
  wrong.onclick();
  assert.equal(wrong.disabled, true, "the already-selected wrong choice should be disabled");
  assert.ok(quiz.options.children.some(button => !button.disabled), "learner must be able to try another choice");
  assert.match(quiz.feedback.textContent, /Not quite/);
});

test("a correct quick-practice answer locks all choices", () => {
  const quiz = createQuiz();
  const correct = quiz.options.children.find(button => button.textContent === "Affirmative");
  correct.onclick();
  assert.ok(quiz.options.children.every(button => button.disabled), "all choices should lock after a correct answer");
  assert.match(quiz.feedback.textContent, /Correct/);
});
