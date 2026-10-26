/*
 * Shared helpers for the jsdom based test suite.
 *
 * Every suite runs against each jQuery major we care about and against both
 * the plain and the minified build in dist/ (the files that actually ship).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

// "jquery" is the supported (peer) version, "jquery3" is kept to compare with the 3.3.x-slimmed line
const JQUERY = [
	{ name: 'jQuery 4', pkg: 'jquery', major: 4 },
	{ name: 'jQuery 3', pkg: 'jquery3', major: 3 }
];
const BUILDS = ['dist/jstree-slimmed.js', 'dist/jstree-slimmed.min.js'];

const cache = {};
function read(file) {
	if (!cache[file]) { cache[file] = fs.readFileSync(file, 'utf8'); }
	return cache[file];
}

function jqueryFile(pkg) {
	return path.join(ROOT, 'node_modules', pkg, 'dist', 'jquery.js');
}

// jsdom does no layout, so offsetHeight / getClientRects are always 0 and jQuery's :visible never matches.
// jstree relies on both for keyboard navigation, so fake a box for every element that is not display:none.
function fakeLayout(window) {
	const proto = window.HTMLElement.prototype;
	function rendered(el) {
		if (!el.isConnected) { return false; }
		for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
			if (window.getComputedStyle(n).display === 'none') { return false; }
		}
		return true;
	}
	Object.defineProperty(proto, 'offsetHeight', { configurable: true, get() { return rendered(this) ? 24 : 0; } });
	Object.defineProperty(proto, 'offsetWidth', { configurable: true, get() { return rendered(this) ? 100 : 0; } });
	proto.getClientRects = function () {
		return rendered(this) ? [{ top: 0, left: 0, width: 100, height: 24 }] : [];
	};
}

/**
 * Create a fresh window with jQuery, the jstree theme css and a jstree build loaded.
 * @param {Object} jq one of JQUERY
 * @param {String} build one of BUILDS
 * @param {Object} [opts] { body: html for <body>, url: document url }
 */
function createEnv(jq, build, opts) {
	opts = opts || {};
	const css = read(path.join(ROOT, 'dist', 'themes', 'default', 'style.css'));
	const dom = new JSDOM('<!doctype html><html><head><style>' + css + '</style></head><body>' + (opts.body || '') + '</body></html>', {
		url: opts.url || 'http://localhost/',
		runScripts: 'outside-only',
		pretendToBeVisual: true
	});
	const window = dom.window;
	const errors = [];
	window.addEventListener('error', function (e) { errors.push(e.error || e.message); });
	fakeLayout(window);
	window.eval(read(jqueryFile(jq.pkg)));
	window.eval(read(path.join(ROOT, build)));
	return { window, document: window.document, $: window.jQuery, errors };
}

/**
 * Create a tree and resolve with its instance once it fires ready.jstree.
 */
function createTree(env, selector, config) {
	const $ = env.$;
	return new Promise(function (resolve, reject) {
		const timer = setTimeout(function () { reject(new Error('tree did not become ready')); }, 2000);
		$(selector)
			.one('ready.jstree', function () {
				clearTimeout(timer);
				resolve($(selector).jstree(true));
			})
			.jstree(config);
	});
}

/**
 * Resolve with the arguments of the next `event` triggered on `el`.
 */
function nextEvent(env, el, event) {
	return new Promise(function (resolve, reject) {
		const timer = setTimeout(function () { reject(new Error('no ' + event + ' event')); }, 2000);
		env.$(el).one(event, function (e, data) {
			clearTimeout(timer);
			resolve(data);
		});
	});
}

/**
 * Dispatch a native (non jQuery) keyboard event, the way a real key press reaches jstree.
 */
function key(env, el, type, keyCode, extra) {
	const init = Object.assign({ bubbles: true, cancelable: true, keyCode: keyCode, which: keyCode, charCode: type === 'keypress' ? keyCode : 0 }, extra || {});
	const ev = new env.window.KeyboardEvent(type, init);
	// jsdom ignores the legacy keyCode / which / charCode init members
	['keyCode', 'which', 'charCode'].forEach(function (p) {
		if (ev[p] !== init[p]) { Object.defineProperty(ev, p, { value: init[p] }); }
	});
	el.dispatchEvent(ev);
	return ev;
}

/**
 * Dispatch a native mouse event.
 */
function mouse(env, el, type, extra) {
	const ev = new env.window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, button: 0 }, extra || {}));
	el.dispatchEvent(ev);
	return ev;
}

/**
 * deepStrictEqual for values created inside the jsdom window (their prototypes come from another realm).
 */
function same(actual, expected, message) {
	assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, message);
}

function wait(ms) {
	return new Promise(function (resolve) { setTimeout(resolve, ms || 0); });
}

// one level of children so lazy loading and cascading can be tested
const SAMPLE = [
	{ id: 'a', text: 'Alpha', state: { opened: true }, children: [
		{ id: 'a1', text: 'Apple', icon: 'jstree-file' },
		{ id: 'a2', text: 'Avocado', children: [
			{ id: 'a21', text: 'Hass' },
			{ id: 'a22', text: 'Fuerte' }
		] }
	] },
	{ id: 'b', text: 'Beta', children: [
		{ id: 'b1', text: 'Banana' }
	] },
	{ id: 'c', text: 'Cherry' }
];

function sample() {
	return JSON.parse(JSON.stringify(SAMPLE));
}

module.exports = { ROOT, JQUERY, BUILDS, createEnv, createTree, nextEvent, key, mouse, wait, sample, same, jqueryFile };
