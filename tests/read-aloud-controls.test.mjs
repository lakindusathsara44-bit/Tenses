import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const activitiesHtml = readFileSync(new URL("../activities.html", import.meta.url), "utf8");

test("lesson examples, passive examples and form examples expose read-aloud controls", () => {
  assert.match(indexHtml, /addReadAloud\(card\.querySelector\('\.sentence'\)\)/);
  assert.match(indexHtml, /addReadAloud\(card\.querySelector\('\.passive p'\)\)/);
  assert.match(indexHtml, /addReadAloud\(c\.querySelectorAll\('span'\)\[1\]\)/);
});

test("activity prompts, translations and sentence choices expose read-aloud controls", () => {
  assert.match(activitiesHtml, /addReadAloud\(card\.querySelector\("p"\)\)/);
  assert.match(activitiesHtml, /addReadAloud\(answer\)/);
  assert.match(activitiesHtml, /if\(isSpeakableSentence\(opt\)\)wrap\.append\(createSpeakButton\(opt\)\)/);
});

test("read-aloud button uses the browser speech engine and English voice settings", () => {
  const start = indexHtml.indexOf("function createSpeakButton(text){");
  const end = indexHtml.indexOf("function addReadAloud(element){", start);
  assert.ok(start >= 0 && end > start, "speech helper must exist");
  const helper = indexHtml.slice(start, end);
  const calls = [];
  class FakeUtterance {
    constructor(text) { this.text = text; }
  }
  const context = {
    document: {
      createElement() {
        return {
          listeners: {},
          setAttribute(name, value) { this[name] = value; },
          addEventListener(name, callback) { this.listeners[name] = callback; }
        };
      }
    },
    window: {
      speechSynthesis: {
        cancel() { calls.push("cancel"); },
        getVoices() { return [{ lang: "en-GB", name: "English" }]; },
        speak(utterance) { calls.push(utterance); }
      }
    },
    SpeechSynthesisUtterance: FakeUtterance
  };
  vm.runInNewContext(helper + "\nglobalThis.makeButton = createSpeakButton;", context);
  const button = context.makeButton("She writes a letter.");
  button.listeners.click();
  assert.equal(calls[0], "cancel");
  assert.equal(calls[1].text, "She writes a letter.");
  assert.equal(calls[1].lang, "en-US");
  assert.equal(calls[1].rate, 0.9);
  assert.equal(calls[1].voice.lang, "en-GB");
});

test("read-aloud helper avoids duplicate buttons and skips passive notes", () => {
  const start = indexHtml.indexOf("function createSpeakButton(text){");
  const end = indexHtml.indexOf("function renderTab(){", start);
  const helper = indexHtml.slice(start, end);
  const context = {
    document: { createElement() { return { className: "", addEventListener() {}, setAttribute() {} }; } },
    window: { speechSynthesis: { cancel() {}, getVoices() { return []; }, speak() {} } },
    SpeechSynthesisUtterance: class {}
  };
  vm.runInNewContext(helper + "\nglobalThis.attach = addReadAloud;", context);
  const element = {
    textContent: "The letter is written.",
    children: [],
    querySelector(selector) { return selector === ":scope > .speak-btn" && this.children.some(x => x.className === "speak-btn") ? this.children[0] : null; },
    append(child) { this.children.push(child); }
  };
  context.attach(element);
  context.attach(element);
  assert.equal(element.children.length, 1);
  const note = { textContent: "— No natural passive form.", children: [], querySelector() { return null; }, append(child) { this.children.push(child); } };
  context.attach(note);
  assert.equal(note.children.length, 0);
});


test("both learning pages include the WhatsApp issue-contact button with the requested prefilled message", () => {
  for (const html of [indexHtml, activitiesHtml]) {
    assert.match(html, /class="whatsapp-issue-btn"/);
    assert.match(html, /https:\/\/wa\.me\/94703809347\?text=Here%20is%20my%20problem%2Fissues%3A%20/);
    assert.match(html, /target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /Ask \/ Report an Issue/);
  }
});


test("lesson paragraphs and activity descriptions expose their own read buttons", () => {
  assert.match(indexHtml, /const paragraph=section\.querySelector\('\.hint'\);if\(paragraph\)addReadAloud\(paragraph\)/);
  assert.match(activitiesHtml, /addReadAloud\(document\.getElementById\("taskDesc"\)\)/);
  assert.match(activitiesHtml, /value\.split\(\/\\s\+\/\)/);
});

test("activity answer choices receive read buttons only when they are complete sentences", () => {
  assert.match(activitiesHtml, /if\(isSpeakableSentence\(opt\)\)wrap\.append\(createSpeakButton\(opt\)\)/);
  const start = activitiesHtml.indexOf("function isSpeakableSentence(text){");
  const end = activitiesHtml.indexOf("\n}", start);
  assert.ok(start >= 0 && end > start, "sentence detector must exist");
  const detector = activitiesHtml.slice(start, end + 2);
  const context = {};
  vm.runInNewContext(detector + "\nglobalThis.checkSentence = isSpeakableSentence;", context);
  assert.equal(context.checkSentence("The student reads every day."), true);
  assert.equal(context.checkSentence("reads every day"), false);
  assert.equal(context.checkSentence("A short option"), false);
});
