'use strict';

/*
 * Loads data over real HTTP (jsdom XHR against a local server) through $.ajax,
 * for both core.data and the massload plugin.
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { JQUERY, BUILDS, createEnv, createTree, nextEvent, same } = require('./helpers');

const NODES = {
	'#': [{ id: 'r1', text: 'Remote one', children: true }, { id: 'r2', text: 'Remote two', children: true }],
	r1: [{ id: 'r11', text: 'Child one' }],
	r2: [{ id: 'r21', text: 'Child two' }]
};

let server, base, requests;

// jstree consumes the objects it is given (like a fresh server response would be), so always hand out copies
function nodes(id) {
	return JSON.parse(JSON.stringify(NODES[id] || []));
}

before(async function () {
	server = http.createServer(function (req, res) {
		const url = new URL(req.url, 'http://localhost');
		requests.push(url.pathname + url.search);
		if (url.pathname === '/nodes') {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(nodes(url.searchParams.get('id'))));
		}
		else if (url.pathname === '/html') {
			res.writeHead(200, { 'Content-Type': 'text/html' });
			res.end('<ul><li id="h1">From HTML<ul><li id="h11">Nested</li></ul></li></ul>');
		}
		else if (url.pathname === '/mass') {
			const out = {};
			url.searchParams.get('ids').split(',').forEach(function (id) { out[id] = nodes(id); });
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify(out));
		}
		else {
			res.writeHead(500);
			res.end('nope');
		}
	});
	await new Promise(function (resolve) { server.listen(0, '127.0.0.1', resolve); });
	base = 'http://127.0.0.1:' + server.address().port;
});

after(function () {
	server.close();
});

for (const jq of JQUERY) {
	for (const build of BUILDS) {
		describe('ajax - ' + jq.name + ' - ' + build, function () {
			let env, $;
			beforeEach(function () {
				requests = [];
				env = createEnv(jq, build, { body: '<div id="tree"></div>', url: base + '/' });
				$ = env.$;
			});
			afterEach(function () {
				assert.deepStrictEqual(env.errors, [], 'no uncaught errors');
				env.window.close();
			});

			it('loads JSON nodes lazily from a url', async function () {
				const t = await createTree(env, '#tree', { core: { data: {
					url: '/nodes',
					data: function (node) { return { id: node.id }; }
				} } });
				same(t.get_node('#').children, ['r1', 'r2']);
				const loaded = nextEvent(env, '#tree', 'load_node.jstree');
				t.open_node('r2');
				assert.equal((await loaded).status, true);
				same(t.get_node('r2').children, ['r21']);
				same(requests, ['/nodes?id=%23', '/nodes?id=r2']);
			});

			it('accepts a url function', async function () {
				const t = await createTree(env, '#tree', { core: { data: {
					url: function (node) { return node.id === '#' ? '/nodes?id=%23' : '/nodes?id=' + node.id; }
				} } });
				same(t.get_node('#').children, ['r1', 'r2']);
			});

			it('loads HTML from a url', async function () {
				const t = await createTree(env, '#tree', { core: { data: { url: '/html' } } });
				same(t.get_node('#').children, ['h1']);
				same(t.get_node('h1').children, ['h11']);
				assert.equal(t.get_text('h11'), 'Nested');
			});

			it('reports failed requests', async function () {
				let error = null;
				const errored = nextEvent(env, '#tree', 'load_node.jstree');
				$('#tree').jstree({ core: {
					data: { url: '/missing' },
					error: function (err) { error = err; }
				} });
				assert.equal((await errored).status, false);
				assert.equal(error.error, 'ajax');
				assert.equal(error.id, 'core_04');
			});

			it('massloads several nodes with one request', async function () {
				const t = await createTree(env, '#tree', {
					core: { data: { url: '/nodes', data: function (node) { return { id: node.id }; } } },
					massload: { url: '/mass', data: function (ids) { return { ids: ids.join(',') }; } },
					plugins: ['massload']
				});
				requests.length = 0;
				const opened = new Promise(function (resolve) { t.load_node(['r1', 'r2'], resolve); });
				await opened;
				same(t.get_node('r1').children, ['r11']);
				same(t.get_node('r2').children, ['r21']);
				same(requests, ['/mass?ids=r1%2Cr2']);
			});

			it('massloads from a function', async function () {
				const asked = [];
				const t = await createTree(env, '#tree', {
					core: { data: function (node, cb) { cb(nodes(node.id)); } },
					massload: function (ids, cb) { asked.push(ids.slice()); const out = {}; ids.forEach(function (id) { out[id] = nodes(id); }); cb(out); },
					plugins: ['massload']
				});
				await new Promise(function (resolve) { t.load_node(['r1', 'r2'], resolve); });
				same(asked, [['r1', 'r2']]);
				same(t.get_node('r2').children, ['r21']);
			});
		});
	}
}
