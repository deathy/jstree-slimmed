'use strict';

/*
 * Bundlers / CommonJS consumers load the package through `main` and get jQuery via require('jquery').
 * jQuery is a peer dependency, so jstree has to register itself on the app's own jQuery instance.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const pkg = require('../../package.json');

describe('CommonJS loading', function () {
	let dom;
	const globals = ['window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node'];
	before(function () {
		dom = new JSDOM('<!doctype html><html><body><div id="tree"></div></body></html>', { pretendToBeVisual: true });
		globals.forEach(function (g) {
			Object.defineProperty(globalThis, g, { configurable: true, writable: true, value: dom.window[g] });
		});
	});
	after(function () {
		globals.forEach(function (g) { delete globalThis[g]; });
		dom.window.close();
	});

	it('registers on the jQuery instance the app requires', function () {
		const $ = require('jquery');
		assert.equal(Number($.fn.jquery.split('.')[0]), 4);
		assert.equal($.fn.jstree, undefined);
		require(path.join(__dirname, '..', '..', pkg.main));
		assert.equal(typeof $.fn.jstree, 'function');
		assert.equal($.jstree.version, pkg.version);
	});

	it('works through that instance', async function () {
		const $ = require('jquery');
		const t = await new Promise(function (resolve) {
			$('#tree').one('ready.jstree', function () { resolve($('#tree').jstree(true)); })
				.jstree({ core: { data: [{ id: 'n1', text: 'Node' }] }, plugins: ['checkbox'] });
		});
		t.check_node('n1');
		assert.equal(t.is_checked('n1'), true);
		assert.equal(dom.window.document.querySelectorAll('#tree .jstree-anchor').length, 1);
	});
});

describe('package metadata', function () {
	it('declares jQuery 4 as a peer dependency only', function () {
		assert.equal(pkg.peerDependencies.jquery, '^4.0.0');
		assert.equal((pkg.dependencies || {}).jquery, undefined);
		assert.match(pkg.version, /^4\.\d+\.\d+-slimmed$/);
	});
});
